const pricing = require("./pricing");

/**
 * Cancellation / no-show fee policy. Backend-only: the customer app must never
 * compute or submit these amounts. Pay After Service model — a cancelled trip
 * is never refunded (nothing was collected); an applicable fee becomes the
 * booking's amountDue.
 */

const roundRupee = (n) => Math.round(n);

/**
 * Compute the customer cancellation fee for a booking, based on how far the
 * trip has progressed.
 *
 * RULES:
 *  - No driver assigned yet (still SEARCHING / no assignedDriverId): fee 0.
 *  - Driver assigned / confirmed / en route: flat or % of estimatedFare.
 *  - Driver has already arrived: stricter arrived fee (flat or %).
 * Effective fee = round(max(flat, estimatedFare * percent / 100)).
 * A zero flat + zero percent => no fee.
 *
 * @param {Object} booking   - Booking document.
 * @param {Object} [config]  - AppConfig document (fetched lazily otherwise).
 * @returns {Promise<{cancellationFee: number, driverArrived: boolean}>}
 */
const computeCancellationFee = async (booking, config) => {
    const cfg = config || (await pricing.getConfig());

    const arrivedHere =
        booking.flowStatus === "DRIVER_ARRIVED" ||
        booking.driverAssignmentStatus === "ARRIVED" ||
        booking.driverArrivedAt;

    const driverAssigned =
        Boolean(booking.assignedDriverId || booking.driverId) &&
        booking.driverAssignmentStatus !== "SEARCHING" &&
        booking.driverAssignmentStatus !== "CANCELLED";

    if (!driverAssigned) {
        return { cancellationFee: 0, driverArrived: false };
    }

    const base = booking.estimatedFare || 0;

    if (arrivedHere) {
        const flat = cfg.cancellationFeeArrivedFlat || 0;
        const pct = cfg.cancellationFeeArrivedPercent || 0;
        const fee = roundRupee(Math.max(flat, base * (pct / 100)));
        return { cancellationFee: fee, driverArrived: true };
    }

    const flat = cfg.cancellationFeeFlat || 0;
    const pct = cfg.cancellationFeePercent || 0;
    const fee = roundRupee(Math.max(flat, base * (pct / 100)));
    return { cancellationFee: fee, driverArrived: false };
};

/**
 * Customer no-show fee. Applies when the customer never shows 15 minutes after
 * the driver arrives. Pay After Service => stored as amountDue, never a refund.
 */
const computeNoShowFee = async (booking, config) => {
    const cfg = config || (await pricing.getConfig());
    const base = booking.estimatedFare || 0;
    const flat = cfg.noShowCustomerFeeFlat || 0;
    const pct = cfg.noShowCustomerFeePercent || 0;
    const fee = roundRupee(Math.max(flat, base * (pct / 100)));
    return fee;
};

/**
 * Whether cancellation is still allowed for the given booking (customer side).
 * Mirrors the state-machine's terminal set for customer cancellation.
 */
const customerCanCancel = (flowStatus, driverAssignmentStatus, bookingStatus) => {
    if (bookingStatus === "ONGOING" || flowStatus === "TRIP_STARTED") return false;
    if (bookingStatus === "Completed") return false;
    if (bookingStatus === "CANCELLED") return false;
    if (bookingStatus === "NO_DRIVER_AVAILABLE") return true; // system cancel, allow customer cancel too
    return ["PENDING", "CONFIRMED", "DRIVER_SEARCHING", "SEARCHING"].some(
        (s) => bookingStatus === s || flowStatus === s
    );
};

module.exports = {
    computeCancellationFee,
    computeNoShowFee,
    customerCanCancel
};