const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const adminMiddleware = require("../middlewares/admin.middleware");

router.post(
    "/login",
    adminController.login
);

router.get(
    "/profile",
    adminMiddleware,
    adminController.getProfile
);

router.post(
    "/logout",
    adminMiddleware,
    adminController.logout
);

// Driver Verification
router.get(
    "/pending-drivers",
    adminMiddleware,
    adminController.getPendingDrivers
);

router.get(
    "/driver/:driverId",
    adminMiddleware,
    adminController.getDriverDetails
);

router.put(
    "/approve/:driverId",
    adminMiddleware,
    adminController.approveDriver
);

router.put(
    "/reject/:driverId",
    adminMiddleware,
    adminController.rejectDriver
);
module.exports = router;