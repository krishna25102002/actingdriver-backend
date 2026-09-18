const mongoose = require("mongoose");

const appConfigSchema = new mongoose.Schema({

    // Single singleton document that holds global app settings.
    key: {
        type: String,
        unique: true,
        default: "global"
    },

    // Per-hour acting driver rate (default ~210 INR). Admin-configurable.
    actingDriverPerHourRate: {
        type: Number,
        default: 210
    },

    // Maximum number of drivers a booking request can be sent to.
    maxDriversPerBooking: {
        type: Number,
        default: 10
    },

    // How long a driver booking request stays PENDING before expiring (minutes).
    requestExpiryMinutes: {
        type: Number,
        default: 5
    },

    // Platform service fee (% of the base fare). Admin-configurable.
    platformFeePercent: {
        type: Number,
        default: 15
    },

    // Minimum platform service fee in INR (applies when % fee is lower).
    platformFeeMinAmount: {
        type: Number,
        default: 50
    },

    // GST percent applied on (base fare + platform fee). Admin-configurable.
    gstPercent: {
        type: Number,
        default: 18
    },

    // ============ Cancellation / reassignment / no-show policy ============
    // Flat min cancellation fee (INR). The effective fee uses the higher of
    // (flat) or (percent of estimatedFare). Zero percent + zero flat => no fee.
    cancellationFeeFlat: {
        type: Number,
        default: 0
    },

    // Cancellation fee % of estimatedFare when the customer cancels after a
    // driver was assigned but before the driver arrived.
    cancellationFeePercent: {
        type: Number,
        default: 10
    },

    // Harder policy once the driver has arrived at pickup.
    cancellationFeeArrivedFlat: {
        type: Number,
        default: 0
    },

    cancellationFeeArrivedPercent: {
        type: Number,
        default: 25
    },

    // Customer no-show policy (Pay After Service: this becomes an amount due,
    // never a refund). Minutes the driver waits before auto NO_SHOW.
    noShowWaitMinutes: {
        type: Number,
        default: 15
    },

    noShowCustomerFeeFlat: {
        type: Number,
        default: 0
    },

    noShowCustomerFeePercent: {
        type: Number,
        default: 10
    },

    // Offer expiry for a driver booking request (minutes).
    offerTimeoutMinutes: {
        type: Number,
        default: 5
    },

    // Reassignment deadline: stop searching X minutes before pickup time.
    // 0 = keep searching until pickup time.
    replacementDeadlineMinutesBeforePickup: {
        type: Number,
        default: 60
    },

    // Hard cap on how long a single reassignment search runs (minutes).
    replacementSearchMaxMinutes: {
        type: Number,
        default: 30
    },

    // How many candidate drivers the reassignment engine offers per round.
    maxReplacementCandidates: {
        type: Number,
        default: 5
    },

    // ============ Driver skip / cancellation strike policy ============
    // A "strike" = a driver-initiated cancel (Cancellation c.cancelledBy=DRIVER)
    // or a rejected offer/skip (BookingDriverRequest REJECTED /
    // CustomerDriverRequest Rejected) within the configured window.
    // Maximum strikes allowed before further skips/cancels are restricted.
    driverCancellationLimit: {
        type: Number,
        default: 3
    },

    // How far back strikes are counted (rolling window, in hours). Default 720 =
    // 30 days.
    driverCancellationWindowHours: {
        type: Number,
        default: 720
    },

    // How long the restriction lasts (hours) before the driver may skip/cancel
    // again (old strikes keep aging out of the window).
    driverCancellationRestrictionHours: {
        type: Number,
        default: 24
    },

    updatedBy: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.AppConfig ||
    mongoose.model("AppConfig", appConfigSchema);
