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
            gstPercent: config.gstPercent,
            cancellationFeeFlat: config.cancellationFeeFlat,
            cancellationFeePercent: config.cancellationFeePercent,
            cancellationFeeArrivedFlat: config.cancellationFeeArrivedFlat,
            cancellationFeeArrivedPercent: config.cancellationFeeArrivedPercent,
            noShowWaitMinutes: config.noShowWaitMinutes,
            noShowCustomerFeeFlat: config.noShowCustomerFeeFlat,
            noShowCustomerFeePercent: config.noShowCustomerFeePercent,
offerTimeoutMinutes: config.offerTimeoutMinutes,
            replacementDeadlineMinutesBeforePickup: config.replacementDeadlineMinutesBeforePickup,
            replacementSearchMaxMinutes: config.replacementSearchMaxMinutes,
            maxReplacementCandidates: config.maxReplacementCandidates,
            driverCancellationLimit: config.driverCancellationLimit,
            driverCancellationWindowHours: config.driverCancellationWindowHours,
            driverCancellationRestrictionHours: config.driverCancellationRestrictionHours
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

    const nonNeg = (name, value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0) {
            throw new Error(`${name} must be a non-negative number`);
        }
        return n;
    };

    if (data.cancellationFeeFlat !== undefined) updates.cancellationFeeFlat = nonNeg("Cancellation fee (flat)", data.cancellationFeeFlat);
    if (data.cancellationFeePercent !== undefined) updates.cancellationFeePercent = nonNeg("Cancellation fee percent", data.cancellationFeePercent);
    if (data.cancellationFeeArrivedFlat !== undefined) updates.cancellationFeeArrivedFlat = nonNeg("Arrived cancellation fee (flat)", data.cancellationFeeArrivedFlat);
    if (data.cancellationFeeArrivedPercent !== undefined) updates.cancellationFeeArrivedPercent = nonNeg("Arrived cancellation fee percent", data.cancellationFeeArrivedPercent);
    if (data.noShowWaitMinutes !== undefined) {
        const m = Number(data.noShowWaitMinutes);
        if (isNaN(m) || m <= 0 || m > 120) throw new Error("No-show wait minutes must be between 1 and 120");
        updates.noShowWaitMinutes = m;
    }
    if (data.noShowCustomerFeeFlat !== undefined) updates.noShowCustomerFeeFlat = nonNeg("Customer no-show fee (flat)", data.noShowCustomerFeeFlat);
    if (data.noShowCustomerFeePercent !== undefined) updates.noShowCustomerFeePercent = nonNeg("Customer no-show fee percent", data.noShowCustomerFeePercent);
    if (data.offerTimeoutMinutes !== undefined) {
        const m = Number(data.offerTimeoutMinutes);
        if (isNaN(m) || m <= 0 || m > 60) throw new Error("Offer timeout minutes must be between 1 and 60");
        updates.offerTimeoutMinutes = m;
    }
    if (data.replacementDeadlineMinutesBeforePickup !== undefined) updates.replacementDeadlineMinutesBeforePickup = nonNeg("Replacement deadline", data.replacementDeadlineMinutesBeforePickup);
    if (data.replacementSearchMaxMinutes !== undefined) {
        const m = Number(data.replacementSearchMaxMinutes);
        if (isNaN(m) || m <= 0 || m > 180) throw new Error("Replacement search max minutes must be between 1 and 180");
        updates.replacementSearchMaxMinutes = m;
    }
    if (data.maxReplacementCandidates !== undefined) {
        const m = Number(data.maxReplacementCandidates);
        if (isNaN(m) || m < 1 || m > 20) throw new Error("Max replacement candidates must be between 1 and 20");
updates.maxReplacementCandidates = m;
    }

    const positiveInt = (name, value, max) => {
        const n = Number(value);
        if (isNaN(n) || n < 1 || n > max || !Number.isInteger(n)) {
            throw new Error(`${name} must be a whole number between 1 and ${max}`);
        }
        return n;
    };

    if (data.driverCancellationLimit !== undefined) updates.driverCancellationLimit = positiveInt("Driver cancellation limit", data.driverCancellationLimit, 50);
    if (data.driverCancellationWindowHours !== undefined) updates.driverCancellationWindowHours = positiveInt("Cancellation window (hours)", data.driverCancellationWindowHours, 8760);
    if (data.driverCancellationRestrictionHours !== undefined) updates.driverCancellationRestrictionHours = positiveInt("Restriction duration (hours)", data.driverCancellationRestrictionHours, 8760);

    updates.updatedBy = String(adminId || "");

    const config = await AppConfig.findOneAndUpdate(
        { key: "global" },
        { $set: updates },
        { returnDocument: "after", upsert: true }
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
            gstPercent: config.gstPercent,
            cancellationFeeFlat: config.cancellationFeeFlat,
            cancellationFeePercent: config.cancellationFeePercent,
            cancellationFeeArrivedFlat: config.cancellationFeeArrivedFlat,
            cancellationFeeArrivedPercent: config.cancellationFeeArrivedPercent,
            noShowWaitMinutes: config.noShowWaitMinutes,
            noShowCustomerFeeFlat: config.noShowCustomerFeeFlat,
            noShowCustomerFeePercent: config.noShowCustomerFeePercent,
offerTimeoutMinutes: config.offerTimeoutMinutes,
            replacementDeadlineMinutesBeforePickup: config.replacementDeadlineMinutesBeforePickup,
            replacementSearchMaxMinutes: config.replacementSearchMaxMinutes,
            maxReplacementCandidates: config.maxReplacementCandidates,
            driverCancellationLimit: config.driverCancellationLimit,
            driverCancellationWindowHours: config.driverCancellationWindowHours,
            driverCancellationRestrictionHours: config.driverCancellationRestrictionHours
        }
    };
};

