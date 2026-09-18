const Booking = require("../models/Booking");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const Driver = require("../models/Driver");
const Cancellation = require("../models/Cancellation");
const DriverAssignmentHistory = require("../models/DriverAssignmentHistory");
const flowMachine = require("../utils/bookingStateMachine");
const { FLOW_STATUS, applyFlowStatus } = flowMachine;
const bookingTime = require("../utils/bookingTime");
const { isDriverFree, timeToMinutes } = bookingTime;
const logger = require("../utils/logger");
const pricing = require("../utils/pricing");
const cancellationPolicy = require("../utils/cancellationPolicy");

/**
 * Reassignment engine for the acting-driver flow ("Driver Go Acting Driver").
 *
 * Handles:
 *  - Driver unavailability -> DRIVER_UNAVAILABLE -> DRIVER_REASSIGNING -> offer
 *    -> accept (DRIVER_REASSIGNED -> DRIVER_CONFIRMED) or -> DRIVER_REASSIGNMENT_FAILED
 *    -> SYSTEM_CANCELLED when the deadline passes / no candidate exists.
 *  - Driver no-show (never reached pickup): emergency replacement or cancel.
 *  - Customer no-show (driver arrived, waited noShowWaitMinutes): NO_SHOW + fee.
 *  - Complete, immutable driver assignment history; one Cancellation record per
 *    failure event (idempotent).
 *
 * Concurrency: every state flip is an atomic conditional findOneAndUpdate, so a
 * customer cancel and a driver-unavailable happening at the same instant can
 * never both win - exactly one transition is applied.
 */

const UNAVAILABILITY_REASONS = [
    "DRIVER_VEHICLE_ISSUE",
    "DRIVER_HEALTH_EMERGENCY",
    "DRIVER_PERSONAL_EMERGENCY",
    "DRIVER_ACCIDENT",
    "DRIVER_ROUTE_ISSUE",
    "DRIVER_NETWORK_ISSUE",
    "DRIVER_OTHER"
];

// Booking flowStatuses from which a driver may report unavailability.
const REASSIGNABLE_STATUSES = [
    "DRIVER_ASSIGNED",
    "DRIVER_CONFIRMED",
    "DRIVER_EN_ROUTE",
    "DRIVER_ARRIVED"
];

/**
 * Append an immutable assignment-history entry.
 */
const recordHistory = async ({ bookingId, driverId, status, requestId, reason, note, by = "system" }) => {
    const entry = await DriverAssignmentHistory.create({
        bookingId,
        driverId,
        status,
        requestId: requestId || null,
        reason: reason || "",
        note: note || "",
        by
    });
    logger.logEvent("assignment_history_recorded", {
        bookingId, driverId, newStatus: status, reason, meta: { by, historyId: entry._id }
    });
    return entry;
};

/**
 * One (and only one) Cancellation record per failure event. Idempotent.
 */
const createCancellationRecord = async ({
    booking, driverId, cancelledBy, reason, description, driverArrived,
    cancellationFee, amountDue
}) => {
    const dup = await Cancellation.findOne({ bookingId: booking._id, cancelledBy })
        .select("_id");
    if (dup) return dup;

    return Cancellation.create({
        bookingId: booking._id,
        cancelledBy,
        reason: reason || "",
        description: description || "",
        bookingStatusBefore: booking.flowStatus || booking.bookingStatus || "",
        driverId: driverId || null,
        driverArrived: Boolean(driverArrived),
        cancellationFee: cancellationFee || 0,
        amountDue: amountDue || 0,
        paymentStatus: "Pending"
    });
};

/**
 * Resolve the actual pickup Date (fromDate + startTime) for a booking.
 */
const pickupDateTime = (booking) => {
    const pickup = new Date(booking.fromDate || new Date());
    const t = timeToMinutes(booking.startTime);
    if (t != null) {
        pickup.setHours(Math.floor(t / 60), t % 60, 0, 0);
    }
    return pickup;
};

/**
 * Reassignment search window: stop at min(pickup - buffer, now + maxSearch).
 */
