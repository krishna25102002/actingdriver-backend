const Booking = require("../models/Booking");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const reassignment = require("../services/reassignment.service");
const pricing = require("../utils/pricing");
const { timeToMinutes } = require("../utils/bookingTime");
const logger = require("../utils/logger");

/**
 * In-process sweep jobs (no external scheduler dependency).
 * - Every `OFFER_EXPIRY_INTERVAL_MS` (default 60s):
 *     expire stale PENDING offers; advance reassignment rounds to new offers or
 *     SYSTEM_CANCEL when the deadline passed / no candidates remain.
 *     Also expire stale initial requests of still-PENDING bookings.
 * - Every `NO_SHOW_INTERVAL_MS` (default 60s):
 *     auto-mark driver no-shows (assigned but never arrived past pickup+grace)
 *     and customer no-shows (driver arrived, noShowWaitMinutes elapsed).
 */

const GRACE_AFTER_PICKUP_MINUTES = 10;

let running = false;

const runSweep = async () => {
    if (running) return;
    running = true;
    try {
        await sweepExpiredOffers();
        await sweepDriverNoShow();
        await sweepCustomerNoShow();
    } catch (error) {
        logger.error("sweep_failed", { meta: { message: error.message } });
    } finally {
        running = false;
    }
};

/**
 * 1) Expire stale offers + initial requests, then advance reassigning bookings.
 */
const sweepExpiredOffers = async () => {
    const now = new Date();

    // a) Stale PENDING requests whose expiresAt passed (replacement offers).
    const stale = await BookingDriverRequest.find({
        requestStatus: "PENDING",
        expiresAt: { $lt: now }
    }).select("bookingId _id");

    const affected = {};
    for (const r of stale) {
        affected[String(r.bookingId)] = true;
    }
    if (stale.length) {
        await BookingDriverRequest.updateMany(
            { requestStatus: "PENDING", expiresAt: { $lt: now } },
            { $set: { requestStatus: "EXPIRED" } }
        );
        logger.logEvent("offers_expired", {
            reason: undefined,
            newStatus: "EXPIRED",
            meta: { count: stale.length }
        });
    }

    // b) Reassignment bookings: if no PENDING offers remain, run the next round
    //    (fresh candidates) or SYSTEM_CANCEL once the deadline passed.
    const reassigningBookings = await Booking.find({
        flowStatus: "DRIVER_REASSIGNING",
        bookingStatus: "CONFIRMED"
    }).select("_id");
    for (const b of reassigningBookings) {
        await reassignment.expireStaleOffers(String(b._id));
    }

    // c) Stale initial requests (booking never confirmed) — expire + close.
    const cfg = await pricing.getConfig();
    const initialExpiryMs = (cfg.requestExpiryMinutes || 5) * 60000;
    const staleInitial = await BookingDriverRequest.find({
        requestStatus: "PENDING",
        expiresAt: null,
        requestedAt: { $lt: new Date(Date.now() - initialExpiryMs) }
    }).select("bookingId _id");

    const staleByBooking = {};
    for (const r of staleInitial) {
        staleByBooking[String(r.bookingId)] = true;
    }
    if (staleInitial.length) {
        await BookingDriverRequest.updateMany(
            { requestStatus: "PENDING", expiresAt: null, requestedAt: { $lt: new Date(Date.now() - initialExpiryMs) } },
            { $set: { requestStatus: "EXPIRED" } }
        );
    }
    for (const bookingId of Object.keys(affected)) {
        staleByBooking[bookingId] = true;
    }
    for (const bookingId of Object.keys(staleByBooking)) {
        const pendingLeft = await BookingDriverRequest.countDocuments({
            bookingId,
            requestStatus: "PENDING"
        });
        if (pendingLeft > 0) continue;

        const bookingDoc = await Booking.findById(bookingId);
        if (!bookingDoc) continue;
        if (!(bookingDoc.bookingStatus === "PENDING" && bookingDoc.flowStatus === "DRIVER_SEARCHING")) continue;

        // Initial batch exhausted (all expired): forward to the next eligible
        // drivers that were never invited; only close when no fresh candidates.
        const round = await reassignment.runInitialSearchRound(bookingDoc, cfg, "system");
        if (round && round.offered && round.offered.length > 0) {
            logger.logEvent("booking_forwarded_after_expiry", {
                bookingId,
                newStatus: "DRIVER_SEARCHING",
                meta: { candidates: round.offered.map((o) => String(o.driverId)) }
            });
            continue;
        }

        await Booking.updateOne(
            {
                _id: bookingId,
                bookingStatus: "PENDING",
                $or: [{ assignedDriverId: null }, { assignedDriverId: undefined }]
            },
            {
                bookingStatus: "NO_DRIVER_AVAILABLE",
                flowStatus: "SYSTEM_CANCELLED",
                driverAssignmentStatus: "CANCELLED",
                cancelledAt: new Date(),
                cancelledBy: "System",
                cancelReason: "Booking request expired",
                $push: {
                    flowStatusHistory: {
                        status: "SYSTEM_CANCELLED",
                        at: new Date(),
                        by: "system"
                    }
                }
            }
        );
    }
    // Cleanup `affected` var (kept for readability).
    void affected;
};

