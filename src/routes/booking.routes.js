const express = require("express");

const router = express.Router();

const bookingController = require("../controllers/booking.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post(
    "/",
    bookingController.createBooking
);

router.put(
    "/accept/:bookingId",
    authMiddleware,
    bookingController.acceptBooking
);

router.put(
    "/reject/:bookingId",
    authMiddleware,
    bookingController.rejectBooking
);

router.get(
    "/current",
    authMiddleware,
    bookingController.getCurrentBooking
);

router.get(
    "/current-request",
    authMiddleware,
    bookingController.getCurrentRequest
);

router.put(
    "/reached/:bookingNumber",
    authMiddleware,
    bookingController.reachedPickup
);

router.put(
    "/start/:bookingNumber",
    authMiddleware,
    bookingController.startTrip
);

router.put(
    "/complete/:bookingNumber",
    authMiddleware,
    bookingController.completeTrip
);

router.put(
    "/cancel/:bookingNumber",
    authMiddleware,
    bookingController.cancelTrip
);
router.get(
    "/history",
    authMiddleware,
    bookingController.getTripHistory
);

router.get(
    "/upcoming",
    authMiddleware,
    bookingController.getUpcomingTrips
);

router.get(
    "/history/today",
    authMiddleware,
    bookingController.getTodayTrips
);

router.get(
    "/history/monthly",
    authMiddleware,
    bookingController.getMonthlyTrips
);

router.get(
    "/history/details/:bookingNumber",
    authMiddleware,
    bookingController.getTripDetails
);

module.exports = router;