const express = require("express");
const router = express.Router();

const driverController = require("../controllers/driver.controller");
const authMiddleware = require("../middlewares/auth.middleware");


router.get("/profile", authMiddleware, driverController.getProfile);

router.put("/profile", authMiddleware, driverController.updateProfile);

router.get(
    "/status",
    authMiddleware,
    driverController.getDriverStatus
);

router.put(
    "/status",
    authMiddleware,
    driverController.updateDriverStatus
);

router.put(
    "/location",
    authMiddleware,
    driverController.updateLocation
);
module.exports = router;