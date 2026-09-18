const Cancellation = require("../models/Cancellation");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const CustomerDriverRequest = require("../models/CustomerDriverRequest");
const pricing = require("./pricing");

const DEFAULT_LIMIT = 3;
const DEFAULT_WINDOW_HOURS = 24 * 30;
const DEFAULT_RESTRICTION_HOURS = 24;

/**
 * Resolve the current strike-policy from the admin-editable AppConfig.
 */
const getResolvedPolicy = async () => {
    const cfg = await pricing.getConfig();
    return {
        limit: Number(cfg.driverCancellationLimit) || DEFAULT_LIMIT,
        windowHours: Number(cfg.driverCancellationWindowHours) || DEFAULT_WINDOW_HOURS,
        restrictionHours: Number(cfg.driverCancellationRestrictionHours) || DEFAULT_RESTRICTION_HOURS
    };
};

/**
 * Number of driver strikes within the rolling window. A strike is any
 * driver-initiated action that refuses a job:
 *  - driver cancelled a booking (Cancellation, cancelledBy = DRIVER)
 *  - driver rejected an acting-driver offer (BookingDriverRequest REJECTED)
 *  - driver rejected a direct request (CustomerDriverRequest Rejected)
 */
const strikeCount = async (driverId, policy) => {
    const p = policy || (await getResolvedPolicy());
    const cutoff = new Date(Date.now() - p.windowHours * 3600000);
    const [cancels, actionRejects, requestRejects] = await Promise.all([
        Cancellation.countDocuments({
            driverId,
            cancelledBy: "DRIVER",
            createdAt: { $gte: cutoff }
        }),
        BookingDriverRequest.countDocuments({
            driverId,
            requestStatus: "REJECTED",
            rejectedAt: { $gte: cutoff }
        }),
        CustomerDriverRequest.countDocuments({
            driverId,
            requestStatus: "Rejected",
            updatedAt: { $gte: cutoff }
        })
    ]);
    return cancels + actionRejects + requestRejects;
};

/**
 * Guards a driver skip/cancel. Throws when the driver has already reached the
 * allowed limit of strikes inside the rolling window (the "N+1th is restricted"
 * rule). Returns the current strike summary when the action is still allowed.
 */
const assertNotRestricted = async (driverId) => {
    const policy = await getResolvedPolicy();
    const strikes = await strikeCount(driverId, policy);
    if (strikes >= policy.limit) {
        const err = new Error(
            `You have reached the skip/cancellation limit of ${policy.limit}. ` +
            `Please accept this trip. You will be able to skip or cancel again after the restriction period.`
        );
        err.code = "CANCELLATION_LIMIT_REACHED";
        err.remaining = 0;
        err.limit = policy.limit;
        throw err;
    }
    return {
        strikes,
        remaining: policy.limit - strikes,
        limit: policy.limit,
        windowHours: policy.windowHours
    };
};

module.exports = {
    getResolvedPolicy,
    strikeCount,
    assertNotRestricted
};