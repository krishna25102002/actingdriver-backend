const mongoose = require("mongoose");

const passwordResetSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    role: {
        type: String,
        enum: ["driver", "customer"],
        required: true
    },
    otpHash: {
        type: String,
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

passwordResetSchema.index({ email: 1, role: 1 });

module.exports =
    mongoose.models.PasswordReset ||
    mongoose.model("PasswordReset", passwordResetSchema);