/**
 * 2) Driver no-show: assigned, never arrived past pickup (+ grace). Emergency
 *    replacement, else SYSTEM_CANCEL.
 */
const sweepDriverNoShow = async () => {
    const cutoff = new Date(Date.now() - GRACE_AFTER_PICKUP_MINUTES * 60000);
    const docs = await Booking.find({
        bookingStatus: "CONFIRMED",
        assignedDriverId: { $ne: null },
        flowStatus: { $in: ["DRIVER_CONFIRMED", "DRIVER_EN_ROUTE"] }
    }).select("_id assignedDriverId fromDate startTime endTime toDate");

    for (const b of docs) {
        if (!b.fromDate) continue;
        const pickup = new Date(b.fromDate);
        const t = timeToMinutes(b.startTime);
        if (t != null) {
            pickup.setHours(Math.floor(t / 60), t % 60, 0, 0);
        }
        if (isNaN(pickup.getTime()) || pickup.getTime() > cutoff.getTime()) continue;

        // Overnight / midnight-crossing trips (e.g. 11:55 PM -> 2:55 AM): the
        // scheduled end falls on the next calendar day. Do not declare a
        // no-show while the trip's own window is still running, otherwise the
        // trip silently gets reassigned in the middle of the night.
        const endMin = timeToMinutes(b.endTime);
        if (t != null && endMin != null && endMin <= t) {
            const windowEnd = new Date(b.fromDate);
            windowEnd.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
            windowEnd.setDate(windowEnd.getDate() + 1);
            if (windowEnd.getTime() > Date.now()) continue;
        }

        try {
            const res = await reassignment.markDriverNoShow({
                bookingId: b._id,
                driverId: b.assignedDriverId
            });
            if (res && res.success === false) continue;
        } catch (error) {
            logger.warn("driver_no_show_sweep_error", {
                bookingId: String(b._id),
                meta: { message: error.message }
            });
        }
    }
};

/**
 * 3) Customer no-show: driver arrived, noShowWaitMinutes elapsed, trip never
 *    started. Marks NO_SHOW + stores the fee as amount due.
 */
const sweepCustomerNoShow = async () => {
    const docs = await Booking.find({
        flowStatus: "DRIVER_ARRIVED",
        bookingStatus: "CONFIRMED",
        noShowWindowEndsAt: { $lt: new Date() }
    }).select("_id");

    for (const b of docs) {
        try {
            await reassignment.markCustomerNoShow({ bookingId: b._id });
        } catch (error) {
            logger.warn("customer_no_show_sweep_error", {
                bookingId: String(b._id),
                meta: { message: error.message }
            });
        }
    }
};

/**
 * Start the periodic sweeps. Returns an object with stop() for tests/shutdown.
 */
const startCronJobs = () => {
    if (process.env.CRON_ENABLED === "false") {
        logger.info("cron_disabled", {});
        return { stop: () => {} };
    }

    const offerInterval = Number(process.env.OFFER_EXPIRY_INTERVAL_MS) || 60000;
    const noShowInterval = Number(process.env.NO_SHOW_INTERVAL_MS) || 60000;

    const t1 = setInterval(() => runSweep().catch(() => {}), offerInterval);
    const t2 = setInterval(() => runSweep().catch(() => {}), noShowInterval);

    // First pass shortly after boot.
    const first = setTimeout(() => runSweep().catch(() => {}), 2000);

    logger.info("cron_started", { meta: { offerInterval, noShowInterval } });

    return {
        stop: () => {
            clearInterval(t1);
            clearInterval(t2);
            clearTimeout(first);
            logger.info("cron_stopped", {});
        }
    };
};

module.exports = {
    startCronJobs,
    runSweep,
    sweepExpiredOffers,
    sweepDriverNoShow,
    sweepCustomerNoShow
};