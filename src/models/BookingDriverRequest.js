const mongoose = require("mongoose");

const bookingDriverRequestSchema = new mongoose.Schema({

    // The single main booking this request belongs to
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
    },

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true
    },

    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
        required: true
    },

    // Denormalized snapshot so the Driver App can render the request
    // without needing to join the full booking.
    bookingNumber: {
        type: String,
        required: true
    },

    fromDate: {
        type: Date
    },

    toDate: {
        type: Date
    },

    startTime: {
        type: String,
        default: ""
    },

    endTime: {
        type: String,
        default: ""
    },

    pickupAddress: {
        type: String,
        default: ""
    },

    dropAddress: {
        type: String,
        default: ""
    },

    estimatedAmount: {
        type: Number,
        default: 0
    },

    estimatedDurationHours: {
        type: Number,
        default: 0
    },

    vehicleType: {
        type: String,
        default: ""
    },

    requestStatus: {
        type: String,
        enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"],
        default: "PENDING"
    },

    rejectionReason: {
        type: String,
        default: ""
    },

    requestedAt: {
        type: Date,
        default: Date.now
    },

    expiresAt: {
        type: Date,
        default: null
    },

    acceptedAt: {
        type: Date,
        default: null
    },

    rejectedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

bookingDriverRequestSchema.index({ bookingId: 1, driverId: 1 });
bookingDriverRequestSchema.index({ driverId: 1, requestStatus: 1 });
bookingDriverRequestSchema.index({ bookingId: 1, requestStatus: 1 });

module.exports =
    mongoose.models.BookingDriverRequest ||
    mongoose.model("BookingDriverRequest", bookingDriverRequestSchema);
