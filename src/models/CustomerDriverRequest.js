const mongoose = require("mongoose");

const customerDriverRequestSchema = new mongoose.Schema({

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

    pickupAddress: {
        type: String,
        default: ""
    },

    dropAddress: {
        type: String,
        default: ""
    },

    pickupLocation: {
        latitude: {
            type: Number,
            default: 0
        },
        longitude: {
            type: Number,
            default: 0
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

    estimatedFare: {
        type: Number,
        default: 0
    },

    tripType: {
        type: String,
        default: "Local"
    },

    requestStatus: {
        type: String,
        enum: ["Requested", "Accepted", "Rejected", "Cancelled", "Completed"],
        default: "Requested"
    },

    requestedAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

customerDriverRequestSchema.index({ customerId: 1, requestedAt: -1 });

module.exports =
    mongoose.models.CustomerDriverRequest ||
    mongoose.model("CustomerDriverRequest", customerDriverRequestSchema);
