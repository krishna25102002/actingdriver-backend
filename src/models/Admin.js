const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    role: {
        type: String,
        default: "Super Admin"
    }

}, {
    timestamps: true
});

module.exports =
mongoose.models.Admin ||
mongoose.model("Admin", adminSchema);