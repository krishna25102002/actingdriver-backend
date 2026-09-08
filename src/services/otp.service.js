const crypto = require("crypto");
const Booking = require("../models/Booking");
const OTP = require("../models/OTP");

const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

const generateOtpCode = () => {
    return crypto.randomInt(1000, 10000).toString();
};

exports.generateOtp = async (bookingNumber, driverId) => {

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

exports.verifyOtp = async (bookingNumber, driverId, enteredOtp) => {

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