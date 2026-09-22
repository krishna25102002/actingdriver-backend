const bcrypt = require("bcrypt");
const crypto = require("crypto");

const Driver = require("../models/Driver");
const Customer = require("../models/Customer");
const PasswordReset = require("../models/PasswordReset");
const mailer = require("./mailer.service");

const OTP_VALIDITY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_SALT_ROUNDS = 10;
const MAX_ATTEMPTS = 5;

function getModel(role) {
    return role === "customer" ? Customer : Driver;
}

function getUserLabel(role) {
    return role === "customer" ? "account" : "driver account";
}

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

// Validate an OTP against a reset record. Wrong codes increment the attempt
// counter; expired/saturated records are rejected.
async function checkOtp(record, otp) {
    if (!record) return false;
    if (new Date(record.expiresAt) < new Date()) return false;
    if (record.attempts >= MAX_ATTEMPTS) return false;
    if (!otp) return false;

    const match = await bcrypt.compare(String(otp), record.otpHash);
    if (!match) {
        record.attempts += 1;
        await record.save();
        return false;
    }
    return true;
}

/**
 * Step 1: request a reset. Always returns the same message whether or not the
 * email exists so we don't leak which accounts are registered.
 */
exports.requestReset = async ({ email, role }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        throw new Error("Email is required");
    }

    if (await getModel(role).exists({ email: normalizedEmail })) {
        // Invalidate any older codes before issuing a fresh one.
        await PasswordReset.deleteMany({ email: normalizedEmail, role });

        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);

        await PasswordReset.create({
            email: normalizedEmail,
            role,
            otpHash,
            expiresAt: new Date(Date.now() + OTP_VALIDITY_MS)
        });

        await mailer.sendMail({
            to: normalizedEmail,
            subject: "Reset your DriveGo password",
            text:
                `Hello,\n\nWe received a request to reset the password for your DriveGo ${getUserLabel(role)}.\n` +
                `Your verification OTP is: ${otp}\n` +
                `This code is valid for 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`
        });
    }

    return {
        success: true,
        message: "If that email is registered, a verification OTP has been sent."
    };
};

/**
 * Step 2: verify the OTP. Marks the reset record as verified so the password
 * change step is allowed.
 */
exports.verifyOtp = async ({ email, role, otp }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const record = await PasswordReset.findOne({ email: normalizedEmail, role });

    if (!(await checkOtp(record, otp))) {
        throw new Error("Invalid or expired OTP");
    }

    record.verifiedAt = new Date();
    await record.save();

    return {
        success: true,
        message: "OTP verified. You can now set a new password."
    };
};

/**
 * Step 3: set a new password. Re-validates the OTP so it also works when the
 * app skips the separate verify step.
 */
exports.resetPassword = async ({ email, role, otp, newPassword }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) throw new Error("Email is required");
    if (!otp) throw new Error("OTP is required");
    if (!newPassword || String(newPassword).length < 6) {
        throw new Error("Password must be at least 6 characters");
    }

    const record = await PasswordReset.findOne({ email: normalizedEmail, role });

    if (!(await checkOtp(record, otp))) {
        throw new Error("Invalid or expired OTP");
    }

    const user = await getModel(role).findOne({ email: normalizedEmail });
    if (!user) {
        throw new Error("Account not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await record.deleteOne();

    return {
        success: true,
        message: "Password reset successfully. You can now log in."
    };
};