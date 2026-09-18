const mongoose = require("mongoose");

const cancellationSchema = new mongoose.Schema({

    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
    },

    // Who initiated the cancellation / failure.
    cancelledBy: {
        type: String,
        enum: ["CUSTOMER", "DRIVER", "SYSTEM", "ADMIN"],
        required: true
    },

    reason: {
        type: String,
        default: ""
    },

    description: {
        type: String,
        default: ""
    },

    // Booking state BEFORE the cancellation, e.g. "DRIVER_CONFIRMED".
    bookingStatusBefore: {
        type: String,
        default: ""
    },

    // The driver involved at the time of cancellation (null for pre-assign).
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
        default: null
    },

    // Whether the driver had already arrived at pickup.
    driverArrived: {
        type: Boolean,
        default: false
    },

    // Backend-computed fee / amount due (Pay After Service: amount due, no refund).
    cancellationFee: {
        type: Number,
        default: 0
    },

    amountDue: {
        type: Number,
        default: 0
    },

    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Refunded"],
        default: "Pending"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

cancellationSchema.index({ bookingId: 1 });
cancellationSchema.index({ bookingId: 1, cancelledBy: 1 });

module.exports =
    mongoose.models.Cancellation ||
    mongoose.model("Cancellation", cancellationSchema);