const computeReassignmentDeadline = (booking, cfg) => {
    const now = Date.now();
    const pickup = pickupDateTime(booking).getTime();
    const minBefore = (cfg.replacementDeadlineMinutesBeforePickup || 0) * 60000;
    const searchMax = (cfg.replacementSearchMaxMinutes || 30) * 60000;
    return new Date(Math.min(pickup - minBefore, now + searchMax));
};

/**
 * DriverIds that already had any request against this booking
 * (offered / rejected / expired / cancelled) - they get one shot only.
 */
const priorDriverIds = async (booking) => {
    const prior = await BookingDriverRequest.find({ bookingId: booking._id }).select("driverId");
    return prior.map((r) => String((r.driverId && r.driverId._id) || r.driverId)).filter(Boolean);
};

/**
 * Eligible replacement candidates, sorted by reliability then proximity:
 *  - Approved, online, available, not deleted
 *  - not the current assigned driver
 *  - not previously offered / rejected / assigned to this booking
 *  - time-window free for the booking slot
 *  - ranked: rating desc, totalTrips desc, then geo proximity
 */
const findEligibleReplacementDrivers = async (booking, cfg, alreadyExcluded = []) => {
    const excludeIds = [...alreadyExcluded];
    if (booking.assignedDriverId) {
        excludeIds.push(booking.assignedDriverId._id || booking.assignedDriverId);
    }
    excludeIds.push(...(await priorDriverIds(booking)));
    const uniqueExcludes = [...new Set(excludeIds.map((id) => String(id)))].filter(Boolean);

    const baseFilter = {
        isDeleted: false,
        verificationStatus: "Approved",
        accountStatus: "Online",
        isAvailable: true,
        ...(uniqueExcludes.length ? { _id: { $nin: uniqueExcludes } } : {})
    };

    const lng = booking.pickupLocation && booking.pickupLocation.longitude;
    const lat = booking.pickupLocation && booking.pickupLocation.latitude;
    const hasGeo = lat && lng && lat !== 0 && lng !== 0;

    let drivers = [];
    if (hasGeo) {
        drivers = await Driver.find({
            ...baseFilter,
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: 50000
                }
            }
        }).limit(100).lean();
    } else {
        drivers = await Driver.find(baseFilter).limit(100).lean();
    }

    const eligible = [];
    for (const d of drivers) {
        const free = await isDriverFree(d._id, booking.fromDate, booking.toDate, booking.startTime, booking.endTime);
        if (!free) continue;
        let proximity = Infinity;
        if (hasGeo && d.location && Array.isArray(d.location.coordinates)) {
            const [dLng, dLat] = d.location.coordinates;
            proximity = Math.pow(dLng - lng, 2) + Math.pow(dLat - lat, 2);
        }
        eligible.push({ driver: d, proximity });
    }

    eligible.sort((a, b) => {
        const ra = a.driver.rating || 0;
        const rb = b.driver.rating || 0;
        if (ra !== rb) return rb - ra;
        const ta = a.driver.totalTrips || 0;
        const tb = b.driver.totalTrips || 0;
        if (ta !== tb) return tb - ta;
        return a.proximity - b.proximity;
    });

    const max = cfg.maxReplacementCandidates || 5;
    return eligible.slice(0, max).map((e) => e.driver);
};

/**
 * Create / refresh PENDING offers for the given drivers.
 */
const createReplacementOffers = async (booking, drivers, cfg, historyReason = "replacement_offer") => {
    const expiresAt = new Date(Date.now() + ((cfg.offerTimeoutMinutes || 5) * 60000));
    const created = [];
    for (const driver of drivers) {
        const existing = await BookingDriverRequest.findOneAndUpdate(
            { bookingId: booking._id, driverId: driver._id, requestStatus: "PENDING" },
            { $set: { expiresAt, requestedAt: new Date() } },
            { returnDocument: "after", upsert: false }
        );
        if (existing) {
            created.push({ driverId: driver._id, requestId: existing._id });
            continue;
        }
        const request = await BookingDriverRequest.create({
            bookingId: booking._id,
            customerId: booking.customerId,
            driverId: driver._id,
            bookingNumber: booking.bookingNumber,
            fromDate: booking.fromDate,
            toDate: booking.toDate || booking.fromDate,
            startTime: booking.startTime || "",
            endTime: booking.endTime || "",
            pickupAddress: booking.pickupAddress || "",
            dropAddress: booking.dropAddress || "",
            estimatedAmount: booking.estimatedFare || 0,
            estimatedDurationHours: booking.estimatedDuration || 0,
            vehicleType: booking.tripType || "",
            requestStatus: "PENDING",
            requestedAt: new Date(),
            expiresAt
        });
        created.push({ driverId: driver._id, requestId: request._id });
        await recordHistory({
            bookingId: booking._id,
            driverId: driver._id,
            status: "OFFERED",
            requestId: request._id,
            reason: historyReason,
            by: "system"
        });
    }
    return created;
};

