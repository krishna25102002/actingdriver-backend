const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({

    bookingNumber: {
        type: String,
        unique: true,
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
        default: null
    },

    // Acting-driver booking flow: the single assigned driver (one per booking)
    assignedDriverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
        default: null
    },

    // Acting-driver booking flow: dates / times used for availability + amount
    fromDate: {
        type: Date,
        default: null
    },

    toDate: {
        type: Date,
        default: null
    },

    startTime: {
        type: String,
        default: ""
    },

    endTime: {
        type: String,
        default: ""
    },

    // Acting-driver booking flow: drivers the request was sent to (max 10)
    requestedDriverIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver"
    }],

    customerVehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        default: null
    },

    pickupAddress: {
        type: String,
        required: true
    },

    dropAddress: {
        type: String,
        default: ""
    },

    pickupLocation: {
        latitude: {
            type: Number,
            required: true
        },
        longitude: {
            type: Number,
            required: true
        }
    },

    dropLocation: {
        latitude: {
            type: Number,
            default: 0
        },
        longitude: {
            type: Number,
            default: 0
        }
    },

    estimatedDistance: {
        type: Number,
        default: 0
    },

    estimatedDuration: {
        type: Number,
        default: 0
    },

    estimatedFare: {
        type: Number,
        default: 0
    },

    tripType: {
        type: String,
        enum: ["Local", "Outstation", "Long Trip"],
        default: "Local"
    },

    tripDate: {
        type: Date
    },

    tripTime: {
        type: String
    },

    advanceAmount: {
        type: Number,
        default: 0
    },

    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Refunded"],
        default: "Pending"
    },

    bookingStatus: {
        type: String,
        enum: [
            "Searching",
            "Assigned",
            "Accepted",
            "Reached Pickup",
            "Trip Started",
            "Completed",
            "Cancelled",
            "PENDING",
            "CONFIRMED",
            "ONGOING",
            "CANCELLED",
            "EXPIRED",
            "NO_DRIVER_AVAILABLE"
        ],
        default: "Searching"
    },

    dispatchRadius: {
        type: Number,
        default: 10
    },

    dispatchAttempt: {
        type: Number,
        default: 1
    },

    currentNotifiedDrivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver"
    }],

    rejectedDrivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver"
    }],

    acceptedAt: {
        type: Date,
        default: null
    },

    reachedAt: {
        type: Date,
        default: null
    },

    tripStartedAt: {
        type: Date,
        default: null
    },

    startedAt: {
        type: Date,
        default: null
    },

    completedAt: {
        type: Date,
        default: null
    },

    cancelReason: {
        type: String,
        default: ""
    },

    cancelledBy: {
        type: String,
        enum: ["Customer", "Driver", "Admin", "System"],
        default: null
    },

    cancelledAt: {
        type: Date,
        default: null
    },

    // Amount the customer owes (e.g. cancellation / no-show fee). Never a refund:
    // Pay After Service means nothing was collected before, so a cancelled trip
    // simply becomes an amount due if business rules apply.
    amountDue: {
        type: Number,
        default: 0
    },

    // Cancellation / no-show fee computed by the backend (never trusted from client).
    cancellationFee: {
        type: Number,
        default: 0
    },

    noShowFee: {
        type: Number,
        default: 0
    },

    // Driver unavailability (reassignment) details.
    unavailabilityReason: {
        type: String,
        default: ""
    },

    unavailabilityDescription: {
        type: String,
        default: ""
    },

    // Reassignment window / deadline plumbing.
    replacementSearchStartedAt: {
        type: Date,
        default: null
    },

    reassignmentDeadline: {
        type: Date,
        default: null
    },

    // Customer no-show window: set when the driver arrives; the booking is
    // marked NO_SHOW once this passes and the trip has not started.
    noShowWindowEndsAt: {
        type: Date,
        default: null
    },

    dispatchStatus: {
    type: String,
    enum: [
        "Searching",
        "Assigned",
        "Accepted",
        "Rejected",
        "Expired"
    ],
    default: "Searching"
},

tripStatus: {
    type: String,
    enum: [
        "Not Started",
        "Driver On The Way",
        "Reached Pickup",
        "OTP Verified",
        "Trip Started",
        "Trip Completed"
    ],
    default: "Not Started"
},

otp: {
    type: String,
    default: ""
},

otpExpiresAt: {
    type: Date,
    default: null
},

otpVerified: {
    type: Boolean,
    default: false
},

    // ============ Acting-driver trip lifecycle (OTP start/end) ============
    // Customer generates these in the app; the driver enters them to start/end.
    startOtp: {
        type: String,
        default: ""
    },
    startOtpExpiresAt: {
        type: Date,
        default: null
    },
    startOtpVerified: {
        type: Boolean,
        default: false
    },
    endOtp: {
        type: String,
        default: ""
    },
    endOtpExpiresAt: {
        type: Date,
        default: null
    },
    endOtpVerified: {
        type: Boolean,
        default: false
    },

    // Final fare computed when the driver ends the trip.
    actualHours: {
        type: Number,
        default: 0
    },
    actualFare: {
        type: Number,
        default: 0
    },
    fareBreakup: {
        billableHours: { type: Number, default: 0 },
        baseFare: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        taxGst: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        perHourRate: { type: Number, default: 0 }
    },

    // Number the driver actually receives for this trip (base fare, excl. fees).
    driverEarning: {
        type: Number,
        default: 0
    },

    // Razorpay payment references.
    paymentOrderId: {
        type: String,
        default: ""
    },
    paymentLinkId: {
        type: String,
        default: ""
    },
    paymentGatewayId: {
        type: String,
        default: ""
    },
    paymentSignature: {
        type: String,
        default: ""
    },

    flowStatus: {
        type: String,
        default: "DRIVER_SEARCHING"
    },

    flowStatusHistory: [{
        status: String,
        at: Date,
        by: {
            type: String,
            enum: ["customer", "driver", "system", "admin"],
            default: "system"
        }
    }],

    driverAssignmentStatus: {
        type: String,
        enum: [
            "SEARCHING",
            "ASSIGNED",
            "CONFIRMED",
            "EN_ROUTE",
            "ARRIVED",
            "REASSIGNING",
            "REASSIGNED",
            "UNAVAILABLE",
            "NO_SHOW",
            "TRIP_STARTED",
            "TRIP_COMPLETED",
            "CANCELLED"
        ],
        default: "SEARCHING"
    },

    driverArrivedAt: {
        type: Date,
        default: null
    },

    // ==================== Live location tracking ====================
    // Mirror of the LatestLocation cache for cheap REST fallback after a
    // customer/driver restarts the app. Coordinates are sanity-checked
    // server-side and never trusted from the socket payload unvalidated.
    latestDriverLocation: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        heading: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        timestamp: { type: Date, default: null }
    },

    latestCustomerLocation: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        timestamp: { type: Date, default: null }
    },

    // "Active" while live location sharing is running for this booking.
    trackingStatus: {
        type: String,
        enum: ["Inactive", "Active"],
        default: "Inactive"
    },

}, 
{
    timestamps: true
});

module.exports =
    mongoose.models.Booking ||
    mongoose.model("Booking", bookingSchema);