const AppConfig = require("../models/AppConfig");

/**
 * Get the current global per-hour acting-driver rate.
 * Always reads from the config singleton, falling back to the default 210.
 */
const getPerHourRate = async () => {
    let config = await AppConfig.findOne({ key: "global" });
    if (!config) {
        // Lazily create the singleton with defaults if it doesn't exist yet.
        config = await AppConfig.create({ key: "global" });
    }
    return config.actingDriverPerHourRate || 210;
};

const getConfig = async () => {
    let config = await AppConfig.findOne({ key: "global" });
    if (!config) {
        config = await AppConfig.create({ key: "global" });
    }
    return config;
};

/**
 * Calculate the booking duration in hours from start/end time strings.
 * Accepts "HH:MM" (24h) or "HH:MM AM/PM". Returns 0 if invalid.
 */
const durationHours = (startTime, endTime) => {
    const parse = (t) => {
        if (!t) return null;
        let h = 0, m = 0;
        const trimmed = String(t).trim().toUpperCase();
        const isPM = trimmed.includes("PM");
        const isAM = trimmed.includes("AM");
        const nums = trimmed.replace(/\s*(AM|PM)\s*/i, "").split(":");
        if (nums.length >= 2) {
            h = parseInt(nums[0], 10);
            m = parseInt(nums[1], 10);
        } else if (nums.length === 1) {
            h = parseInt(nums[0], 10);
        }
        if (isNaN(h)) return null;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + m; // minutes since midnight
    };

    const start = parse(startTime);
    const end = parse(endTime);
    if (start == null || end == null) return 0;

    let diffMin = end - start;
    if (diffMin <= 0) diffMin += 24 * 60; // crosses midnight
    return Math.round((diffMin / 60) * 100) / 100;
};

/**
 * Calculate the estimated acting-driver amount.
 *
 * @param {Object} opts
 * @param {string} opts.startTime - e.g. "10:00" or "10:00 AM"
 * @param {string} opts.endTime   - e.g. "16:00" or "4:00 PM"
 * @param {Date}   [opts.fromDate]
 * @param {Date}   [opts.toDate]
 * @returns {Promise<{hours: number, perHourRate: number, amount: number}>}
 */
const calculateAmount = async ({ startTime, endTime, fromDate, toDate }) => {
    // If it's a multi-day booking, count whole days between from & to (inclusive)
    // each contributing its per-day working-hours. For simplicity the amount is
    // hours * perHourRate, where hours is computed from time range.
    let hours = durationHours(startTime, endTime);

    // Multi-day: base hours per day * number of days
    let days = 1;
    if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        const diff = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > 1) days = diff;
    }

    if (hours <= 0) hours = 0;

    const perHourRate = await getPerHourRate();
    const totalHours = hours * days;
    const amount = Math.round(totalHours * perHourRate);

    return {
        hours: totalHours,
        perHourRate,
        amount
    };
};

/**
 * Build a full fare breakdown from a base fare using the global fee config.
 * platformFee = max(minFee, pct% of base); GST applies on (base + platformFee).
 */
const roundRupee = (n) => Math.round(n);

const buildFareBreakdown = (base, cfg) => {
    const pct = cfg.platformFeePercent != null ? cfg.platformFeePercent : 15;
    const pMin = cfg.platformFeeMinAmount != null ? cfg.platformFeeMinAmount : 50;
    const gst = cfg.gstPercent != null ? cfg.gstPercent : 18;

    const platformFee = roundRupee(Math.max(pMin, base * (pct / 100)));
    const taxGst = roundRupee((base + platformFee) * (gst / 100));
    const total = base + platformFee + taxGst;

    return {
        baseFare: base,
        platformFee,
        taxGst,
        total,
        perHourRate: cfg.actingDriverPerHourRate || 210
    };
};

/**
 * Compute the actual trip fare for a completed acting-driver trip:
 * bills to the next half-hour block (min 1 hour), adds 15% platform fee
 * (min ₹50) and 18% GST on (base + platform fee). Driver earns `baseFare`.
 *
 * @param {Object} opts
 * @param {number} opts.minutes   - actual trip duration in minutes (> 0)
 * @param {Date}   [opts.tripStartedAt]
 * @returns {Promise<{billableHours, baseFare, platformFee, taxGst, total, perHourRate}>}
 */
const computeActualFare = async ({ minutes }) => {
    const mins = Math.max(1, Math.ceil(Number(minutes) || 0));
    const billableHours = Math.max(1, Math.ceil(mins / 30) / 2);
    const cfg = await getConfig();
    const baseFare = roundRupee(billableHours * (cfg.actingDriverPerHourRate || 210));
    return {
        billableHours,
        baseFare,
        ...buildFareBreakdown(baseFare, cfg)
    };
};

module.exports = {
    getPerHourRate,
    getConfig,
    durationHours,
    calculateAmount,
    computeActualFare,
    buildFareBreakdown
};