/**
 * One reassignment round: offer to up to N fresh candidates. Returns
 * { offered: n } or triggers SYSTEM_CANCELLED when nothing more can be done.
 */
const runReassignmentRound = async (booking, cfg, by = "system") => {
    const now = Date.now();
    if (booking.reassignmentDeadline && new Date(booking.reassignmentDeadline).getTime() <= now) {
        return failReplacement(booking, "No replacement driver found before the deadline", by);
    }

    const candidates = await findEligibleReplacementDrivers(booking, cfg);
    if (candidates.length === 0) {
        return failReplacement(booking, "No replacement driver available", by);
    }

    const offers = await createReplacementOffers(booking, candidates, cfg);
    logger.logEvent("reassignment_round", {
        bookingId: booking._id,
        newStatus: FLOW_STATUS.DRIVER_REASSIGNING,
        meta: { candidates: offers.map((o) => String(o.driverId)) }
    });
    return { success: true, reassigning: true, offered: offers };
};

/**
 * Next-eligible-driver round for the INITIAL recruiting phase (booking still
 * PENDING / DRIVER_SEARCHING, never confirmed). The customer's chosen batch has
 * been exhausted (all rejected/expired); forward to the next set of eligible
 * drivers that were never invited to this booking before, so the request does
 * not die as NO_DRIVER_AVAILABLE while capable drivers remain.
 *
 * Returns the created offers, or null when there are genuinely no fresh
 * candidates left (caller should then close the booking as NO_DRIVER_AVAILABLE).
 */
const runInitialSearchRound = async (booking, cfg, by = "system") => {
    if (!booking || booking.bookingStatus !== "PENDING") {
        return { success: true, skipped: true, offered: [] };
    }

    const candidates = await findEligibleReplacementDrivers(booking, cfg);
    if (candidates.length === 0) {
        return null;
    }

    const offers = await createReplacementOffers(booking, candidates, cfg, "recruiting_offer");
    logger.logEvent("recruiting_round", {
        bookingId: booking._id,
        newStatus: FLOW_STATUS.DRIVER_SEARCHING,
        meta: { candidates: offers.map((o) => String(o.driverId)) }
    });
    return { success: true, offered: offers };
};

/**
 * Mark the reassignment search failed and cancel the booking (system).
 * Atomic: only wins if still DRIVER_REASSIGNING (a concurrent accept wins otherwise).
 */
const failReplacement = async (booking, cause, by = "system") => {
    const claim = await Booking.findOneAndUpdate(
        { _id: booking._id, flowStatus: FLOW_STATUS.DRIVER_REASSIGNING },
        {
            $set: {
                flowStatus: FLOW_STATUS.DRIVER_REASSIGNMENT_FAILED,
                bookingStatus: "CANCELLED",
                driverAssignmentStatus: "CANCELLED",
                cancelledBy: "System",
                cancelReason: cause,
                cancelledAt: new Date(),
                assignedDriverId: null
            },
            $push: {
                flowStatusHistory: {
                    status: FLOW_STATUS.DRIVER_REASSIGNMENT_FAILED,
                    at: new Date(),
                    by
                }
            }
        },
        { returnDocument: "after" }
    );
    if (!claim) {
        return { success: false, message: "Reassignment was already resolved." };
    }

    applyFlowStatus(claim, FLOW_STATUS.SYSTEM_CANCELLED, by);
    await claim.save();

    await BookingDriverRequest.updateMany(
        { bookingId: booking._id, requestStatus: "PENDING" },
        { requestStatus: "EXPIRED" }
    );

    await createCancellationRecord({
        booking: claim,
        driverId: booking.assignedDriverId || null,
        cancelledBy: "SYSTEM",
        reason: cause,
        driverArrived: false,
        cancellationFee: 0,
        amountDue: 0
    });

    logger.logEvent("system_cancelled", {
        bookingId: claim._id, driverId: booking.assignedDriverId,
        oldStatus: "DRIVER_REASSIGNING", newStatus: "SYSTEM_CANCELLED", reason: cause
    });

    return {
        success: true,
        reassigned: false,
        status: "CANCELLED",
        message: "Replacement driver could not be found. Booking cancelled."
    };
};

