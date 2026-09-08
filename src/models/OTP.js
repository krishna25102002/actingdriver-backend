const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({

    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
    },

    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
        required: true
    },

    otp: {
        type: String,
        required: true
    },

    expiresAt: {
        type: Date,
        required: true
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    verifiedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

otpSchema.index({ bookingId: 1, isVerified: 1 });

module.exports =
    mongoose.models.OTP ||
    mongoose.model("OTP", otpSchema);