const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const Driver = require("../models/Driver");
const Rating = require("../models/Rating");
const Customer = require("../models/Customer");
const pricing = require("../utils/pricing");
const otpService = require("./otp.service");
const razorpay = require("./razorpay.service");
const flowMachine = require("../utils/bookingStateMachine");
const { applyFlowStatus, resolveFlowStatus } = flowMachine;
const bookingTime = require("../utils/bookingTime");
const { timeToMinutes, windowsOverlap, sameDay, dayRangesOverlap, bookingDays, hasConflictingBooking, isDriverFree } = bookingTime;
const reassignment = require("./reassignment.service");
const cancellationPolicy = require("../utils/cancellationPolicy");
const driverPolicy = require("../utils/driverPolicy");
const logger = require("../utils/logger");
const bookingMail = require("./bookingMail.service");
const { notifyBookingEnded } = require("../sockets/location.socket");

const generateBookingNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BK${year}${month}${day}${random}`;
};

/**
 * 1. Get available drivers for the requested booking window.
 */
exports.getAvailableDrivers = async (data) => {
    const { fromDate, toDate, startTime, endTime } = data;

    const drivers = await Driver.find({
        isDeleted: false,
        verificationStatus: "Approved",
        accountStatus: { $in: ["Online"] },
        isAvailable: true
    }).select(
        "fullName profilePhoto rating ratingCount experience totalTrips mobileNumber isAvailable location"
    );

    const available = [];
    const seen = new Set();

    for (const driver of drivers) {
        if (seen.has(driver._id.toString())) continue;
        const free = await isDriverFree(driver._id, fromDate, toDate, startTime, endTime);
        if (!free) continue;
        seen.add(driver._id.toString());
        available.push({
            driverId: driver._id,
            fullName: driver.fullName,
            profilePhoto: driver.profilePhoto,
rating: driver.rating,
            ratingCount: driver.ratingCount,
            experience: driver.experience,
            totalTrips: driver.totalTrips,
            mobileNumber: driver.mobileNumber,
            isAvailable: driver.isAvailable
        });
    }

    return {
        success: true,
        count: available.length,
        drivers: available
    };
};

/**
 * 2. Create ONE booking + up to maxDrivers driver requests.
 * Bookings start as PENDING; each request starts as PENDING.
 */
exports.createBooking = async (customerId, data) => {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");

    const driverIds = (data.driverIds || []).filter(Boolean);
    const maxDrivers = (data.maxDrivers) || 10;
    if (driverIds.length === 0) {
        throw new Error("Please select at least one driver");
    }
    if (driverIds.length > 10) {
        throw new Error("A booking can be sent to a maximum of 10 drivers");
    }

    // Amount is calculated by the BACKEND from date/time (never trusted from client).
    const { hours, perHourRate, amount } = await pricing.calculateAmount({
        startTime: data.startTime,
        endTime: data.endTime,
        fromDate: data.fromDate,
        toDate: data.toDate
    });

    const bookingNumber = generateBookingNumber();

    const booking = await Booking.create({
        bookingNumber,
        customerId,
        fromDate: data.fromDate || null,
        toDate: data.toDate || data.fromDate || null,
        startTime: data.startTime || "",
        endTime: data.endTime || "",
        pickupAddress: data.pickupAddress || "",
        dropAddress: data.dropAddress || "",
        pickupLocation: {
            latitude: data.pickupLatitude || data.pickupLat || 0,
            longitude: data.pickupLongitude || data.pickupLng || 0
        },
        dropLocation: {
            latitude: data.dropLatitude || data.dropLat || 0,
            longitude: data.dropLongitude || data.dropLng || 0
        },
        requestedDriverIds: driverIds,
        estimatedFare: amount,
        estimatedDuration: hours,
        bookingStatus: "PENDING",
        flowStatus: "DRIVER_SEARCHING",
        driverAssignmentStatus: "SEARCHING",
        flowStatusHistory: [
            { status: "BOOKING_CREATED", at: new Date(), by: "customer" },
            { status: "DRIVER_SEARCHING", at: new Date(), by: "system" }
        ],
        tripType: "Local"
    });

    // Create one request per selected driver (all PENDING).
    const requests = [];
    for (const driverId of driverIds) {
        const request = await BookingDriverRequest.create({
            bookingId: booking._id,
            customerId,
            driverId,
            bookingNumber,
            fromDate: data.fromDate || null,
            toDate: data.toDate || data.fromDate || null,
            startTime: data.startTime || "",
            endTime: data.endTime || "",
            pickupAddress: data.pickupAddress || "",
            dropAddress: data.dropAddress || "",
            estimatedAmount: amount,
            estimatedDurationHours: hours,
            vehicleType: data.vehicleType || "",
            requestStatus: "PENDING",
            requestedAt: new Date()
        });
        requests.push({
            driver_id: driverId,
            status: "PENDING"
        });
    }

    return {
        success: true,
        message: "Booking request sent successfully.",
        booking: {
            id: booking._id,
            bookingNumber,
            status: "PENDING",
            from_date: data.fromDate,
            to_date: data.toDate || data.fromDate,
            start_time: data.startTime,
            end_time: data.endTime,
            amount,
            perHourRate
        },
        driver_requests: requests
    };
};

/**
 * 3. Driver accepts a booking request.
 * ATOMIC first-accept-wins: we claim the request by updating its status
 * PENDING -> ACCEPTED in a single atomic query. If it fails (already handled
 * by another driver), the booking was already won by someone else.
 */
exports.acceptRequest = async (driverId, requestId) => {
    // Verify the request belongs to this driver and is still PENDING.
    const claimed = await BookingDriverRequest.findOneAndUpdate(
        {
            _id: requestId,
            driverId,
            requestStatus: "PENDING"
        },
        {
            requestStatus: "ACCEPTED",
            acceptedAt: new Date()
        },
        { returnDocument: "after" }
    );

    if (!claimed) {
        const existing = await BookingDriverRequest.findById(requestId);
        if (!existing) {
            throw new Error("Booking request not found");
        }
        if (existing.driverId.toString() !== driverId.toString()) {
            throw new Error("Booking request does not belong to this driver");
        }
        throw new Error("This booking has already been accepted by another driver.");
    }

    // Final availability check (re-validate even after claiming).
    const free = await isDriverFree(
        driverId,
        claimed.fromDate,
        claimed.toDate,
        claimed.startTime,
        claimed.endTime
    );
    if (!free) {
        // Release the claim back to PENDING and reject with a reason.
        await BookingDriverRequest.findByIdAndUpdate(claimed._id, {
            requestStatus: "PENDING",
            acceptedAt: null
        });
        throw new Error("You are not available for this booking at this time.");
    }

    // Confirm the main booking and assign the driver atomically:
    // only succeeds if the booking is still PENDING (prevents double win).
    // If it is CONFIRMED + DRIVER_REASSIGNING, this is a replacement offer accept.
    let booking = await Booking.findOneAndUpdate(
        {
            _id: claimed.bookingId,
            bookingStatus: "PENDING"
        },
        {
            bookingStatus: "CONFIRMED",
            assignedDriverId: driverId,
            driverId,
            acceptedAt: new Date(),
            flowStatus: "DRIVER_ASSIGNED",
            driverAssignmentStatus: "ASSIGNED"
        },
        { returnDocument: "after" }
    );

    if (!booking) {
        // Replacement round: accept a reassignment offer (booking stays CONFIRMED).
        booking = await Booking.findOneAndUpdate(
            {
                _id: claimed.bookingId,
                bookingStatus: "CONFIRMED",
                flowStatus: "DRIVER_REASSIGNING"
            },
            {
                $set: {
                    assignedDriverId: driverId,
                    driverId,
                    acceptedAt: new Date(),
                    flowStatus: "DRIVER_REASSIGNED",
                    driverAssignmentStatus: "REASSIGNED"
                },
                $push: {
                    flowStatusHistory: { status: "DRIVER_REASSIGNED", at: new Date(), by: "driver" }
                }
            },
            { returnDocument: "after" }
        );
    }

    if (!booking) {
        // Booking already confirmed by someone else - roll back our claim.
        await BookingDriverRequest.findByIdAndUpdate(claimed._id, {
            requestStatus: "EXPIRED",
            acceptedAt: null
        });
        throw new Error("This booking has already been accepted by another driver.");
    }

    // Availability is time-window based. Re-validate after the atomic claim
    // so a concurrent accept of the same window by the same driver is
    // detected and rolled back instead of double-booking.
    const now = new Date();
    const wasReassign = booking.flowStatus === "DRIVER_REASSIGNED";
    booking.flowStatusHistory = booking.flowStatusHistory || [];
    if (!wasReassign) {
        booking.flowStatusHistory.push({ status: "DRIVER_ASSIGNED", at: now, by: "driver" });
    } else {
        // Replacement driver accepted: close out the reassignment state.
        booking.unavailabilityReason = "";
        booking.unavailabilityDescription = "";
        booking.replacementSearchStartedAt = null;
        booking.reassignmentDeadline = null;
    }
    applyFlowStatus(booking, "DRIVER_CONFIRMED", "driver");
    booking.driverAssignmentStatus = "CONFIRMED";
    if (wasReassign) {
        await reassignment.recordHistory({
            bookingId: booking._id,
            driverId,
            status: "ASSIGNED",
            requestId: claimed._id,
            reason: "replacement_accept",
            by: "driver"
        });
    }

    const conflict = await hasConflictingBooking(
        driverId,
        booking.fromDate,
        booking.toDate,
        booking.startTime,
        booking.endTime,
        booking._id
    );

    if (conflict) {
        await Booking.updateOne(
            { _id: booking._id, bookingStatus: "CONFIRMED", assignedDriverId: driverId },
            {
                bookingStatus: "PENDING",
                assignedDriverId: null,
                driverId: null,
                acceptedAt: null,
                flowStatus: "DRIVER_SEARCHING",
                driverAssignmentStatus: "SEARCHING"
            }
        );
        await BookingDriverRequest.updateOne(
            { _id: claimed._id },
            { $set: { requestStatus: "PENDING", acceptedAt: null } }
        );
        await Driver.findByIdAndUpdate(driverId, { currentBookingId: null });
        throw new Error("You already have a conflicting booking at this time.");
    }

    await booking.save();

    // Close all other PENDING requests for this booking.
    await BookingDriverRequest.updateMany(
        {
            bookingId: booking._id,
            _id: { $ne: claimed._id },
            requestStatus: "PENDING"
        },
        {
            requestStatus: "EXPIRED"
        }
    );

// The driver stays Online & available. Busy is enforced per time-window
    // by hasConflictingBooking, so this driver remains visible to other
    // customers for every non-overlapping slot on this or future days.
    await Driver.findByIdAndUpdate(driverId, {
        currentBookingId: booking._id
    });

    // Accepting a trip resets the driver's skip/cancel strike counter to 0.
    await driverPolicy.resetStrikes(driverId);

    // Send booking-confirmation emails to customer + driver (non-blocking failure).
    await bookingMail.sendConfirmationEmails(booking);

    return {
        success: true,
        message: "Booking accepted successfully.",
        booking: {
            id: booking._id,
            bookingNumber: booking.bookingNumber,
            status: "CONFIRMED",
            driver_id: driverId
        }
    };
};

/**
 * 4. Driver rejects a booking request with a reason.
 * Rejecting one driver does NOT cancel the booking if others are pending.
 * If all drivers have rejected/expired, booking becomes NO_DRIVER_AVAILABLE.
 */
exports.rejectRequest = async (driverId, requestId, reason) => {
    const request = await BookingDriverRequest.findOne({
        _id: requestId,
        driverId
    });
    if (!request) throw new Error("Booking request not found");

if (request.requestStatus !== "PENDING") {
        throw new Error("Booking request already handled");
    }

    // Strike policy: X skips/cancels allowed, the next one is restricted.
    await driverPolicy.assertNotRestricted(driverId);

    request.requestStatus = "REJECTED";
    request.rejectionReason = reason || "Not available";
    request.rejectedAt = new Date();
    await request.save();

    // If all requests for this booking are no longer PENDING (all rejected/expired),
    // and the booking is still unconformed, mark it NO_DRIVER_AVAILABLE.
    // During an active reassignment round, run the next search round instead.
    const remaining = await BookingDriverRequest.countDocuments({
        bookingId: request.bookingId,
        requestStatus: "PENDING"
    });

if (remaining === 0) {
        const bookingDoc = await Booking.findById(request.bookingId);
        const cfg = await pricing.getConfig();

        if (bookingDoc && bookingDoc.flowStatus === "DRIVER_REASSIGNING") {
            await reassignment.runReassignmentRound(bookingDoc, cfg, "system");
        } else if (bookingDoc) {
            // Initial recruiting phase exhausted: forward to the next eligible
            // drivers that were never invited yet. Only fall back to
            // NO_DRIVER_AVAILABLE when there are truly no fresh candidates.
            const round = await reassignment.runInitialSearchRound(bookingDoc, cfg, "system");
            if (round && round.offered && round.offered.length > 0) {
                logger.logEvent("booking_forwarded_to_next_eligible", {
                    bookingId: String(request.bookingId),
                    newStatus: "DRIVER_SEARCHING",
                    meta: { candidates: round.offered.map((o) => String(o.driverId)) }
                });
            } else {
                await Booking.updateOne(
                    {
                        _id: request.bookingId,
                        bookingStatus: "PENDING"
                    },
                    {
                        bookingStatus: "NO_DRIVER_AVAILABLE",
                        flowStatus: "SYSTEM_CANCELLED",
                        driverAssignmentStatus: "CANCELLED",
                        cancelledAt: new Date(),
                        cancelledBy: "System",
                        cancelReason: "No driver available",
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
        }
    }

    return {
        success: true,
        message: "Booking request rejected.",
        request: {
            driver_id: driverId,
            status: "REJECTED",
            rejection_reason: request.rejectionReason
        }
    };
};

/**
 * Driver: list pending booking requests for this driver.
 */
exports.getPendingRequests = async (driverId) => {
    const requests = await BookingDriverRequest.find({
        driverId,
        requestStatus: "PENDING"
    })
        .populate("customerId", "name phone email profileImage")
        .sort({ requestedAt: -1 });

const result = requests.map((r) => ({
        requestId: r._id,
        bookingId: r.bookingId,
        bookingNumber: r.bookingNumber,
        customer: r.customerId
            ? {
                  name: r.customerId.name,
                  phone: r.customerId.phone,
                  profileImage: r.customerId.profileImage
              }
            : null,
        fromDate: r.fromDate,
        toDate: r.toDate,
        startTime: r.startTime,
        endTime: r.endTime,
        pickupAddress: r.pickupAddress,
        dropAddress: r.dropAddress,
        estimatedAmount: r.estimatedAmount,
        estimatedDurationHours: r.estimatedDurationHours,
        vehicleType: r.vehicleType,
        status: r.requestStatus,
        requestedAt: r.requestedAt
    }));

    return {
        success: true,
        count: result.length,
        requests: result,
        strikePolicy: await driverPolicy.getStrikeSummary(driverId)
    };
};

/**
 * Driver: get a single booking request detail.
 */
exports.getRequestById = async (driverId, requestId) => {
    const request = await BookingDriverRequest.findOne({
        _id: requestId,
        driverId
    })
        .populate("customerId", "name phone email profileImage");

    if (!request) throw new Error("Booking request not found");

    return {
        success: true,
        request: {
            requestId: request._id,
            bookingId: request.bookingId,
            bookingNumber: request.bookingNumber,
            customer: request.customerId
                ? {
                      name: request.customerId.name,
                      phone: request.customerId.phone,
                      profileImage: request.customerId.profileImage
                  }
                : null,
            fromDate: request.fromDate,
            toDate: request.toDate,
            startTime: request.startTime,
            endTime: request.endTime,
            pickupAddress: request.pickupAddress,
            dropAddress: request.dropAddress,
            estimatedAmount: request.estimatedAmount,
            estimatedDurationHours: request.estimatedDurationHours,
            vehicleType: request.vehicleType,
            status: request.requestStatus,
            rejectionReason: request.rejectionReason,
            requestedAt: request.requestedAt
        }
    };
};

/**
 * Customer: upcoming trips (CONFIRMED or ONGOING).
 */
exports.getCustomerUpcoming = async (customerId) => {
    const bookings = await Booking.find({
        customerId,
        bookingStatus: { $in: ["CONFIRMED", "ONGOING"] }
    })
        .populate("assignedDriverId", "fullName profilePhoto rating mobileNumber")
        .sort({ createdAt: -1 });

    const result = bookings.map((b) => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        status: b.bookingStatus,
        fromDate: b.fromDate,
        toDate: b.toDate,
        startTime: b.startTime,
        endTime: b.endTime,
        pickupAddress: b.pickupAddress,
        dropAddress: b.dropAddress,
        amount: b.estimatedFare,
        flowStatus: b.flowStatus,
        driverAssignmentStatus: b.driverAssignmentStatus,
        amountDue: b.amountDue || 0,
        cancellationFee: b.cancellationFee || 0,
        noShowFee: b.noShowFee || 0,
        driver: b.assignedDriverId
            ? {
                  driverId: b.assignedDriverId._id,
                  fullName: b.assignedDriverId.fullName,
                  profilePhoto: b.assignedDriverId.profilePhoto,
                  rating: b.assignedDriverId.rating
              }
            : null
    }));

    return { success: true, count: result.length, bookings: result };
};

/**
 * Customer: booking details.
 */
exports.getCustomerBookingById = async (customerId, bookingId) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customerId
    })
        .populate("assignedDriverId", "fullName profilePhoto rating mobileNumber");

    if (!booking) throw new Error("Booking not found");

const requests = await BookingDriverRequest.find({ bookingId: booking._id })
        .populate("driverId", "fullName profilePhoto rating")
        .select("driverId requestStatus rejectionReason");

    const existingRating = await Rating.findOne({ bookingId: booking._id });

    return {
        success: true,
        booking: {
            id: booking._id,
            bookingNumber: booking.bookingNumber,
            status: booking.bookingStatus,
            fromDate: booking.fromDate,
            toDate: booking.toDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            pickupAddress: booking.pickupAddress,
            dropAddress: booking.dropAddress,
            amount: booking.estimatedFare,
            durationHours: booking.estimatedDuration,
            paymentStatus: booking.paymentStatus,
            amountDue: booking.amountDue || 0,
            cancellationFee: booking.cancellationFee || 0,
            noShowFee: booking.noShowFee || 0,
            unavailabilityReason: booking.unavailabilityReason || "",
            unavailabilityDescription: booking.unavailabilityDescription || "",
            noShowWindowEndsAt: booking.noShowWindowEndsAt || null,
            reassignmentDeadline: booking.reassignmentDeadline || null,
            replacementSearchStartedAt: booking.replacementSearchStartedAt || null,
            tripStartedAt: booking.tripStartedAt,
            flowStatus: booking.flowStatus,
            driverAssignmentStatus: booking.driverAssignmentStatus,
            startedAt: booking.startedAt,
            completedAt: booking.completedAt,
            actualHours: booking.actualHours,
            actualFare: booking.actualFare,
            fareBreakup: booking.fareBreakup || {},
            driverEarning: booking.driverEarning,
            startOtpVerified: booking.startOtpVerified,
            startOtpExpiresAt: booking.startOtpExpiresAt,
endOtpVerified: booking.endOtpVerified,
            endOtpExpiresAt: booking.endOtpExpiresAt,
            rated: !!existingRating,
            rating: existingRating
                ? {
                      stars: existingRating.stars,
                      comment: existingRating.comment
                  }
                : null,
            driver: booking.assignedDriverId
                ? {
                      driverId: booking.assignedDriverId._id,
                      fullName: booking.assignedDriverId.fullName,
                      profilePhoto: booking.assignedDriverId.profilePhoto,
                      rating: booking.assignedDriverId.rating
                  }
                : null
        },
        driver_requests: requests.map((r) => ({
            driver_id: r.driverId ? r.driverId._id : r.driverId,
            driver_name: r.driverId ? r.driverId.fullName : null,
            status: r.requestStatus,
            rejection_reason: r.rejectionReason
        }))
    };
};

/**
 * Driver: upcoming confirmed bookings.
 */
exports.getDriverUpcoming = async (driverId) => {
    const bookings = await Booking.find({
        assignedDriverId: driverId,
        bookingStatus: { $in: ["CONFIRMED", "ONGOING"] }
    })
        .populate("customerId", "name phone email profileImage")
        .sort({ createdAt: -1 });

    const result = bookings.map((b) => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        status: b.bookingStatus,
        fromDate: b.fromDate,
        toDate: b.toDate,
        startTime: b.startTime,
        endTime: b.endTime,
        pickupAddress: b.pickupAddress,
        dropAddress: b.dropAddress,
        amount: b.estimatedFare,
        flowStatus: b.flowStatus,
        driverAssignmentStatus: b.driverAssignmentStatus,
        startedAt: b.startedAt,
        customer: b.customerId
            ? {
                  name: b.customerId.name,
                  phone: b.customerId.phone,
                  profileImage: b.customerId.profileImage
              }
            : null
    }));

    return { success: true, count: result.length, bookings: result };
};

/**
 * Customer: list bookings by status (comma-separated) with request summaries.
 */

/**
 * Customer: generate a start/end OTP for their trip. In-app only.
 * The customer reads it to the driver, who enters it in the driver app.
 */
exports.generateTripOtp = async ({ customerId, bookingId }) => {
    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) throw new Error("Booking not found");

    if (!booking.assignedDriverId && !booking.driverId) {
        throw new Error("No driver assigned to this booking yet");
    }

    return otpService.generateOtp({
        bookingId,
        customerId,
        driverId: booking.assignedDriverId || booking.driverId
    });
};

/**
 * Driver: start a trip by entering the start OTP the customer showed them.
 * Enforced start-gate: the trip may only start on the `fromDate` calendar
 * date (any time that day).
 */
exports.driverStartTrip = async ({ driverId, bookingId, enteredOtp }) => {
    return otpService.verifyOtp({
        bookingId,
        driverId,
        enteredOtp,
        purpose: "start",
        onVerify: async (booking) => {
            const fromDate = booking.fromDate;
            if (fromDate) {
                const today = new Date();
                const same = sameDay(fromDate, today);
                if (!same) {
                    throw new Error(
                        "Trip can only start on the scheduled date (" +
                        new Date(fromDate).toDateString() +
                        ")"
                    );
                }
            }

            booking.bookingStatus = "ONGOING";
            booking.startOtpVerified = true;
            booking.startedAt = new Date();
            try {
                applyFlowStatus(booking, "DRIVER_ARRIVED", "driver");
            } catch (e) {
                // Arrival is expected whenever the driver used the arrival flow.
            }
            applyFlowStatus(booking, "TRIP_STARTED", "driver");
            booking.driverAssignmentStatus = "TRIP_STARTED";
            if (!booking.driverArrivedAt) {
                booking.driverArrivedAt = new Date();
            }
            booking.noShowWindowEndsAt = null;
        }
    });
};

/**
 * Driver: end a trip by entering the end OTP. Computes the final fare
 * from the billable duration, and records the driver's earnings on the
 * booking. Platform/signal vs. estimated fare difference is handled by
 * keeping `actualFare` (final billing) separate from `estimatedFare`.
 */
exports.driverEndTrip = async ({ driverId, bookingId, enteredOtp }) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        $or: [{ assignedDriverId: driverId }, { driverId }],
        bookingStatus: "ONGOING"
    });
    if (!booking) {
        throw new Error("Active trip not found for this driver");
    }

    const startedAt = booking.startedAt;
    if (!startedAt) {
        throw new Error("Trip has no start timestamp");
    }

    const minutes = Math.max(
        1,
        Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
    );

    const fare = await pricing.computeActualFare({ minutes });

    return otpService.verifyOtp({
        bookingId,
        driverId,
        enteredOtp,
        purpose: "end",
        onVerify: async (b) => {
            b.bookingStatus = "Completed";
            b.endOtpVerified = true;
            b.completedAt = new Date();
            applyFlowStatus(b, "TRIP_COMPLETED", "driver");
            applyFlowStatus(b, "FARE_CALCULATED", "system");

            b.actualHours = fare.billableHours;
            b.actualFare = fare.total;
            b.driverEarning = fare.baseFare;

            b.fareBreakup = b.fareBreakup || {};
            b.fareBreakup.billableHours = fare.billableHours;
            b.fareBreakup.baseFare = fare.baseFare;
            b.fareBreakup.platformFee = fare.platformFee;
            b.fareBreakup.taxGst = fare.taxGst;
            b.fareBreakup.total = fare.total;
            b.fareBreakup.perHourRate = fare.perHourRate;

await Driver.findByIdAndUpdate(driverId, {
                accountStatus: "Online",
                isAvailable: true,
                currentBookingId: null,
                $inc: { totalTrips: 1 }
            });

const result = {
                billableHours: fare.billableHours,
                baseFare: fare.baseFare,
                platformFee: fare.platformFee,
                taxGst: fare.taxGst,
                total: fare.total,
                perHourRate: fare.perHourRate,
                completedAt: b.completedAt
            };
            b._fareSnapshot = result;

            notifyBookingEnded(bookingId, "completed");
            bookingMail.sendTripCompletionEmails(b);
        }
    }).then((res) => {
        if (res && res.booking && res.booking._fareSnapshot) {
            res.fare = res.booking._fareSnapshot;
            delete res.booking._fareSnapshot;
        }
        return res;
    });
};

/**
 * Customer: create a Razorpay Payment Link for the completed trip fare.
 * Returns a shortLinking URL the app opens with Linking.openURL().
 */
exports.initiatePayment = async ({ customerId, bookingId, returnUrl }) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customerId,
        bookingStatus: "Completed"
    }).populate("assignedDriverId", "fullName mobileNumber");

    if (!booking) {
        throw new Error("Completed booking not found");
    }
    if (booking.paymentStatus === "Paid") {
        throw new Error("Payment already completed for this booking");
    }

    const amountPaisa = Math.round((booking.actualFare || booking.estimatedFare || 0) * 100);

    if (!razorpay.isConfigured()) {
        throw new Error(
            "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Backend/.env"
        );
    }

    const customer = await Customer.findById(customerId).select("name email phone mobileNumber");

    const baseUrl = process.env.PUBLIC_BASE_URL;
    const link = await razorpay.createPaymentLink({
        amountInPaise: amountPaisa,
        description: `DriveGo booking ${booking.bookingNumber}`,
        customerName: (customer && (customer.name || customer.fullName)) || "DriveGo Customer",
        customerEmail: (customer && customer.email) || "",
        customerPhone: (customer && (customer.phone || customer.mobileNumber)) || "",
        callbackUrl: `${baseUrl}/api/action/payments/pay-link/callback`
    });

    // `.id` (e.g. "pl_...") is used for server-side verification of the link.
    booking.paymentOrderId = (link && link.order_id) || "";
    booking.paymentLinkId = (link && link.id) || "";
    await booking.save();

    return {
        success: true,
        amount: amountPaisa / 100,
        orderId: booking.paymentOrderId,
        shortUrl: link && link.short_url ? link.short_url : "",
        paymentLinkId: booking.paymentLinkId
    };
};

/**
 * Payment-link callback (GET, hit by the payer's browser after payment).
 * Verifies server-side with Razorpay before marking the booking Paid, so a
 * forged callback cannot flip a pending booking to paid.
 */
exports.handlePaymentLinkCallback = async (paymentLinkId) => {
    if (!paymentLinkId) throw new Error("Missing payment link id");

    const booking = await Booking.findOne({ paymentLinkId });
    if (!booking) return { success: false, message: "Unknown payment link" };
    if (booking.paymentStatus === "Paid") {
        return { success: true, message: "Payment already completed.", booking };
    }

    if (!razorpay.isConfigured()) {
        return { success: false, message: "Razorpay is not configured on the server." };
    }

    let link;
    try {
        link = await razorpay.fetchPaymentLink(paymentLinkId);
    } catch (e) {
        return { success: false, message: "Could not verify payment status with Razorpay." };
    }

if (link && link.status === "paid") {
        booking.paymentStatus = "Paid";
        booking.paymentGatewayId = link.payment_id || booking.paymentGatewayId;
        await booking.save();
        bookingMail.sendPaymentReceiptEmails(booking);
        return { success: true, message: "Payment verified successfully.", booking };
    }

    return { success: true, message: "Payment pending.", booking, status: link && link.status };
};

/**
 * Customer: verify the Razorpay payment signature. On success, mark the
 * booking Paid. Uses an atomic update so the driver's payout/earning record
 * and the booking state are only flipped on a valid, signed payment.
 */
exports.verifyPayment = async ({ customerId, bookingId, razorpayOrderId, razorpayPaymentId, signature }) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customerId,
        paymentStatus: { $ne: "Paid" }
    });
    if (!booking) {
        throw new Error("Booking not found or already paid");
    }

    const ok = razorpay.verifySignature({
        orderId: String(booking.paymentOrderId || razorpayOrderId),
        paymentId: razorpayPaymentId,
        signature
    });
    if (!ok) {
        throw new Error("Invalid payment signature");
    }

await Booking.updateOne(
        { _id: booking._id, paymentStatus: { $ne: "Paid" } },
        {
            paymentStatus: "Paid",
            paymentGatewayId: razorpayPaymentId || "",
            paymentSignature: signature || ""
        }
    );

    booking.paymentStatus = "Paid";
    booking.paymentGatewayId = razorpayPaymentId || "";
    bookingMail.sendPaymentReceiptEmails(booking);

    return { success: true, message: "Payment verified successfully." };
};

/**
 * Customer: fetch latest fare + payment status for a completed trip.
 */
exports.getTripFare = async ({ customerId, bookingId }) => {
    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) throw new Error("Booking not found");

    return {
        success: true,
        booking: {
            id: booking._id,
            bookingNumber: booking.bookingNumber,
status: booking.bookingStatus,
        flowStatus: booking.flowStatus,
        driverAssignmentStatus: booking.driverAssignmentStatus,
        paymentStatus: booking.paymentStatus,
        actualHours: booking.actualHours,
        fareBreakup: booking.fareBreakup || {},
            actualFare: booking.actualFare,
            estimatedFare: booking.estimatedFare,
            startedAt: booking.startedAt,
            completedAt: booking.completedAt,
            driverEarning: booking.driverEarning
        }
    };
};

/**
 * Customer: list bookings by status (comma-separated) with request summaries.
 */
exports.getCustomerBookings = async (customerId, status) => {
    const statuses = status
        ? String(status).split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const filter = { customerId };
    if (statuses.length) filter.bookingStatus = { $in: statuses };

    const bookings = await Booking.find(filter)
        .populate("assignedDriverId", "fullName profilePhoto rating mobileNumber")
        .sort({ createdAt: -1 });

const requestDocs = await BookingDriverRequest.find({
        bookingId: { $in: bookings.map((b) => b._id) }
    })
        .populate("driverId", "fullName profilePhoto rating")
        .select("bookingId driverId requestStatus rejectionReason");

    const cfg = await pricing.getConfig();
    const perHourRate = cfg.actingDriverPerHourRate || 210;

    const byBooking = {};
    requestDocs.forEach((r) => {
        const key = r.bookingId.toString();
        if (!byBooking[key]) byBooking[key] = [];
        byBooking[key].push({
            driver_id: r.driverId ? r.driverId._id : r.driverId,
            driver_name: r.driverId ? r.driverId.fullName : null,
            status: r.requestStatus,
            rejection_reason: r.rejectionReason || null
        });
    });

const result = bookings.map((b) => {
        const requests = byBooking[b._id.toString()] || [];
        return {
            id: b._id,
            bookingNumber: b.bookingNumber,
            status: b.bookingStatus,
            fromDate: b.fromDate,
            toDate: b.toDate,
            startTime: b.startTime,
            endTime: b.endTime,
            pickupAddress: b.pickupAddress,
            dropAddress: b.dropAddress,
            amount: b.estimatedFare,
            durationHours: b.estimatedDuration,
            flowStatus: b.flowStatus,
            startedAt: b.startedAt,
            perHourRate: perHourRate,
            driverAssignmentStatus: b.driverAssignmentStatus,
            bookingCreatedAt: b.createdAt,
            tripType: b.tripType,
            paymentStatus: b.paymentStatus,
            acceptedAt: b.acceptedAt,
            completedAt: b.completedAt,
cancelledAt: b.cancelledAt,
            cancelledBy: b.cancelledBy,
            cancelReason: b.cancelReason,
            unavailabilityReason: b.unavailabilityReason || "",
            unavailabilityDescription: b.unavailabilityDescription || "",
            amountDue: b.amountDue || 0,
            cancellationFee: b.cancellationFee || 0,
            noShowFee: b.noShowFee || 0,
            driver: b.assignedDriverId
                ? {
                      driverId: b.assignedDriverId._id,
                      fullName: b.assignedDriverId.fullName,
                      profilePhoto: b.assignedDriverId.profilePhoto,
                      rating: b.assignedDriverId.rating
                  }
                : null,
            requestSummary: {
                total: requests.length,
                pending: requests.filter((r) => r.status === "PENDING").length,
                accepted: requests.filter((r) => r.status === "ACCEPTED").length,
                rejected: requests.filter((r) => r.status === "REJECTED").length,
                expired: requests.filter((r) => r.status === "EXPIRED").length
            },
            requests
        };
    });

    return { success: true, count: result.length, bookings: result };
};

/**
 * Customer cancels a booking with a reason. Backend-computes the cancellation
 * fee (Pay After Service => amount due, never a refund/refund amount). Atomic
 * single-winner claim: exactly one cancel / reassign transition can land.
 */
exports.cancelBooking = async (customerId, bookingId, reason) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customerId
    });
    if (!booking) throw new Error("Booking not found");

    if (booking.bookingStatus === "ONGOING") {
        const err = new Error("Trip has already started and cannot be cancelled.");
        err.code = "CANCELLATION_NOT_ALLOWED";
        throw err;
    }

    if (!["PENDING", "CONFIRMED", "NO_DRIVER_AVAILABLE"].includes(booking.bookingStatus)) {
        throw new Error("Booking cannot be cancelled in its current state");
    }

    const cfg = await pricing.getConfig();
    const { cancellationFee, driverArrived } = await cancellationPolicy.computeCancellationFee(booking, cfg);
    const amountDue = cancellationFee || 0;
    const wasConfirmed = ["CONFIRMED"].includes(booking.bookingStatus);
    const beforeStatus = booking.flowStatus || booking.bookingStatus;
    const hadDriver = booking.assignedDriverId || booking.driverId || null;
    const now = new Date();

    const claim = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            customerId,
            bookingStatus: { $in: ["PENDING", "CONFIRMED", "NO_DRIVER_AVAILABLE"] }
        },
        {
            $set: {
                bookingStatus: "CANCELLED",
                flowStatus: "CUSTOMER_CANCELLED",
                driverAssignmentStatus: hadDriver ? "CANCELLED" : booking.driverAssignmentStatus,
                cancelledBy: "Customer",
                cancelReason: reason || "Cancelled by customer",
                cancelledAt: now,
                amountDue,
                cancellationFee,
                noShowWindowEndsAt: null,
                replacementSearchStartedAt: null,
                reassignmentDeadline: null
            },
            $push: {
                flowStatusHistory: { status: "CUSTOMER_CANCELLED", at: now, by: "customer" }
            }
        },
        { returnDocument: "after" }
    );
    if (!claim) {
        throw new Error("Booking was already cancelled or modified.");
    }

    // Close any still-pending driver requests for this booking.
    await BookingDriverRequest.updateMany(
        { bookingId: booking._id, requestStatus: "PENDING" },
        { requestStatus: "CANCELLED" }
    );

    // If a driver was already confirmed, free them so they can take other trips.
    if (wasConfirmed && hadDriver) {
        await Driver.findByIdAndUpdate(hadDriver, {
            accountStatus: "Online",
            isAvailable: true,
            currentBookingId: null
        });
    }

    // One immutable cancellation record (customer cancels once per booking).
    await reassignment.createCancellationRecord({
        booking: claim,
        driverId: hadDriver,
        cancelledBy: "CUSTOMER",
        reason: reason || "cancelled by customer",
        driverArrived,
        cancellationFee,
        amountDue
    });

logger.logEvent("customer_cancelled", {
        bookingId: claim._id,
        driverId: hadDriver,
        oldStatus: beforeStatus,
        newStatus: "CUSTOMER_CANCELLED",
        reason: reason || "",
        meta: { cancellationFee, amountDue }
    });

    notifyBookingEnded(claim._id, "cancelled");

    return {
        success: true,
        message: "Booking cancelled successfully.",
        refundAmount: 0,
        cancellationFee,
        amountDue,
        paymentStatus: amountDue > 0 ? "Pending" : claim.paymentStatus
    };
};

/**
 * Customer: preview the cancellation fee WITHOUT cancelling (decision support).
 */
exports.previewCancellation = async (customerId, bookingId) => {
    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) throw new Error("Booking not found");

    if (booking.bookingStatus === "ONGOING") {
        const err = new Error("Trip has already started and cannot be cancelled.");
        err.code = "CANCELLATION_NOT_ALLOWED";
        throw err;
    }
    if (!["PENDING", "CONFIRMED", "NO_DRIVER_AVAILABLE"].includes(booking.bookingStatus)) {
        throw new Error("Booking cannot be cancelled in its current state");
    }

    const cfg = await pricing.getConfig();
    const { cancellationFee, driverArrived } = await cancellationPolicy.computeCancellationFee(booking, cfg);

    return {
        success: true,
        cancelling: true,
        refundAmount: 0,
        cancellationFee,
        amountDue: cancellationFee,
        driverArrived,
        estimatedFare: booking.estimatedFare || 0,
        paymentStatus: cancellationFee > 0 ? "Pending" : booking.paymentStatus
    };
};

/**
 * Driver reports they can no longer complete the booking. This NEVER hard-cancels:
 * it marks the driver UNAVAILABLE, frees them, then runs the reassignment engine
 * (find -> offer -> accept, or -> SYSTEM_CANCELLED if no replacement / deadline).
 */
exports.driverUnavailable = async (driverId, bookingId, { reason = "", description = "" } = {}) => {
    if (reason && !reassignment.UNAVAILABILITY_REASONS.includes(reason)) {
        throw new Error("Invalid driver unavailability reason");
    }
    return reassignment.triggerReassignment({
        bookingId,
        driverId,
        reason,
        description,
        by: "driver"
    });
};

// Backwards-compatible alias: the old /drivers/bookings/:id/cancel route.
exports.driverCancelBooking = async (driverId, bookingId, reason = "") => {
    const found = await Booking.findById(bookingId);
    if (!found) throw new Error("Booking not found");

    const assigned =
        (found.assignedDriverId && found.assignedDriverId._id)
            ? String(found.assignedDriverId._id)
            : String(found.assignedDriverId || found.driverId || "");
    if (assigned !== String(driverId)) {
        throw new Error("This driver is not assigned to this booking");
    }

    if (found.bookingStatus === "ONGOING") {
        const err = new Error("Trip has already started and cannot be cancelled.");
        err.code = "CANCELLATION_NOT_ALLOWED";
        throw err;
    }

    // Strike policy: X cancels/skips allowed, the next one is restricted.
    await driverPolicy.assertNotRestricted(driverId);

    // Acting-driver flow: a driver cancel on a confirmed trip must NEVER
    // hard-cancel the customer's booking. Route it through the reassignment
    // engine so a replacement is searched and the booking survives; it is only
    // system-cancelled as a last-resort fallback when no replacement can be
    // found before the deadline (see failReplacement).
    if (reassignment.REASSIGNABLE_STATUSES.includes(found.flowStatus)) {
        const mapped = reassignment.UNAVAILABILITY_REASONS.includes(reason)
            ? reason
            : "DRIVER_OTHER";
        const description =
            reason && !reassignment.UNAVAILABILITY_REASONS.includes(reason)
                ? `Driver cancelled: ${reason}`
                : "";
        const result = await reassignment.triggerReassignment({
            bookingId,
            driverId,
            reason: mapped,
            description,
            by: "driver"
        });
        // Ledger the driver strike (the search itself may still save the trip).
        await reassignment.createCancellationRecord({
            booking: found,
            driverId,
            cancelledBy: "DRIVER",
            reason: reason || "cancelled by driver",
            driverArrived: found.flowStatus === "DRIVER_ARRIVED",
            cancellationFee: 0,
            amountDue: 0
        });
        logger.logEvent("driver_cancelled_to_reassign", {
            bookingId: String(bookingId),
            driverId: String(driverId),
            oldStatus: found.flowStatus || found.bookingStatus,
            newStatus: "DRIVER_REASSIGNING",
            reason: reason || ""
        });
        return {
            success: true,
            message: "Trip cancel accepted — a replacement driver will be assigned to the customer.",
            reassigning: true,
            ...result
        };
    }

    if (!["PENDING", "CONFIRMED", "NO_DRIVER_AVAILABLE"].includes(found.bookingStatus)) {
        throw new Error("Booking cannot be cancelled in its current state");
    }

    const now = new Date();
    const claim = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            bookingStatus: { $in: ["PENDING", "CONFIRMED", "NO_DRIVER_AVAILABLE"] },
            $or: [{ assignedDriverId: driverId }, { driverId }]
        },
        {
            $set: {
                bookingStatus: "CANCELLED",
                flowStatus: "DRIVER_CANCELLED",
                driverAssignmentStatus: "CANCELLED",
                cancelledBy: "Driver",
                cancelReason: reason || "Cancelled by driver",
                cancelledAt: now,
                amountDue: 0,
                cancellationFee: 0,
                noShowWindowEndsAt: null,
                replacementSearchStartedAt: null,
                reassignmentDeadline: null
            },
            $push: {
                flowStatusHistory: { status: "DRIVER_CANCELLED", at: now, by: "driver" }
            }
        },
        { returnDocument: "after" }
    );

    if (!claim) {
        throw new Error("Booking was already cancelled or modified.");
    }

    // Close any still-pending driver requests for this booking.
    await BookingDriverRequest.updateMany(
        { bookingId: bookingId, requestStatus: "PENDING" },
        { requestStatus: "CANCELLED" }
    );

    // Free the driver so they can take other trips.
    await Driver.findByIdAndUpdate(driverId, {
        accountStatus: "Online",
        isAvailable: true,
        currentBookingId: null
    });

    // One immutable cancellation record (driver cancels once per booking).
    await reassignment.createCancellationRecord({
        booking: claim,
        driverId,
        cancelledBy: "DRIVER",
        reason: reason || "cancelled by driver",
        driverArrived: false,
        cancellationFee: 0,
        amountDue: 0
    });

    logger.logEvent("driver_cancelled", {
        bookingId: claim._id,
        driverId,
        oldStatus: found.flowStatus || found.bookingStatus,
        newStatus: "DRIVER_CANCELLED",
        reason: reason || ""
    });

    notifyBookingEnded(claim._id, "cancelled");

    return {
        success: true,
        message: "Booking cancelled successfully.",
        booking: {
            id: claim._id,
            bookingNumber: claim.bookingNumber,
            status: "CANCELLED",
            cancelledBy: "Driver",
            cancelReason: claim.cancelReason,
            cancelledAt: claim.cancelledAt
        }
    };
};

/**
 * Driver: complete trip history for the Trips screen — every booking this
 * driver was ever assigned (scheduled, running, completed, cancelled) with all
 * detail fields, so cancelled/completed trips stay visible for future use.
 */
exports.getDriverHistory = async (driverId) => {
    const bookings = await Booking.find({
        $or: [{ assignedDriverId: driverId }, { driverId }],
        bookingStatus: { $nin: ["PENDING", "Searching", "Assigned", "NO_DRIVER_AVAILABLE", "EXPIRED", "Searching"] }
    })
        .populate("customerId", "name phone email profileImage fullName")
        .sort({ createdAt: -1 });

    const result = bookings.map((b) => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        status: b.bookingStatus,
        flowStatus: b.flowStatus,
        driverAssignmentStatus: b.driverAssignmentStatus,
        fromDate: b.fromDate,
        toDate: b.toDate,
        startTime: b.startTime,
        endTime: b.endTime,
        pickupAddress: b.pickupAddress,
        dropAddress: b.dropAddress,
        pickupLocation: b.pickupLocation || null,
        dropLocation: b.dropLocation || null,
        amount: b.estimatedFare,
        tripType: b.tripType,
        acceptedAt: b.acceptedAt,
        startedAt: b.startedAt,
        completedAt: b.completedAt,
        cancelledAt: b.cancelledAt,
        cancelledBy: b.cancelledBy,
        cancelReason: b.cancelReason,
        actualFare: b.actualFare,
        actualHours: b.actualHours,
        driverEarning: b.driverEarning,
        createdBookingAt: b.createdAt,
        customer: b.customerId
            ? {
                name: b.customerId.name || b.customerId.fullName || "Customer",
                phone: b.customerId.phone || "",
                profileImage: b.customerId.profileImage || ""
            }
            : null
    }));

    return { success: true, count: result.length, bookings: result };
};

/**
 * Driver: requests this driver REJECTED/SKIPPED (acting-driver offers +
 * direct driver requests), plus the current skip balance. Lets the driver
 * app render a "Rejected by me" history with a live skip/strike banner.
 */
exports.getDriverRejectedRequests = async (driverId) => {
    const CustomerDriverRequest = require("../models/CustomerDriverRequest");

    const [actionRejects, directRejects] = await Promise.all([
        BookingDriverRequest.find({ driverId, requestStatus: "REJECTED" })
            .populate("customerId", "name phone profileImage")
            .sort({ rejectedAt: -1 }),
        CustomerDriverRequest.find({ driverId, requestStatus: "Rejected" })
            .populate("customerId", "name phone profileImage")
            .sort({ updatedAt: -1 })
    ]);

    const list = [];

    actionRejects.forEach((r) => {
        const customer = r.customerId || {};
        list.push({
            id: r._id,
            type: "action",
            bookingNumber: r.bookingNumber || "",
            customer: customer.name || "Customer",
            photo: customer.profileImage || "",
            pickup: r.pickupAddress || "Pickup location",
            drop: r.dropAddress || "Drop location",
            amount: r.estimatedAmount || 0,
            durationHours: r.estimatedDurationHours || 0,
            fromDate: r.fromDate,
            startTime: r.startTime,
            endTime: r.endTime,
            rejectedAt: r.rejectedAt || r.updatedAt || r.createdAt || null,
            reason: r.rejectionReason || ""
        });
    });

    directRejects.forEach((r) => {
        const customer = r.customerId || {};
        list.push({
            id: r._id,
            type: "direct",
            bookingNumber: "",
            customer: customer.name || "Customer",
            photo: customer.profileImage || "",
            pickup: r.pickupAddress || "Pickup location",
            drop: r.dropAddress || "Drop location",
            amount: r.estimatedFare || 0,
            durationHours: 0,
            fromDate: r.requestedAt || r.createdAt || null,
            startTime: "",
            endTime: "",
            rejectedAt: r.updatedAt || r.rejectedAt || r.createdAt || null,
            reason: "Request skipped by driver"
        });
    });

    list.sort((a, b) => new Date(b.rejectedAt || 0) - new Date(a.rejectedAt || 0));

    return {
        success: true,
        count: list.length,
        rejected: list,
        strikePolicy: await driverPolicy.getStrikeSummary(driverId)
    };
};

/**
 * Driver: mark the booking as "heading to pickup".
 */
exports.driverMarkEnRoute = async (driverId, bookingId) => {
    const updated = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            assignedDriverId: driverId,
            bookingStatus: "CONFIRMED",
            flowStatus: { $in: ["DRIVER_CONFIRMED", "DRIVER_REASSIGNED"] }
        },
        {
            $set: { flowStatus: "DRIVER_EN_ROUTE", driverAssignmentStatus: "EN_ROUTE" },
            $push: { flowStatusHistory: { status: "DRIVER_EN_ROUTE", at: new Date(), by: "driver" } }
        },
        { returnDocument: "after" }
    );
    if (!updated) {
        const err = new Error("Booking is not ready for the driver to head to pickup");
        err.code = "INVALID_STATE";
        throw err;
    }

    await reassignment.recordHistory({
        bookingId: updated._id,
        driverId,
        status: "EN_ROUTE",
        reason: "driver heading to pickup",
        by: "driver"
    });

    return { success: true, message: "Driver en route.", flowStatus: "DRIVER_EN_ROUTE" };
};

/**
 * Driver: mark arrival at pickup. Starts the customer no-show window so an
 * unattended pickup is auto-processed (NO_SHOW + fee) after noShowWaitMinutes.
 */
exports.driverMarkArrived = async (driverId, bookingId) => {
    const cfg = await pricing.getConfig();
    const now = new Date();
    const noShowWindowEndsAt = new Date(now.getTime() + ((cfg.noShowWaitMinutes || 15) * 60000));

    const updated = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            assignedDriverId: driverId,
            bookingStatus: "CONFIRMED",
            flowStatus: { $in: ["DRIVER_CONFIRMED", "DRIVER_EN_ROUTE", "DRIVER_REASSIGNED"] }
        },
        {
            $set: {
                flowStatus: "DRIVER_ARRIVED",
                driverAssignmentStatus: "ARRIVED",
                driverArrivedAt: now,
                noShowWindowEndsAt
            },
            $push: { flowStatusHistory: { status: "DRIVER_ARRIVED", at: now, by: "driver" } }
        },
        { returnDocument: "after" }
    );
    if (!updated) {
        throw new Error("Booking is not in a state where the driver can arrive");
    }

    await reassignment.recordHistory({
        bookingId: updated._id,
        driverId,
        status: "ARRIVED",
        reason: "driver arrived at pickup",
        by: "driver"
    });

    return {
        success: true,
        message: "Driver arrived at pickup.",
        flowStatus: "DRIVER_ARRIVED",
        noShowWindowEndsAt: updated.noShowWindowEndsAt
    };
};

// Expose helper for reuse
exports.isDriverFree = isDriverFree;
exports.bookingDays = bookingDays;

/**
 * Customer: rate the driver of a completed trip. One rating per booking
 * (enforced by the Rating schema's unique index in a single-winner claim).
 * Recomputes the driver's running average rating + rating count so the
 * driver's performance score stays live.
 */
exports.rateTrip = async ({ customerId, bookingId, stars, comment }) => {
    const s = Number(stars);
    if (!Number.isInteger(s) || s < 1 || s > 5) {
        throw new Error("Rating must be between 1 and 5 stars");
    }

    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) throw new Error("Booking not found");

    if (booking.bookingStatus !== "Completed") {
        throw new Error("You can only rate a completed trip");
    }

    const driverId = booking.assignedDriverId || booking.driverId;
    if (!driverId) throw new Error("No driver assigned to this trip");

    let rating;
    try {
        rating = await Rating.create({
            bookingId: booking._id,
            customerId,
            driverId,
            stars: s,
            comment: String(comment || "").trim()
        });
    } catch (err) {
        if (err && err.code === 11000) {
            throw new Error("You have already rated this trip");
        }
        throw err;
    }

    // Recompute the driver's average rating (atomic: sum + count are $inc'd,
    // so concurrent ratings can never skew the mean).
    const claim = await Driver.findOneAndUpdate(
        { _id: driverId },
        { $inc: { ratingSum: s, ratingCount: 1 } },
        { returnDocument: "after" }
    );

    if (claim) {
        const newAvg = claim.ratingSum / claim.ratingCount;
        await Driver.updateOne(
            { _id: driverId },
            { $set: { rating: Math.round(newAvg * 10) / 10 } }
        );
    }

    return {
        success: true,
        rating: {
            bookingId: rating.bookingId,
            driverId: rating.driverId,
            stars: rating.stars,
            comment: rating.comment,
            createdAt: rating.createdAt
        }
    };
};

