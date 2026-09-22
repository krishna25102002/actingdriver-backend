const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const LatestLocation = require("../models/LatestLocation");

// A booking is trackable only while the driver is actively working it. Once
// the trip is completed, cancelled or the driver became unavailable, live
// sharing must stop.
const TRACKING_STATUSES = new Set([
    "CONFIRMED",
    "EN_ROUTE",
    "ARRIVED",
    "TRIP_STARTED"
]);

const EMIT_MIN_INTERVAL_MS = 2000;
const PERSIST_MIN_INTERVAL_MS = 10000;

// Per socket+booking last accepted emit timestamp (in-memory, cleared on
// disconnect). Prevents a misbehaving client from flooding the room.
const lastEmitAt = new Map();

// Per booking+role last database write timestamp. Keeps Mongo writes bounded
// (default once every 10s per active trip) while realtime emits continue.
const lastPersistAt = new Map();

const isTrackable = (booking) =>
    booking && TRACKING_STATUSES.has(booking.driverAssignmentStatus);

const toFinite = (value) => {
    const n = typeof value === "string" ? parseFloat(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const isValidCoords = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
};

function canEmit(socketId, bookingId) {
    const key = `${socketId}:${bookingId}`;
    const now = Date.now();
    const last = lastEmitAt.get(key) || 0;
    if (now - last < EMIT_MIN_INTERVAL_MS) return false;
    lastEmitAt.set(key, now);
    return true;
}

function canPersist(bookingId, role) {
    const key = `${bookingId}:${role}`;
    const now = Date.now();
    const last = lastPersistAt.get(key) || 0;
    if (now - last < PERSIST_MIN_INTERVAL_MS) return false;
    lastPersistAt.set(key, now);
    return true;
}

// Resolve the booking a socket is asking about and verify the authenticated
// user actually owns it (driver = assignedDriverId, customer = customerId).
// Identity always comes from the JWT/`socket.user`, never from the payload.
async function getAuthorizedBooking(socket, bookingId) {
    if (!bookingId) {
        throw new Error("BOOKING_NOT_FOUND");
    }

    const booking = await Booking.findById(bookingId).lean();
    if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
    }

    if (socket.user.role === "driver") {
        const driverId = booking.assignedDriverId || booking.driverId;
        if (!driverId || driverId.toString() !== socket.user._id) {
            throw new Error("UNAUTHORIZED");
        }
    } else if (socket.user.role === "customer") {
        if (!booking.customerId || booking.customerId.toString() !== socket.user._id) {
            throw new Error("UNAUTHORIZED");
        }
    } else {
        throw new Error("UNAUTHORIZED");
    }

    return booking;
}

async function getLatest(bookingId) {
    return LatestLocation.findOne({ bookingId }).lean();
}

// Persist the driver's latest position: LatestLocation cache, Driver GeoJSON
// (kept accurate for dispatch) and the Booking mirror, all in one bounded step.
async function persistDriverLocation(bookingId, driverId, payload) {
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    await Promise.all([
        LatestLocation.findOneAndUpdate(
            { bookingId },
            {
                $set: {
                    "driver.latitude": payload.latitude,
                    "driver.longitude": payload.longitude,
                    "driver.accuracy": payload.accuracy || 0,
                    "driver.heading": payload.heading || 0,
                    "driver.speed": payload.speed || 0,
                    "driver.timestamp": timestamp
                }
            },
            { upsert: true, setDefaultsOnInsert: true }
        ),
        Driver.updateOne(
            { _id: driverId },
            {
                $set: {
                    "location.type": "Point",
                    "location.coordinates": [payload.longitude, payload.latitude],
                    locationUpdatedAt: timestamp,
                    locationAccuracy: payload.accuracy || 0,
                    heading: payload.heading || 0,
                    speed: payload.speed || 0
                }
            }
        ),
        Booking.updateOne(
            { _id: bookingId },
            {
                $set: {
                    "latestDriverLocation.latitude": payload.latitude,
                    "latestDriverLocation.longitude": payload.longitude,
                    "latestDriverLocation.accuracy": payload.accuracy || 0,
                    "latestDriverLocation.heading": payload.heading || 0,
                    "latestDriverLocation.speed": payload.speed || 0,
                    "latestDriverLocation.timestamp": timestamp,
                    trackingStatus: "Active"
                }
            }
        )
    ]);
}

async function persistCustomerLocation(bookingId, payload) {
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    await Promise.all([
        LatestLocation.findOneAndUpdate(
            { bookingId },
            {
                $set: {
                    "customer.latitude": payload.latitude,
                    "customer.longitude": payload.longitude,
                    "customer.accuracy": payload.accuracy || 0,
                    "customer.timestamp": timestamp
                }
            },
            { upsert: true, setDefaultsOnInsert: true }
        ),
        Booking.updateOne(
            { _id: bookingId },
            {
                $set: {
                    "latestCustomerLocation.latitude": payload.latitude,
                    "latestCustomerLocation.longitude": payload.longitude,
                    "latestCustomerLocation.accuracy": payload.accuracy || 0,
                    "latestCustomerLocation.timestamp": timestamp
                }
            }
        )
    ]);
}

function clearSocketKeys(socketId) {
    for (const key of lastEmitAt.keys()) {
        if (key.startsWith(`${socketId}:`)) {
            lastEmitAt.delete(key);
        }
    }
}

module.exports = {
    TRACKING_STATUSES,
    isTrackable,
    getAuthorizedBooking,
    getLatest,
    persistDriverLocation,
    persistCustomerLocation,
    canEmit,
    canPersist,
    isValidCoords,
    toFinite,
    clearSocketKeys
};