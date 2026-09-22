const express = require("express");
const router = express.Router();

const locationController = require("../controllers/location.controller");
const anyAuthMiddleware = require("../middlewares/anyAuth.middleware");
const customerAuthMiddleware = require("../middlewares/customerAuth.middleware");

// Map resources require an authenticated session (driver OR customer token).
router.get("/map/style", anyAuthMiddleware, locationController.getStyle);
router.post("/map/route", anyAuthMiddleware, locationController.getRoute);
router.get("/map/geocode", anyAuthMiddleware, locationController.geocode);
router.get("/map/reverse", anyAuthMiddleware, locationController.reverseGeocode);

// Customer: latest driver location for an active booking (REST fallback).
router.get(
    "/customers/bookings/:id/tracking",
    customerAuthMiddleware,
    locationController.getCustomerTracking
);

module.exports = router;