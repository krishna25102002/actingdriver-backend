const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({

    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
        required: true
    },

    vehicleType: {
        type: String,
        enum: ["Hatchback", "Sedan", "SUV", "MUV", "Bike"],
        required: true
    },

    registrationNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },

    make: String,

    model: String,

    year: Number,

    color: String,

    isVerified: {
        type: Boolean,
        default: false
    },

    isDeleted: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

vehicleSchema.index({ driverId: 1 });

module.exports =
    mongoose.models.Vehicle ||
    mongoose.model("Vehicle", vehicleSchema);