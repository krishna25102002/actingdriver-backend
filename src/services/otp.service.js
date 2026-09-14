const crypto = require("crypto");
const Booking = require("../models/Booking");
const OTP = require("../models/OTP");

const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

const generateOtpCode = () => {
    return crypto.randomInt(1000, 10000).toString();
};

// Determine the booking's current OTP purpose ("start" or "end").
// start -> booking is CONFIRMED (not yet started).
// end   -> booking is ONGOING (trip running).
const getPurposeForBooking = (booking) => {
    if (booking && booking.bookingStatus === "ONGOING") return "end";
    return "start";
};

/**
 * ============================
 * NEW ACTION-FLOW OTP (object args)
 * ============================
 */

/**
 * Generate an OTP for an acting-driver trip.
 * - `bookingId` + `driverId` + `customerId` pin the caller to the booking.
 * - The customer generates it in-app and reads it to the driver.
 * - 5-minute validity, single-use per purpose, allows regeneration.
 */
exports.generateOtp = async ({ bookingId, driverId, customerId } = {}) => {
    if (typeof bookingId === "string" && !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
        // Legacy call: generateOtp(bookingNumber, driverId)
        return generateLegacyOtp(bookingId, driverId);
    }
    if (!bookingId) throw new Error("Booking ID is required");

    const booking = await Booking.findOne({
        _id: bookingId
    });

    if (!booking) {
        throw new Error("Booking not found for this user");
    }

    if (customerId) {
        if (String(booking.customerId) !== String(customerId)) {
            throw new Error("Booking not found for this user");
        }
    }
    if (driverId) {
        const isThisDriver =
            String(booking.assignedDriverId || booking.driverId || "") === String(driverId);
        if (!isThisDriver) {
            throw new Error("Booking not found for this driver");
        }
    }

    const purpose = getPurposeForBooking(booking);
    const validStatus = purpose === "start"
        ? booking.bookingStatus === "CONFIRMED"
        : booking.bookingStatus === "ONGOING";

    if (!validStatus) {
        throw new Error(
            purpose === "start"
                ? "Booking must be CONFIRMED to generate a start OTP"
                : "Trip must be started to generate an end OTP"
        );
    }

    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS);

    if (purpose === "start") {
        booking.startOtp = otp;
        booking.startOtpExpiresAt = expiresAt;
        booking.startOtpVerified = false;
    } else {
        booking.endOtp = otp;
        booking.endOtpExpiresAt = expiresAt;
        booking.endOtpVerified = false;
    }
    await booking.save();

    await OTP.updateMany(
        { bookingId: booking._id, purpose, isVerified: false },
        { isVerified: true, verifiedAt: new Date() }
    );
    await OTP.create({
        bookingId: booking._id,
        driverId: booking.assignedDriverId || booking.driverId || null,
        purpose,
        otp,
        expiresAt
    });

    return {
        success: true,
        message: purpose === "start"
            ? "Start OTP generated"
            : "End OTP generated",
        purpose,
        otp,
        expiresAt
    };
};

/**
 * Verify an OTP entered by the driver. `onVerify(booking)` applies the
 * side-effect (start/end). Returns `{ success, message, purpose, booking }`.
 */
exports.verifyOtp = async ({ bookingId, driverId, enteredOtp, purpose, onVerify } = {}) => {
    if (typeof bookingId === "string" && !/^[0-9a-fA-F]{24}$/.test(bookingId)) {
        // Legacy call: verifyOtp(bookingNumber, driverId, enteredOtp)
        return verifyLegacyOtp(bookingId, driverId, enteredOtp);
    }
    if (!bookingId) throw new Error("Booking ID is required");
    if (!enteredOtp) throw new Error("OTP is required");

    const booking = await Booking.findOne({
        _id: bookingId,
        assignedDriverId: driverId
    });

    if (!booking) {
        throw new Error("Booking not found for this driver");
    }

    const currentPurpose = purpose || getPurposeForBooking(booking);

    const stored = currentPurpose === "start"
        ? { code: booking.startOtp, exp: booking.startOtpExpiresAt, verified: booking.startOtpVerified }
        : { code: booking.endOtp, exp: booking.endOtpExpiresAt, verified: booking.endOtpVerified };

    const expectedStatus = currentPurpose === "start" ? "CONFIRMED" : "ONGOING";
    if (booking.bookingStatus !== expectedStatus) {
        throw new Error(
            currentPurpose === "start"
                ? "Booking must be CONFIRMED to start the trip"
                : "Trip must be ONGOING to end the trip"
        );
    }

    if (!stored.code || !stored.exp) {
        throw new Error("No OTP generated for this trip. Ask the customer to generate it.");
    }

    if (stored.verified) {
        throw new Error("OTP already used");
    }

    if (new Date() > new Date(stored.exp)) {
        throw new Error("OTP has expired. Ask the customer to generate a new one.");
    }

    if (String(stored.code) !== String(enteredOtp)) {
        throw new Error("Invalid OTP");
    }

    await onVerify(booking);

    await booking.save();

    await OTP.updateMany(
        { bookingId: booking._id, purpose: currentPurpose, isVerified: false },
        { isVerified: true, verifiedAt: new Date() }
    );

    return {
        success: true,
        message: currentPurpose === "start" ? "Trip started successfully" : "Trip ended successfully",
        purpose: currentPurpose,
        booking
    };
};

/**
 * ============================
 * LEGACY OTP (positional args, kept for /api/otp)
 * ============================
 */

// Legacy: generateOtp(bookingNumber, driverId)
const generateLegacyOtp = async (bookingNumber, driverId) => {
    const booking = await Booking.findOne({
        bookingNumber,
        driverId,
        bookingStatus: { $in: ["Accepted", "Reached Pickup"] }
    });

    if (!booking) {
        throw new Error("Booking not found or not accepted");
    }

    const otp = generateOtpCode();

    booking.otp = otp;
    booking.otpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);
    booking.otpVerified = false;
    booking.tripStatus = "Reached Pickup";

    await booking.save();

    await OTP.create({
        bookingId: booking._id,
        driverId,
        otp,
        expiresAt: booking.otpExpiresAt
    });

    return {
        success: true,
        message: "OTP Generated Successfully",
        otp,
        expiresAt: booking.otpExpiresAt
    };
};

// Legacy: verifyOtp(bookingNumber, driverId, enteredOtp)
const verifyLegacyOtp = async (bookingNumber, driverId, enteredOtp) => {
    const booking = await Booking.findOne({
        bookingNumber,
        driverId,
        bookingStatus: { $in: ["Accepted", "Reached Pickup"] }
    });

    if (!booking) {
        throw new Error("Booking not found or not accepted");
    }

    if (!booking.otp || !booking.otpExpiresAt) {
        throw new Error("No OTP generated for this booking. Please generate OTP first.");
    }

    if (booking.otpVerified) {
        throw new Error("OTP already verified");
    }

    if (new Date() > new Date(booking.otpExpiresAt)) {
        throw new Error("OTP has expired. Please generate a new OTP.");
    }

    if (String(booking.otp) !== String(enteredOtp)) {
        throw new Error("Invalid OTP");
    }

    booking.otpVerified = true;
    booking.tripStatus = "OTP Verified";

    await booking.save();

    await OTP.updateMany(
        { bookingId: booking._id, isVerified: false },
        { isVerified: true, verifiedAt: new Date() }
    );

    return {
        success: true,
        message: "OTP Verified Successfully",
        booking
    };
};

module.exports = {
    generateOtp: exports.generateOtp,
    verifyOtp: exports.verifyOtp,
    OTP_VALIDITY_MS,
    getPurposeForBooking
};