/**
 * Driver reports unavailability. Atomic claim -> frees the old driver ->
 * starts reassignment. This is THE single-winner transition: whichever of
 * (customer cancel, driver unavailable, admin reassign) claims first wins.
 *
 * @returns {{success:boolean, reassigning:boolean, offered:Array, status:string}}
 */
const triggerReassignment = async ({ bookingId, driverId, reason = "", description = "", by = "driver", adminId = null }) => {
    const cfg = await pricing.getConfig();

    const found = await Booking.findById(bookingId);
    if (!found) throw new Error("Booking not found");
    if (driverId && String((found.assignedDriverId && found.assignedDriverId._id) || found.assignedDriverId || "") !== String(driverId)) {
        throw new Error("This driver is not assigned to this booking");
    }
    if (found.bookingStatus === "ONGOING") {
        throw new Error("A trip that has started cannot be reassigned");
    }
    if (!REASSIGNABLE_STATUSES.includes(found.flowStatus)) {
        throw new Error("Booking is not in a reassignable state");
    }

    const deadline = computeReassignmentDeadline(found, cfg);
    const now = new Date();
    const actor = adminId ? "admin" : by;

    const claim = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            bookingStatus: "CONFIRMED",
            flowStatus: { $in: REASSIGNABLE_STATUSES }
        },
        {
            $set: {
                flowStatus: FLOW_STATUS.DRIVER_UNAVAILABLE,
                driverAssignmentStatus: "REASSIGNING",
                unavailabilityReason: reason || "",
                unavailabilityDescription: description || "",
                replacementSearchStartedAt: now,
                reassignmentDeadline: deadline
            },
            $push: {
                flowStatusHistory: { status: FLOW_STATUS.DRIVER_UNAVAILABLE, at: now, by: actor }
            }
        },
        { returnDocument: "after" }
    );

    if (!claim) {
        throw new Error("Booking is no longer in a reassignable state (it may have been cancelled already).");
    }

    // Record why the previous driver stepped away + free them up.
    await recordHistory({
        bookingId: claim._id,
        driverId: driverId || claim.assignedDriverId,
        status: "UNAVAILABLE",
        reason: reason || "unavailable",
        note: description || "",
        by: actor
    });
    await Driver.findByIdAndUpdate(driverId || claim.assignedDriverId, {
        currentBookingId: null,
        accountStatus: "Online",
        isAvailable: true
    });

    applyFlowStatus(claim, FLOW_STATUS.DRIVER_REASSIGNING, actor);
    await claim.save();

    logger.logEvent("driver_unavailable", {
        bookingId: claim._id, driverId,
        oldStatus: "DRIVER_CONFIRMED", newStatus: "DRIVER_REASSIGNING", reason
    });

    return runReassignmentRound(claim, cfg, actor);
};

/**
 * Driver never reached pickup: emergency replacement, else system cancel.
 * CONFIRMED -> DRIVER_NO_SHOW -> DRIVER_REASSIGNING -> ... or SYSTEM_CANCELLED.
 */
