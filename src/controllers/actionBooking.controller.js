const actionBookingService = require("../services/actionBooking.service");

// =====================
// CUSTOMER
// =====================

exports.getAvailableDrivers = async (req, res) => {
    try {
        const result = await actionBookingService.getAvailableDrivers(req.query);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.createBooking = async (req, res) => {
    try {
        const result = await actionBookingService.createBooking(
            req.customer.customerId,
            req.body
        );
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getCustomerUpcoming = async (req, res) => {
    try {
        const result = await actionBookingService.getCustomerUpcoming(
            req.customer.customerId
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.listCustomerBookings = async (req, res) => {
    try {
        const result = await actionBookingService.getCustomerBookings(
            req.customer.customerId,
            req.query.status
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getCustomerBookingById = async (req, res) => {
    try {
        const result = await actionBookingService.getCustomerBookingById(
            req.customer.customerId,
            req.params.id
        );
        res.json(result);
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const result = await actionBookingService.cancelBooking(
            req.customer.customerId,
            req.params.id,
            req.body?.reason
        );
        res.json(result);
    } catch (error) {
        const status = error.code === "CANCELLATION_NOT_ALLOWED" ? 400 : 400;
        res.status(status).json({
            success: false,
            message: error.message,
            ...(error.code ? { code: error.code } : {})
        });
    }
};

// Customer: preview the cancellation fee WITHOUT cancelling.
exports.previewCancellation = async (req, res) => {
    try {
        const result = await actionBookingService.previewCancellation(
            req.customer.customerId,
            req.params.id
        );
        res.json(result);
    } catch (error) {
        const status = error.code === "CANCELLATION_NOT_ALLOWED" ? 400 : 400;
        res.status(status).json({
            success: false,
            message: error.message,
            ...(error.code ? { code: error.code } : {})
        });
    }
};

// =====================
// DRIVER
// =====================

exports.getPendingRequests = async (req, res) => {
    try {
        const result = await actionBookingService.getPendingRequests(
            req.driver.driverId
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getRequestById = async (req, res) => {
    try {
        const result = await actionBookingService.getRequestById(
            req.driver.driverId,
            req.params.id
        );
        res.json(result);
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.acceptRequest = async (req, res) => {
    try {
        const result = await actionBookingService.acceptRequest(
            req.driver.driverId,
            req.params.id
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.rejectRequest = async (req, res) => {
    try {
        const result = await actionBookingService.rejectRequest(
            req.driver.driverId,
            req.params.id,
            req.body?.reason
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
            ...(error.code ? { code: error.code } : {})
        });
    }
};

exports.getDriverUpcoming = async (req, res) => {
    try {
        const result = await actionBookingService.getDriverUpcoming(
            req.driver.driverId
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDriverHistory = async (req, res) => {
    try {
        const result = await actionBookingService.getDriverHistory(
            req.driver.driverId
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDriverRejectedRequests = async (req, res) => {
    try {
        const result = await actionBookingService.getDriverRejectedRequests(
            req.driver.driverId
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.driverCancelBooking = async (req, res) => {
    try {
        const result = await actionBookingService.driverCancelBooking(
            req.driver.driverId,
            req.params.id,
            req.body?.reason
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Driver: report they can no longer complete the booking (reassignment flow).
exports.driverUnavailable = async (req, res) => {
    try {
        const result = await actionBookingService.driverUnavailable(
            req.driver.driverId,
            req.params.id,
            {
                reason: req.body?.reason,
                description: req.body?.description
            }
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Driver: mark the booking "driving to pickup".
exports.driverMarkEnRoute = async (req, res) => {
    try {
        const result = await actionBookingService.driverMarkEnRoute(
            req.driver.driverId,
            req.params.id
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Driver: mark arrival at pickup (starts the customer no-show window).
exports.driverMarkArrived = async (req, res) => {
    try {
        const result = await actionBookingService.driverMarkArrived(
            req.driver.driverId,
            req.params.id
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =====================
// OTP TRIP LIFECYCLE
// =====================

exports.generateTripOtp = async (req, res) => {
    try {
        const result = await actionBookingService.generateTripOtp({
            customerId: req.customer.customerId,
            bookingId: req.params.id
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.driverStartTrip = async (req, res) => {
    try {
        const result = await actionBookingService.driverStartTrip({
            driverId: req.driver.driverId,
            bookingId: req.params.id,
            enteredOtp: req.body.otp
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.driverEndTrip = async (req, res) => {
    try {
        const result = await actionBookingService.driverEndTrip({
            driverId: req.driver.driverId,
            bookingId: req.params.id,
            enteredOtp: req.body.otp
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.initiatePayment = async (req, res) => {
    try {
        const result = await actionBookingService.initiatePayment({
            customerId: req.customer.customerId,
            bookingId: req.params.id,
            returnUrl: req.body.returnUrl
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const result = await actionBookingService.verifyPayment({
            customerId: req.customer.customerId,
            bookingId: req.params.id,
            razorpayOrderId: req.body.orderId,
            razorpayPaymentId: req.body.paymentId,
            signature: req.body.signature
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getTripFare = async (req, res) => {
    try {
        const result = await actionBookingService.getTripFare({
            customerId: req.customer.customerId,
            bookingId: req.params.id
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Customer: rate the driver of a completed trip.
exports.rateTrip = async (req, res) => {
    try {
        const result = await actionBookingService.rateTrip({
            customerId: req.customer.customerId,
            bookingId: req.params.id,
            stars: req.body.stars,
            comment: req.body.comment
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
