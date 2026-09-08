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
