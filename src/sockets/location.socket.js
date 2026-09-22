const locationService = require("../services/location.service");
const actionBooking = require("../services/actionBooking.service");
const { getIO } = require("../config/io");

const roomName = (bookingId) => `booking:${bookingId}`;

// Driver is considered "arrived" once within ~120m of the pickup pin. With the
// manual "On My Way"/"I've Arrived" buttons gone from the driver app, the live
// GPS stream replaces them: first ping => EN_ROUTE, entering this radius =>
// ARRIVED (which also starts the customer no-show window server-side).
const ARRIVAL_RADIUS_KM = 0.12;
const PROGRESSIBLE_FLOW_STATUSES = ["DRIVER_CONFIRMED", "DRIVER_EN_ROUTE", "DRIVER_REASSIGNED"];

function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function autoAdvanceDriverStatus(booking, coords, driverId) {
    if (!booking || booking.bookingStatus !== "CONFIRMED") return null;
    const current = booking.flowStatus || "DRIVER_CONFIRMED";
    if (!PROGRESSIBLE_FLOW_STATUSES.includes(current)) return null;

    const pickup = booking.pickupLocation || {};
    const hasPickup =
        typeof pickup.latitude === "number" &&
        typeof pickup.longitude === "number" &&
        pickup.latitude !== 0 &&
        pickup.longitude !== 0;

    const arrived =
        hasPickup &&
        haversineKm(coords.latitude, coords.longitude, pickup.latitude, pickup.longitude) <=
            ARRIVAL_RADIUS_KM;

    if (arrived) {
        await actionBooking.driverMarkArrived(driverId, booking._id);
        return "DRIVER_ARRIVED";
    }
    if (current === "DRIVER_EN_ROUTE") return null;
    await actionBooking.driverMarkEnRoute(driverId, booking._id);
    return "DRIVER_EN_ROUTE";
}

function trackUserRoom(socket, bookingId) {
    socket.data.trackingRooms = socket.data.trackingRooms || {};
    socket.data.trackingRooms[bookingId] = true;
}

function untrackUserRoom(socket, bookingId) {
    if (socket.data.trackingRooms) {
        delete socket.data.trackingRooms[bookingId];
    }
}

function getTrackedRooms(socket) {
    return Object.keys(socket.data.trackingRooms || {});
}

function emitError(socket, code, message) {
    socket.emit("location:error", { code, message });
}

// ==================== Subscribe / Unsubscribe ====================

async function handleSubscribe(io, socket, payload) {
    const bookingId = payload && payload.bookingId;
    if (!bookingId) {
        return emitError(socket, "BOOKING_NOT_FOUND", "bookingId is required");
    }

    let booking;
    try {
        booking = await locationService.getAuthorizedBooking(socket, bookingId);
    } catch (err) {
        return emitError(socket, err.message, "You are not authorized to view this booking");
    }

    socket.join(roomName(bookingId));
    trackUserRoom(socket, bookingId.toString());

    // Immediately push the last known driver position so a freshly opened
    // screen (or a reconnected session) shows something right away.
    const latest = await locationService.getLatest(bookingId);
    if (latest && latest.driver && latest.driver.timestamp) {
        io.to(roomName(bookingId)).emit("location:updated", {
            role: "driver",
            bookingId,
            ...latest.driver,
            timestamp: latest.driver.timestamp.toISOString()
        });
    }

    if (locationService.isTrackable(booking)) {
        io.to(roomName(bookingId)).emit("tracking:state", {
            bookingId,
            state: "tracking_started"
        });
    } else {
        const reason =
            booking.driverAssignmentStatus === "TRIP_COMPLETED" ? "completed" : "cancelled";
        io.to(roomName(bookingId)).emit("booking:ended", { bookingId, reason });
    }
}

async function handleUnsubscribe(socket, payload) {
    const bookingId = payload && payload.bookingId;
    if (!bookingId) return;

    socket.leave(roomName(bookingId));
    untrackUserRoom(socket, bookingId.toString());
}

// ==================== Location updates ====================

