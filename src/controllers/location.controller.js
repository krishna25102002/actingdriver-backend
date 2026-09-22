const geoapify = require("../config/geoapify");
const Booking = require("../models/Booking");

// GET /api/map/style — returns the MapLibre style JSON from Geoapify with the
// key injected (tiles are still loaded directly by the device). Requires auth.
exports.getStyle = async (req, res) => {
    try {
        const style = await geoapify.fetchStyleJson(req.query.style);
        res.json(style);
    } catch (error) {
        res.status(502).json({ success: false, message: error.message });
    }
};

// POST /api/map/route — server-side Geoapify routing. Returns the raw routing
// response (encoded polyline); the client decodes it with the map lib.
exports.getRoute = async (req, res) => {
    try {
        const { fromLat, fromLng, toLat, toLng, mode } = req.body || {};
        if (!fromLat || !fromLng || !toLat || !toLng) {
            return res.status(400).json({ success: false, message: "Missing waypoints" });
        }
        const result = await geoapify.fetchRoute({ fromLat, fromLng, toLat, toLng, mode });
        res.json(result);
    } catch (error) {
        res.status(502).json({ success: false, message: error.message });
    }
};

// GET /api/map/geocode?text=... — server-side Geoapify geocoding (used for the
// customer's manual pickup fallback).
exports.geocode = async (req, res) => {
    try {
        const result = await geoapify.fetchGeocode(req.query.text);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// GET /api/map/reverse?lat=..&lng=.. — Geoapify reverse geocoding so the
// customer's "use my current location" button can fill a readable address.
exports.reverseGeocode = async (req, res) => {
    try {
        const result = await geoapify.fetchReverseGeocode(
            parseFloat(req.query.lat),
            parseFloat(req.query.lng)
        );
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// GET /api/action/customers/bookings/:id/tracking — authenticated REST fallback
// used after an app restart / before the socket reconnects. Returns the driver's
// last known position + tracking state. Never returns location for another
// customer's booking.
exports.getCustomerTracking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).lean();
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        if (!booking.customerId || booking.customerId.toString() !== req.customer.customerId) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        res.json({
            success: true,
            trackingStatus: booking.trackingStatus,
            driverAssignmentStatus: booking.driverAssignmentStatus,
            latestDriverLocation: booking.latestDriverLocation || null,
            pickupLocation: booking.pickupLocation || null,
            dropLocation: booking.dropLocation || null
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};