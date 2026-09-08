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
            req.body.reason
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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
            req.body.reason
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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

exports.driverCancelBooking = async (req, res) => {
    try {
        const result = await actionBookingService.driverCancelBooking(
            req.driver.driverId,
            req.params.id,
            req.body.reason
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
