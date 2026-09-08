const express = require("express");
const router = express.Router();

const customerVehicleController = require("../controllers/customerVehicle.controller");
const customerAuthMiddleware = require("../middlewares/customerAuth.middleware");

// All customer vehicle routes require authentication
router.use(customerAuthMiddleware);

// Add Vehicle
router.post("/", customerVehicleController.addVehicle);

// Get Customer Vehicles
router.get("/", customerVehicleController.getVehicles);

// Get Single Vehicle
router.get("/:id", customerVehicleController.getVehicleById);

// Update ONLY the car model
router.put("/:id/model", customerVehicleController.updateVehicleModel);

// Update Vehicle
router.put("/:id", customerVehicleController.updateVehicle);

// Delete Vehicle
router.delete("/:id", customerVehicleController.deleteVehicle);

module.exports = router;
