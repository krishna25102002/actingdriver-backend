const customerBookingService = require("../services/customerBooking.service");

exports.createBooking = async (req, res) => {

    try {

        const result = await customerBookingService.createBooking(
            req.customer.customerId,
            req.body
        );

        res.status(201).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.getBookings = async (req, res) => {

    try {

        const result = await customerBookingService.getBookings(
            req.customer.customerId
        );

        res.json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.getBookingById = async (req, res) => {

    try {

        const result = await customerBookingService.getBookingById(
            req.customer.customerId,
            req.params.id
        );

        res.json(result);

    } catch (error) {

        res.status(404).json({
            success: false,
            message: error.message
        });

    }

};

exports.getBookingStatus = async (req, res) => {

    try {

        const result = await customerBookingService.getBookingStatus(
            req.customer.customerId,
            req.params.id
        );

        res.json(result);

    } catch (error) {

        res.status(404).json({
            success: false,
            message: error.message
        });

    }

};

exports.cancelBooking = async (req, res) => {

    try {

        const result = await customerBookingService.cancelBooking(
            req.customer.customerId,
            req.params.id,
            req.body?.reason
        );

        res.json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};
