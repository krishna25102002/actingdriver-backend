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

// ============================
// Admin panel endpoints
// ============================
router.get(
    "/dashboard",
    adminMiddleware,
    adminController.getDashboard
);

router.get(
    "/drivers",
    adminMiddleware,
    adminController.getAllDrivers
);

router.put(
    "/drivers/:driverId",
    adminMiddleware,
    adminController.updateDriver
);

router.delete(
    "/drivers/:driverId",
    adminMiddleware,
    adminController.deleteDriver
);

router.get(
    "/customers",
    adminMiddleware,
    adminController.getCustomers
);

router.get(
    "/customers/:customerId",
    adminMiddleware,
    adminController.getCustomerDetails
);

router.put(
    "/customers/:customerId",
    adminMiddleware,
    adminController.updateCustomer
);

router.delete(
    "/customers/:customerId",
    adminMiddleware,
    adminController.deleteCustomer
);

router.get(
    "/bookings",
    adminMiddleware,
    adminController.getAllBookings
);

router.get(
    "/bookings/:bookingId",
    adminMiddleware,
    adminController.getBookingDetails
);

router.put(
    "/bookings/:bookingId",
    adminMiddleware,
    adminController.updateBooking
);

router.delete(
    "/bookings/:bookingId",
    adminMiddleware,
    adminController.deleteBooking
);

module.exports = router;