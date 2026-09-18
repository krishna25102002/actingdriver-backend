const Booking = require("../models/Booking");

// Shared booking time-window helpers for availability / conflict checks and
// for the reassignment engine. Single source of truth (the acting-driver
// service historically inlined these; it now re-exports them from here).

// Normalize a time window to comparable minutes.
const timeToMinutes = (t) => {
    if (!t) return null;
    const s = String(t).trim().toUpperCase();
    const isPM = s.includes("PM");
    const isAM = s.includes("AM");
    const nums = s.replace(/\s*(AM|PM)\s*/i, "").split(":").map(Number);
    let h = nums[0] || 0;
    const m = nums[1] || 0;
    if (isNaN(h)) return null;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
};

// Check whether two time windows overlap (across a single booking day).
const windowsOverlap = (aStart, aEnd, bStart, bEnd) => {
    const a1 = timeToMinutes(aStart);
    const a2 = timeToMinutes(aEnd);
    const b1 = timeToMinutes(bStart);
    const b2 = timeToMinutes(bEnd);
    if (a1 == null || a2 == null || b1 == null || b2 == null) return false;

    let aA = a1, aB = a2;
    if (aB <= aA) aB += 24 * 60;
    let bA = b1, bB = b2;
    if (bB <= bA) bB += 24 * 60;

    return aA < bB && bA < aB;
};

// Are two calendar dates the same day? (ignores time-of-day)
const sameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
};

// Do the booking's days overlap the driver's busy day range?
const dayRangesOverlap = (reqFrom, reqTo, busyFrom, busyTo) => {
    const rf = reqFrom ? new Date(reqFrom).getTime() : -Infinity;
    const rt = reqTo ? new Date(reqTo).getTime() : Infinity;
    const bf = busyFrom ? new Date(busyFrom).getTime() : -Infinity;
    const bt = busyTo ? new Date(busyTo).getTime() : Infinity;
    return rf <= bt && bf <= rt;
};

// How many days does this booking span (inclusive)?
const bookingDays = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 1;
    const diff = Math.round((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
};

const hasConflictingBooking = async (driverId, fromDate, toDate, startTime, endTime, excludeBookingId) => {
    const conflicts = await Booking.find({
        assignedDriverId: driverId,
        bookingStatus: { $in: ["CONFIRMED", "ONGOING"] },
        fromDate: { $ne: null },
        ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {})
    }).select("fromDate toDate startTime endTime bookingStatus");

    for (const b of conflicts) {
        if (dayRangesOverlap(fromDate, toDate, b.fromDate, b.toDate)) {
            if (windowsOverlap(startTime, endTime, b.startTime, b.endTime)) {
                return b;
            }
        }
    }
    return null;
};

const isDriverFree = async (driverId, fromDate, toDate, startTime, endTime) => {
    return !(await hasConflictingBooking(driverId, fromDate, toDate, startTime, endTime));
};

module.exports = {
    timeToMinutes,
    windowsOverlap,
    sameDay,
    dayRangesOverlap,
    bookingDays,
    hasConflictingBooking,
    isDriverFree
};