const express = require("express");
const router = express.Router();

const customerBookingController = require("../controllers/customerBooking.controller");
const customerAuthMiddleware = require("../middlewares/customerAuth.middleware");

// All customer booking routes require authentication
router.use(customerAuthMiddleware);

// Create Booking
router.post("/", customerBookingController.createBooking);

// Get All Customer Bookings
router.get("/", customerBookingController.getBookings);

// Get Booking by ID
router.get("/:id", customerBookingController.getBookingById);

// Get Booking Status (for polling)
router.get("/:id/status", customerBookingController.getBookingStatus);

// Cancel Booking
router.put("/:id/cancel", customerBookingController.cancelBooking);

module.exports = router;
