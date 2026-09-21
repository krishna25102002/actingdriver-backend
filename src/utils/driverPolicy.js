const Cancellation = require("../models/Cancellation");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const CustomerDriverRequest = require("../models/CustomerDriverRequest");
const Driver = require("../models/Driver");
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
 * Earliest timestamp a strike may count from.
 *   - the start of the rolling window (windowHours back), and
 *   - the last time the driver ACCEPTED a trip (strikeResetAt), because
 *     accepting any trip resets the counter to 0.
 */
const effectiveStart = async (driverId, policy) => {
    let resetAt = null;
    try {
        const driver = await Driver.findById(driverId).select("strikeResetAt");
        resetAt = driver && driver.strikeResetAt ? new Date(driver.strikeResetAt).getTime() : 0;
    } catch (e) {
        resetAt = 0;
    }
    const cutoff = Date.now() - policy.windowHours * 3600000;
    return new Date(Math.max(cutoff, resetAt));
};

/**
 * Number of driver strikes since the effective start. A strike is any
 * driver-initiated action that refuses a job:
 *  - driver cancelled a booking (Cancellation, cancelledBy = DRIVER)
 *  - driver rejected an acting-driver offer (BookingDriverRequest REJECTED)
 *  - driver rejected a direct request (CustomerDriverRequest Rejected)
 */
const strikeCount = async (driverId, policy) => {
    const p = policy || (await getResolvedPolicy());
    const since = await effectiveStart(driverId, p);
    const [cancels, actionRejects, requestRejects] = await Promise.all([
        Cancellation.countDocuments({
            driverId,
            cancelledBy: "DRIVER",
            createdAt: { $gte: since }
        }),
        BookingDriverRequest.countDocuments({
            driverId,
            requestStatus: "REJECTED",
            rejectedAt: { $gte: since }
        }),
        CustomerDriverRequest.countDocuments({
            driverId,
            requestStatus: "Rejected",
            updatedAt: { $gte: since }
        })
    ]);
    return cancels + actionRejects + requestRejects;
};

/**
 * Strikes a driver may still use before being FORCED to accept the next
 * request. Rule: the Nth request (where N = policy.limit) MUST be accepted —
 * so a driver may skip at most limit-1 times before acceptance is required.
 */
const allowedSkipsBeforeForced = (policy) => Math.max(Number(policy.limit) - 1, 0);

/**
 * Non-throwing strike summary. Attach `strikePolicy` to pending-request
 * responses so the driver app can render "Skipped x/3" and disable the
 * reject button when the current request must be accepted.
 */
const getStrikeSummary = async (driverId) => {
    const policy = await getResolvedPolicy();
    const strikes = await strikeCount(driverId, policy);
    const allowed = allowedSkipsBeforeForced(policy);
    const forced = strikes >= allowed;
    return {
        strikes,
        remaining: forced ? 0 : Math.max(allowed - strikes, 0),
        limit: policy.limit,
        forced,
        windowHours: policy.windowHours
    };
};

/**
 * Guards a driver skip/cancel. Throws when the current request MUST be
 * accepted (the driver has already used their allowed skips). Returns the
 * current strike summary when the action is still allowed.
 */
const assertNotRestricted = async (driverId) => {
    const policy = await getResolvedPolicy();
    const strikes = await strikeCount(driverId, policy);
    const allowed = allowedSkipsBeforeForced(policy);
    if (strikes >= allowed) {
        const err = new Error(
            `You must accept this trip. You have used ${strikes} of ${policy.limit} ` +
            `skip/cancel attempts and cannot skip again. The counter resets after ` +
            `you accept a trip.`
        );
        err.code = "CANCELLATION_LIMIT_REACHED";
        err.remaining = 0;
        err.limit = policy.limit;
        throw err;
    }
    return {
        strikes,
        remaining: Math.max(allowed - strikes, 0),
        limit: policy.limit,
        forced: false,
        windowHours: policy.windowHours
    };
};

const resetStrikes = (driverId) =>
    Driver.findByIdAndUpdate(driverId, { strikeResetAt: new Date() });

module.exports = {
    getResolvedPolicy,
    strikeCount,
    getStrikeSummary,
    assertNotRestricted,
    resetStrikes
};