const express = require("express");
const router = express.Router();

const customerDriverController = require("../controllers/customerDriver.controller");

// Get Nearby Available Drivers
router.get("/nearby", customerDriverController.getNearbyDrivers);

// Get Driver by ID
router.get("/:id", customerDriverController.getDriverById);

module.exports = router;