async function handleDriverLocation(io, socket, payload) {
    if (socket.user.role !== "driver") {
        return emitError(socket, "UNAUTHORIZED", "Only drivers can send driver location");
    }

    const bookingId = payload && payload.bookingId;
    const latitude = locationService.toFinite(payload && payload.latitude);
    const longitude = locationService.toFinite(payload && payload.longitude);

    if (!locationService.isValidCoords(latitude, longitude)) {
        return emitError(socket, "INVALID_COORDINATES", "Latitude/longitude out of range");
    }

    let booking;
    try {
        booking = await locationService.getAuthorizedBooking(socket, bookingId);
    } catch (err) {
        return emitError(socket, err.message, "Unauthorized or missing booking");
    }

    if (!locationService.isTrackable(booking)) {
        return emitError(socket, "BOOKING_NOT_ACTIVE", "This booking is not active");
    }

    const accuracy = locationService.toFinite(payload.accuracy) || 0;
    const heading = locationService.toFinite(payload.heading) || 0;
    const speed = locationService.toFinite(payload.speed) || 0;
    const timestamp =
        payload.timestamp && !isNaN(Date.parse(payload.timestamp))
            ? payload.timestamp
            : new Date().toISOString();

    // Derive the driver's booking phase from GPS (replaces the removed manual
    // "On My Way"/"I've Arrived" buttons). Non-fatal: never block location flow.
    try {
        const nextStatus = await autoAdvanceDriverStatus(
            booking,
            { latitude, longitude },
            socket.user._id
        );
        if (nextStatus) {
            io.to(roomName(bookingId)).emit("tracking:state", {
                bookingId,
                state:
                    nextStatus === "DRIVER_ARRIVED"
                        ? "driver_arrived"
                        : "driver_en_route"
            });
        }
    } catch (err) {
        console.error("[socket] auto status advance error:", err && err.message);
    }

    // Realtime (room emit) is bounded to one accepted update per socket every
    // 2s by the server regardless of what the client sends.
    if (locationService.canEmit(socket.id, bookingId)) {
        io.to(roomName(bookingId)).emit("location:updated", {
            role: "driver",
            bookingId,
            latitude,
            longitude,
            accuracy,
            heading,
            speed,
            timestamp
        });
    }

    // Mongo writes are bounded to ~once per 10s per active trip.
    if (locationService.canPersist(bookingId, "driver")) {
        await locationService.persistDriverLocation(
            bookingId,
            socket.user._id,
            { latitude, longitude, accuracy, heading, speed, timestamp }
        );
    }
}

async function handleCustomerLocation(io, socket, payload) {
    if (socket.user.role !== "customer") {
        return emitError(socket, "UNAUTHORIZED", "Only customers can send customer location");
    }

    const bookingId = payload && payload.bookingId;
    const latitude = locationService.toFinite(payload && payload.latitude);
    const longitude = locationService.toFinite(payload && payload.longitude);

    if (!locationService.isValidCoords(latitude, longitude)) {
        return emitError(socket, "INVALID_COORDINATES", "Latitude/longitude out of range");
    }

    let booking;
    try {
        booking = await locationService.getAuthorizedBooking(socket, bookingId);
    } catch (err) {
        return emitError(socket, err.message, "Unauthorized or missing booking");
    }

    if (!locationService.isTrackable(booking)) {
        return emitError(socket, "BOOKING_NOT_ACTIVE", "This booking is not active");
    }

    const accuracy = locationService.toFinite(payload.accuracy) || 0;
    const timestamp =
        payload.timestamp && !isNaN(Date.parse(payload.timestamp))
            ? payload.timestamp
            : new Date().toISOString();

    if (locationService.canEmit(socket.id, bookingId)) {
        io.to(roomName(bookingId)).emit("location:updated", {
            role: "customer",
            bookingId,
            latitude,
            longitude,
            accuracy,
            timestamp
        });
    }

    if (locationService.canPersist(bookingId, "customer")) {
        await locationService.persistCustomerLocation(bookingId, {
            latitude,
            longitude,
            accuracy,
            timestamp
        });
    }
}

function handleDisconnect(io, socket) {
    locationService.clearSocketKeys(socket.id);

    // If a connected driver disappears mid-trip (app killed / offline), let
    // the customers in their tracked rooms know so they never stare at a
    // stale marker presented as live.
    if (socket.user && socket.user.role === "driver") {
        const rooms = getTrackedRooms(socket);
        for (const bookingId of rooms) {
            io.to(roomName(bookingId)).emit("tracking:state", {
                bookingId,
                state: "driver_offline"
            });
        }
    }
    socket.data.trackingRooms = {};
}

function registerLocationHandlers(io, socket) {
    socket.on("booking:subscribe", (payload) =>
        handleSubscribe(io, socket, payload).catch((err) => {
            console.error("[socket] subscribe error:", err && err.message);
        })
    );
    socket.on("booking:unsubscribe", (payload) => handleUnsubscribe(socket, payload));
    socket.on("driver:location:update", (payload) =>
        handleDriverLocation(io, socket, payload).catch((err) => {
            console.error("[socket] driver location error:", err && err.message);
        })
    );
    socket.on("customer:location:update", (payload) =>
        handleCustomerLocation(io, socket, payload).catch((err) => {
            console.error("[socket] customer location error:", err && err.message);
        })
    );
    socket.on("disconnect", () => handleDisconnect(io, socket));
}

// Broadcast helpers used by REST services when a booking transitions to a
// terminal state mid-session (trip completed / cancelled / driver unavailable).
function notifyBookingEnded(bookingId, reason) {
    try {
        getIO().to(roomName(bookingId)).emit("booking:ended", {
            bookingId,
            reason: reason || "cancelled"
        });
    } catch (err) {
        // Socket.IO not initialized (e.g. scripts/tests) — safe to ignore.
    }
}

// A driver stepped away (unavailable / reassign started): live position stops
// until the (new) driver resumes, but the booking itself is not over.
function notifyTrackingStopped(bookingId) {
    try {
        getIO().to(roomName(bookingId)).emit("tracking:state", {
            bookingId,
            state: "tracking_stopped"
        });
    } catch (err) {
        // Socket.IO not initialized — safe to ignore.
    }
}

module.exports = {
    registerLocationHandlers,
    notifyBookingEnded,
    notifyTrackingStopped,
    roomName
};