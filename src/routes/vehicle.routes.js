const express = require("express");
const router = express.Router();

const vehicleController = require("../controllers/vehicle.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/", authMiddleware, vehicleController.addVehicle);

router.get("/", authMiddleware, vehicleController.getVehicles);

router.get("/:vehicleId", authMiddleware, vehicleController.getVehicleById);

router.put("/:vehicleId", authMiddleware, vehicleController.updateVehicle);

router.delete("/:vehicleId", authMiddleware, vehicleController.deleteVehicle);

module.exports = router;