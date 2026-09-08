const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true,
        unique: true
    },

    email: {
        type: String
    },

    password: {
        type: String,
        required: true
    },

    profileImage: {
        type: String,
        default: ""
    },

    location: {
        latitude: {
            type: Number
        },

        longitude: {
            type: Number
        },

        address: {
            type: String
        }
    },

    isDeleted: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

module.exports =
    mongoose.models.Customer ||
    mongoose.model("Customer", customerSchema);