const markDriverNoShow = async ({ bookingId, driverId }) => {
    const cfg = await pricing.getConfig();

    const found = await Booking.findById(bookingId);
    if (!found) throw new Error("Booking not found");
    if (found.assignedDriverId && String((found.assignedDriverId._id) || found.assignedDriverId) !== String(driverId)) {
        throw new Error("This driver is not assigned to this booking");
    }
    if (!["DRIVER_CONFIRMED", "DRIVER_EN_ROUTE"].includes(found.flowStatus)) {
        return { success: false, message: "Booking is not in a no-show state." };
    }

    const deadline = computeReassignmentDeadline(found, cfg);

    const claim = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            bookingStatus: "CONFIRMED",
            flowStatus: { $in: ["DRIVER_CONFIRMED", "DRIVER_EN_ROUTE"] }
        },
        {
            $set: {
                flowStatus: FLOW_STATUS.DRIVER_REASSIGNING,
                driverAssignmentStatus: "REASSIGNING",
                unavailabilityReason: "DRIVER_NO_SHOW",
                unavailabilityDescription: "Driver did not reach pickup on time",
                replacementSearchStartedAt: new Date(),
                reassignmentDeadline: deadline
            },
            $push: {
                flowStatusHistory: { status: FLOW_STATUS.DRIVER_NO_SHOW, at: new Date(), by: "system" }
            }
        },
        { returnDocument: "after" }
    );
    if (!claim) {
        return { success: false, message: "Booking is no longer eligible for no-show handling." };
    }

    applyFlowStatus(claim, FLOW_STATUS.DRIVER_REASSIGNING, "system");
    await claim.save();

    await recordHistory({
        bookingId: claim._id,
        driverId,
        status: "NO_SHOW",
        reason: "DRIVER_NO_SHOW",
        by: "system"
    });
    await Driver.findByIdAndUpdate(driverId, {
        currentBookingId: null,
        accountStatus: "Online",
        isAvailable: true
    });

    logger.logEvent("driver_no_show", {
        bookingId: claim._id, driverId, oldStatus: "DRIVER_CONFIRMED", newStatus: "DRIVER_REASSIGNING"
    });

    return runReassignmentRound(claim, cfg, "system");
};

/**
 * Customer no-show: driver arrived, waited noShowWaitMinutes, trip never started.
 * NO_SHOW is terminal; the no-show fee becomes the amount due (never a refund).
 */
const markCustomerNoShow = async ({ bookingId }) => {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    if (booking.flowStatus !== FLOW_STATUS.DRIVER_ARRIVED) {
        return { success: false, message: "Booking is not awaiting customer arrival." };
    }
    if (booking.bookingStatus !== "CONFIRMED") {
        return { success: false, message: "Booking is not confirmed." };
    }
    const waitEnd = booking.noShowWindowEndsAt
        ? new Date(booking.noShowWindowEndsAt).getTime()
        : ((booking.driverArrivedAt ? new Date(booking.driverArrivedAt) : new Date()).getTime() + 15 * 60000);
    if (Date.now() < waitEnd) {
        return { success: false, message: "No-show window has not elapsed yet." };
    }

    const cfg = await pricing.getConfig();
    const fee = await cancellationPolicy.computeNoShowFee(booking, cfg);

    const claim = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            flowStatus: FLOW_STATUS.DRIVER_ARRIVED,
            bookingStatus: "CONFIRMED"
        },
        {
            $set: {
                flowStatus: FLOW_STATUS.NO_SHOW,
                bookingStatus: "CANCELLED",
                driverAssignmentStatus: "NO_SHOW",
                noShowFee: fee,
                amountDue: fee,
                cancelledBy: "Customer",
                cancelReason: "Customer no-show",
                cancelledAt: new Date()
            },
            $push: {
                flowStatusHistory: { status: FLOW_STATUS.NO_SHOW, at: new Date(), by: "system" }
            }
        },
        { returnDocument: "after" }
    );
    if (!claim) {
        return { success: false, message: "No-show was already processed." };
    }

    // Free the waiting driver.
    if (claim.assignedDriverId) {
        await Driver.findByIdAndUpdate(claim.assignedDriverId, {
            currentBookingId: null,
            accountStatus: "Online",
            isAvailable: true
        });
    }

    await createCancellationRecord({
        booking: claim,
        driverId: claim.assignedDriverId || null,
        cancelledBy: "CUSTOMER",
        reason: "CUSTOMER_NO_SHOW",
        description: "Customer did not arrive within the no-show window",
        driverArrived: true,
        cancellationFee: fee,
        amountDue: fee
    });

    logger.logEvent("customer_no_show", {
        bookingId: claim._id, driverId: claim.assignedDriverId,
        oldStatus: "DRIVER_ARRIVED", newStatus: "NO_SHOW", reason: "CUSTOMER_NO_SHOW",
        meta: { fee }
    });

    return {
        success: true,
        status: "CANCELLED",
        noShowFee: fee,
        amountDue: fee,
        message: "Customer no-show processed. Fee added to amount due."
    };
};

