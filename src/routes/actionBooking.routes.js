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

// Customer: preview the cancellation fee before confirming cancel.
router.get(
    "/customers/bookings/:id/cancel/preview",
    customerAuthMiddleware,
    actionBookingController.previewCancellation
);

// Customer generates start/end OTP (in-app, read to the driver).
router.post(
    "/customers/bookings/:id/otp",
    customerAuthMiddleware,
    actionBookingController.generateTripOtp
);

// Customer: create Razorpay payment link for the completed trip fare.
router.post(
    "/customers/bookings/:id/pay",
    customerAuthMiddleware,
    actionBookingController.initiatePayment
);

// Customer: verify payment signature after the Razorpay page returns.
router.post(
    "/customers/bookings/:id/pay/verify",
    customerAuthMiddleware,
    actionBookingController.verifyPayment
);

// Customer: get final fare + payment status.
router.get(
    "/customers/bookings/:id/fare",
    customerAuthMiddleware,
    actionBookingController.getTripFare
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

router.get(
    "/drivers/bookings/history",
    authMiddleware,
    actionBookingController.getDriverHistory
);

router.post(
    "/drivers/bookings/:id/cancel",
    authMiddleware,
    actionBookingController.driverCancelBooking
);

// Driver: report they can no longer complete the booking (reassignment flow).
router.post(
    "/drivers/bookings/:id/unavailable",
    authMiddleware,
    actionBookingController.driverUnavailable
);

// Driver: mark the booking "driving to pickup".
router.post(
    "/drivers/bookings/:id/en-route",
    authMiddleware,
    actionBookingController.driverMarkEnRoute
);

// Driver: mark arrival at pickup (starts the customer no-show window).
router.post(
    "/drivers/bookings/:id/arrived",
    authMiddleware,
    actionBookingController.driverMarkArrived
);

// Driver: enter the start OTP the customer showed them to start the trip.
router.post(
    "/drivers/bookings/:id/start",
    authMiddleware,
    actionBookingController.driverStartTrip
);

// Driver: enter the end OTP to end the trip (computes the final fare).
router.post(
    "/drivers/bookings/:id/end",
    authMiddleware,
    actionBookingController.driverEndTrip
);

module.exports = router;
