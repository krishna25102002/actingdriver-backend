const AppConfig = require("../models/AppConfig");
const pricing = require("../utils/pricing");

/**
 * Get the global config (public safe values).
 */
exports.getConfig = async () => {
    const config = await pricing.getConfig();
    return {
        success: true,
        config: {
            actingDriverPerHourRate: config.actingDriverPerHourRate,
            maxDriversPerBooking: config.maxDriversPerBooking,
            requestExpiryMinutes: config.requestExpiryMinutes,
            platformFeePercent: config.platformFeePercent,
            platformFeeMinAmount: config.platformFeeMinAmount,
            gstPercent: config.gstPercent
        }
    };
};

/**
 * Admin: update global config values (rate, max drivers, expiry).
 */
exports.updateConfig = async (adminId, data) => {
    const updates = {};

    if (data.actingDriverPerHourRate !== undefined) {
        const rate = Number(data.actingDriverPerHourRate);
        if (isNaN(rate) || rate <= 0) {
            throw new Error("Per-hour rate must be a positive number");
        }
        updates.actingDriverPerHourRate = rate;
    }

    if (data.maxDriversPerBooking !== undefined) {
        const max = Number(data.maxDriversPerBooking);
        if (isNaN(max) || max < 1 || max > 10) {
            throw new Error("Max drivers per booking must be between 1 and 10");
        }
        updates.maxDriversPerBooking = max;
    }

    if (data.requestExpiryMinutes !== undefined) {
        const min = Number(data.requestExpiryMinutes);
        if (isNaN(min) || min <= 0) {
            throw new Error("Request expiry minutes must be a positive number");
        }
        updates.requestExpiryMinutes = min;
    }

    if (data.platformFeePercent !== undefined) {
        const pct = Number(data.platformFeePercent);
        if (isNaN(pct) || pct < 0 || pct > 50) {
            throw new Error("Platform fee percent must be between 0 and 50");
        }
        updates.platformFeePercent = pct;
    }

    if (data.platformFeeMinAmount !== undefined) {
        const minFee = Number(data.platformFeeMinAmount);
        if (isNaN(minFee) || minFee < 0) {
            throw new Error("Platform minimum fee must be a non-negative number");
        }
        updates.platformFeeMinAmount = minFee;
    }

    if (data.gstPercent !== undefined) {
        const gst = Number(data.gstPercent);
        if (isNaN(gst) || gst < 0 || gst > 50) {
            throw new Error("GST percent must be between 0 and 50");
        }
        updates.gstPercent = gst;
    }

    updates.updatedBy = String(adminId || "");

    const config = await AppConfig.findOneAndUpdate(
        { key: "global" },
        { $set: updates },
        { new: true, upsert: true }
    );

    return {
        success: true,
        message: "Config updated successfully.",
        config: {
            actingDriverPerHourRate: config.actingDriverPerHourRate,
            maxDriversPerBooking: config.maxDriversPerBooking,
            requestExpiryMinutes: config.requestExpiryMinutes,
            platformFeePercent: config.platformFeePercent,
            platformFeeMinAmount: config.platformFeeMinAmount,
            gstPercent: config.gstPercent
        }
    };
};
