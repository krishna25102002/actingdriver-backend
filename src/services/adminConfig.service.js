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
            requestExpiryMinutes: config.requestExpiryMinutes
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
            requestExpiryMinutes: config.requestExpiryMinutes
        }
    };
};
