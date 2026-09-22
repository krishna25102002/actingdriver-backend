const express = require("express");
const router = express.Router();

const customerDriverController = require("../controllers/customerDriver.controller");

// Get Nearby Available Drivers
router.get("/nearby", customerDriverController.getNearbyDrivers);

// Get Driver by ID
router.get("/:id", customerDriverController.getDriverById);

// Get full public Driver Profile (real stats + reviews)
router.get("/:id/profile", customerDriverController.getDriverProfile);

module.exports = router;
