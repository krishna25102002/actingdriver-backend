const mongoose = require("mongoose");

// Latest-location cache — exactly one document per active booking, upserted on
// each accepted location update. Never a write-per-fix history collection, so
// highspeed emit rates cannot explode MongoDB document counts.
const latestLocationSchema = new mongoose.Schema({

    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
        unique: true
    },

    driver: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        heading: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        timestamp: { type: Date, default: null }
    },

    customer: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        timestamp: { type: Date, default: null }
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.LatestLocation ||
    mongoose.model("LatestLocation", latestLocationSchema);