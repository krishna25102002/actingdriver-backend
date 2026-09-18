const mongoose = require("mongoose");

// Complete, immutable history of every driver's involvement with a booking.
// Nothing here is ever deleted: it powers the "Driver A ASSIGNED -> UNAVAILABLE,
// Driver B OFFERED -> REJECTED, Driver D OFFERED -> ACCEPTED" style audit trail.
const driverAssignmentHistorySchema = new mongoose.Schema({

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

    // Stage of engagement for THIS driver/binding.
    status: {
        type: String,
        enum: [
            "OFFERED",
            "REJECTED",
            "EXPIRED",
            "CANCELLED",
            "ASSIGNED",
            "CONFIRMED",
            "EN_ROUTE",
            "ARRIVED",
            "TRIP_STARTED",
            "TRIP_COMPLETED",
            "UNAVAILABLE",
            "NO_SHOW"
        ],
        required: true
    },

    // Snapshot context: which request (null if not offer-based, e.g. admin reassign).
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookingDriverRequest",
        default: null
    },

    // Why this stage happened (e.g. reason code from the driver unavailable flow).
    reason: {
        type: String,
        default: ""
    },

    note: {
        type: String,
        default: ""
    },

    // Who made this assignment decision.
    by: {
        type: String,
        enum: ["customer", "driver", "system", "admin"],
        default: "system"
    },

    at: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

driverAssignmentHistorySchema.index({ bookingId: 1, driverId: 1, at: -1 });
driverAssignmentHistorySchema.index({ bookingId: 1, at: 1 });

module.exports =
    mongoose.models.DriverAssignmentHistory ||
    mongoose.model("DriverAssignmentHistory", driverAssignmentHistorySchema);