/**
 * Expire stale PENDING offers (their expiresAt passed). When the last pending
 * offer of a reassigning booking expires, run the next search round or cancel.
 */
const expireStaleOffers = async (bookingId) => {
    const now = new Date();
    const res = await BookingDriverRequest.updateMany(
        { bookingId, requestStatus: "PENDING", expiresAt: { $lt: now } },
        { $set: { requestStatus: "EXPIRED" } }
    );

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.flowStatus !== "DRIVER_REASSIGNING") {
        return { success: true, expired: res.modifiedCount || 0 };
    }

    const pending = await BookingDriverRequest.countDocuments({ bookingId, requestStatus: "PENDING" });
    if (pending > 0) {
        return { success: true, expired: res.modifiedCount || 0, pending };
    }

    const cfg = await pricing.getConfig();
    return runReassignmentRound(booking, cfg, "system");
};

/**
 * Admin: force a replacement for the current driver.
 */
const adminReassign = async (adminId, bookingId, { reason = "", description = "" } = {}) => {
    const found = await Booking.findById(bookingId);
    if (!found) throw new Error("Booking not found");
    if (!found.assignedDriverId) throw new Error("No driver is assigned to this booking");
    return triggerReassignment({
        bookingId,
        driverId: found.assignedDriverId,
        reason: reason || "ADMIN_REASSIGN",
        description,
        by: "system",
        adminId
    });
};

/**
 * Admin: cancel a booking outright (no fee for the customer).
 */
const adminCancel = async (adminId, bookingId, { reason = "" } = {}) => {
    const active = ["PENDING", "CONFIRMED", "NO_DRIVER_AVAILABLE"];
    const before = await Booking.findById(bookingId);
    if (!before) throw new Error("Booking not found");
    if (!active.includes(before.bookingStatus)) {
        throw new Error("Booking cannot be cancelled in its current state");
    }

    const assignedDriverId = before.assignedDriverId || null;
    const claim = await Booking.findOneAndUpdate(
        { _id: bookingId, bookingStatus: { $in: active } },
        {
            $set: {
                bookingStatus: "CANCELLED",
                cancelledBy: "Admin",
                cancelReason: reason || "Cancelled by admin",
                cancelledAt: new Date(),
                flowStatus: FLOW_STATUS.SYSTEM_CANCELLED,
                driverAssignmentStatus: "CANCELLED",
                assignedDriverId: null
            },
            $push: {
                flowStatusHistory: { status: FLOW_STATUS.SYSTEM_CANCELLED, at: new Date(), by: "admin" }
            }
        },
        { returnDocument: "after" }
    );
    if (!claim) {
        throw new Error("Booking was already cancelled or modified.");
    }

    await BookingDriverRequest.updateMany(
        { bookingId, requestStatus: "PENDING" },
        { requestStatus: "CANCELLED" }
    );
    if (assignedDriverId) {
        await Driver.findByIdAndUpdate(assignedDriverId, {
            currentBookingId: null,
            accountStatus: "Online",
            isAvailable: true
        });
    }

    await createCancellationRecord({
        booking: claim,
        driverId: assignedDriverId,
        cancelledBy: "ADMIN",
        reason: reason || "cancelled by admin",
        driverArrived: false,
        cancellationFee: 0,
        amountDue: 0
    });

    return { success: true, message: "Booking cancelled by admin." };
};

module.exports = {
    UNAVAILABILITY_REASONS,
    REASSIGNABLE_STATUSES,
    recordHistory,
    createCancellationRecord,
    pickupDateTime,
    computeReassignmentDeadline,
    priorDriverIds,
    findEligibleReplacementDrivers,
    createReplacementOffers,
    runReassignmentRound,
    runInitialSearchRound,
    failReplacement,
    triggerReassignment,
    markDriverNoShow,
    markCustomerNoShow,
    expireStaleOffers,
    adminReassign,
    adminCancel
};