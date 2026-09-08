const customerDriverRequestService = require("../services/customerDriverRequest.service");

exports.createRequest = async (req, res) => {

    try {

        const result = await customerDriverRequestService.createRequest(
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

exports.getRequests = async (req, res) => {

    try {

        const result = await customerDriverRequestService.getRequests(
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

exports.getRequestById = async (req, res) => {

    try {

        const result = await customerDriverRequestService.getRequestById(
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

exports.cancelRequest = async (req, res) => {

    try {

        const result = await customerDriverRequestService.cancelRequest(
            req.customer.customerId,
            req.params.id
        );

        res.json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.getPendingRequestsForDriver = async (req, res) => {

    try {

        const result = await customerDriverRequestService.getPendingRequestsForDriver(
            req.driver.driverId
        );

        res.json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.acceptRequest = async (req, res) => {

    try {

        const result = await customerDriverRequestService.acceptRequest(
            req.driver.driverId,
            req.params.id
        );

        res.json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.rejectRequest = async (req, res) => {

    try {

        const result = await customerDriverRequestService.rejectRequest(
            req.driver.driverId,
            req.params.id
        );

        res.json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};
