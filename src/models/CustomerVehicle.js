const mongoose = require("mongoose");

const customerVehicleSchema = new mongoose.Schema({

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true
    },

    vehicleType: {
        type: String,
        enum: [
            "Hatchback",
            "Sedan",
            "SUV",
            "MUV"
        ]
    },

    brand: {
        type: String
    },

    model: {
        type: String
    },

    year: {
        type: Number
    },

    transmission: {
        type: String,
        enum: [
            "Manual",
            "Automatic"
        ]
    },

    fuelType: {
        type: String,
        enum: [
            "Petrol",
            "Diesel",
            "CNG",
            "EV"
        ]
    },

    registrationNumber: {
        type: String,
        uppercase: true
    },

    condition: {
        type: String,
        enum: [
            "Excellent",
            "Good",
            "Average"
        ]
    },

    images: [
        String
    ],

    isDeleted: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

customerVehicleSchema.index({ customerId: 1 });

module.exports =
    mongoose.models.CustomerVehicle ||
    mongoose.model("CustomerVehicle", customerVehicleSchema);
