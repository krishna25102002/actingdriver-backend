const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const Driver = require("../models/Driver");
const Customer = require("../models/Customer");
const pricing = require("../utils/pricing");
const otpService = require("./otp.service");
const razorpay = require("./razorpay.service");

const generateBookingNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BK${year}${month}${day}${random}`;
};

// Normalize a time window to comparable minutes.
const timeToMinutes = (t) => {
    if (!t) return null;
    const s = String(t).trim().toUpperCase();
    const isPM = s.includes("PM");
    const isAM = s.includes("AM");
    const nums = s.replace(/\s*(AM|PM)\s*/i, "").split(":").map(Number);
    let h = nums[0] || 0;
    const m = nums[1] || 0;
    if (isNaN(h)) return null;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
};

// Check whether two time windows overlap (across a single booking day).
const windowsOverlap = (aStart, aEnd, bStart, bEnd) => {
    const a1 = timeToMinutes(aStart);
    const a2 = timeToMinutes(aEnd);
    const b1 = timeToMinutes(bStart);
    const b2 = timeToMinutes(bEnd);
    if (a1 == null || a2 == null || b1 == null || b2 == null) return false;

    let aA = a1, aB = a2;
    if (aB <= aA) aB += 24 * 60;
    let bA = b1, bB = b2;
    if (bB <= bA) bB += 24 * 60;

    return aA < bB && bA < aB;
};

// Are two calendar dates the same day? (ignores time-of-day)
const sameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
};

// Do the booking's days overlap the driver's busy day range?
const dayRangesOverlap = (reqFrom, reqTo, busyFrom, busyTo) => {
    const rf = reqFrom ? new Date(reqFrom).getTime() : -Infinity;
    const rt = reqTo ? new Date(reqTo).getTime() : Infinity;
    const bf = busyFrom ? new Date(busyFrom).getTime() : -Infinity;
    const bt = busyTo ? new Date(busyTo).getTime() : Infinity;
    return rf <= bt && bf <= rt;
};

// How many days does this booking span (inclusive)?
const bookingDays = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 1;
    const diff = Math.round((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
};

/**
 * Determine whether a driver is free for the requested date/time window.
 * A driver is busy if they have a CONFIRMED/ONGOING acting-driver booking
 * (or any overlapping active booking) whose window conflicts.
 */
const isDriverFree = async (driverId, fromDate, toDate, startTime, endTime) => {
    const conflicts = await Booking.find({
        assignedDriverId: driverId,
        bookingStatus: { $in: ["CONFIRMED", "ONGOING"] },
        fromDate: { $ne: null }
    }).select("fromDate toDate startTime endTime bookingStatus");

    for (const b of conflicts) {
        // Date ranges must overlap AND time windows must overlap.
        if (dayRangesOverlap(fromDate, toDate, b.fromDate, b.toDate)) {
            if (windowsOverlap(startTime, endTime, b.startTime, b.endTime)) {
                return false;
            }
        }
    }
    return true;
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
        "fullName profilePhoto rating experience totalTrips mobileNumber isAvailable location"
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
    const booking = await Booking.findOneAndUpdate(
        {
            _id: claimed.bookingId,
            bookingStatus: "PENDING"
        },
        {
            bookingStatus: "CONFIRMED",
            assignedDriverId: driverId,
            driverId,
            acceptedAt: new Date()
        },
        { returnDocument: "after" }
    );

    if (!booking) {
        // Booking already confirmed by someone else - roll back our claim.
        await BookingDriverRequest.findByIdAndUpdate(claimed._id, {
            requestStatus: "EXPIRED",
            acceptedAt: null
        });
        throw new Error("This booking has already been accepted by another driver.");
    }

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

    // Update driver availability to busy.
    await Driver.findByIdAndUpdate(driverId, {
        accountStatus: "Busy",
        isAvailable: false,
        currentBookingId: booking._id
    });

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

    request.requestStatus = "REJECTED";
    request.rejectionReason = reason || "Not available";
    request.rejectedAt = new Date();
    await request.save();

    // If all requests for this booking are no longer PENDING (all rejected/expired),
    // and the booking is still unconformed, mark it NO_DRIVER_AVAILABLE.
    const remaining = await BookingDriverRequest.countDocuments({
        bookingId: request.bookingId,
        requestStatus: "PENDING"
    });

    if (remaining === 0) {
        await Booking.updateOne(
            {
                _id: request.bookingId,
                bookingStatus: "PENDING"
            },
            { bookingStatus: "NO_DRIVER_AVAILABLE" }
        );
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

    return { success: true, count: result.length, requests: result };
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
            tripStartedAt: booking.tripStartedAt,
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
            if (!fromDate) {
                throw new Error("Booking has no start date");
            }

            const today = new Date();
            const same = sameDay(fromDate, today);
            if (!same) {
                throw new Error(
                    "Trip can only start on the scheduled date (" +
                    new Date(fromDate).toDateString() +
                    ")"
                );
            }

            booking.bookingStatus = "ONGOING";
            booking.startOtpVerified = true;
            booking.startedAt = new Date();
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
        assignedDriverId: driverId,
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
                currentBookingId: null
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
            bookingCreatedAt: b.createdAt,
            tripType: b.tripType,
            paymentStatus: b.paymentStatus,
            acceptedAt: b.acceptedAt,
            completedAt: b.completedAt,
            cancelledAt: b.cancelledAt,
            cancelledBy: b.cancelledBy,
            cancelReason: b.cancelReason,
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
 * Customer cancels a confirmed/pending booking with a reason.
 */
exports.cancelBooking = async (customerId, bookingId, reason) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        customerId
    });
    if (!booking) throw new Error("Booking not found");

    if (!["PENDING", "CONFIRMED", "ONGOING", "NO_DRIVER_AVAILABLE"].includes(booking.bookingStatus)) {
        throw new Error("Booking cannot be cancelled in its current state");
    }

    const wasConfirmed = ["CONFIRMED", "ONGOING"].includes(booking.bookingStatus);

    booking.bookingStatus = "CANCELLED";
    booking.cancelledBy = "Customer";
    booking.cancelReason = reason || "Cancelled by customer";
    booking.cancelledAt = new Date();
    await booking.save();

    // Close any still-pending driver requests for this booking.
    await BookingDriverRequest.updateMany(
        { bookingId: booking._id, requestStatus: "PENDING" },
        { requestStatus: "CANCELLED" }
    );

    // If a driver was already assigned, free them so they can take other trips.
    const assignedDriverId = booking.assignedDriverId || booking.driverId;
    if (wasConfirmed && assignedDriverId) {
        await Driver.findByIdAndUpdate(assignedDriverId, {
            accountStatus: "Online",
            isAvailable: true,
            currentBookingId: null
        });
    }

    return { success: true, message: "Booking cancelled successfully." };
};

/**
 * Driver cancels a confirmed booking with a reason.
 */
exports.driverCancelBooking = async (driverId, bookingId, reason) => {
    const booking = await Booking.findOne({
        _id: bookingId,
        assignedDriverId: driverId
    });
    if (!booking) throw new Error("Booking not found");
    if (!["CONFIRMED", "ONGOING"].includes(booking.bookingStatus)) {
        throw new Error("Booking cannot be cancelled in its current state");
    }

    booking.bookingStatus = "CANCELLED";
    booking.cancelledBy = "Driver";
    booking.cancelReason = reason || "Cancelled by driver";
    booking.cancelledAt = new Date();
    booking.assignedDriverId = null;
    await booking.save();

    // Free up the driver.
    await Driver.findByIdAndUpdate(driverId, {
        accountStatus: "Online",
        isAvailable: true,
        currentBookingId: null
    });

    return { success: true, message: "Booking cancelled successfully." };
};

// Expose helper for reuse
exports.isDriverFree = isDriverFree;
exports.bookingDays = bookingDays;
