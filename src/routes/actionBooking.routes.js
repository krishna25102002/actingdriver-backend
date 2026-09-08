const express = require("express");
const router = express.Router();

const actionBookingController = require("../controllers/actionBooking.controller");
const customerAuthMiddleware = require("../middlewares/customerAuth.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

// =====================
// CUSTOMER — acting driver booking flow
// =====================
router.get(
    "/customers/available-drivers",
    customerAuthMiddleware,
    actionBookingController.getAvailableDrivers
);

router.post(
    "/customers/bookings",
    customerAuthMiddleware,
    actionBookingController.createBooking
);

router.get(
    "/customers/bookings/upcoming",
    customerAuthMiddleware,
    actionBookingController.getCustomerUpcoming
);

router.get(
    "/customers/bookings",
    customerAuthMiddleware,
    actionBookingController.listCustomerBookings
);

router.get(
    "/customers/bookings/:id",
    customerAuthMiddleware,
    actionBookingController.getCustomerBookingById
);

router.post(
    "/customers/bookings/:id/cancel",
    customerAuthMiddleware,
    actionBookingController.cancelBooking
);

// =====================
// DRIVER — acting driver booking flow
// =====================
router.get(
    "/drivers/booking-requests",
    authMiddleware,
    actionBookingController.getPendingRequests
);

router.get(
    "/drivers/booking-requests/:id",
    authMiddleware,
    actionBookingController.getRequestById
);

router.post(
    "/drivers/booking-requests/:id/accept",
    authMiddleware,
    actionBookingController.acceptRequest
);

router.post(
    "/drivers/booking-requests/:id/reject",
    authMiddleware,
    actionBookingController.rejectRequest
);

router.get(
    "/drivers/bookings/upcoming",
    authMiddleware,
    actionBookingController.getDriverUpcoming
);

router.post(
    "/drivers/bookings/:id/cancel",
    authMiddleware,
    actionBookingController.driverCancelBooking
);

module.exports = router;
