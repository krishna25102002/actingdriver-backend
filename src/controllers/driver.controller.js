const driverService = require("../services/driver.service");

exports.getProfile = async (req, res) => {

    try {

        const result = await driverService.getProfile(req.driver.driverId);

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.updateProfile = async (req, res) => {

    try {

        const result = await driverService.updateProfile(
            req.driver.driverId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.getDriverStatus = async (req, res) => {

    try {

        const result = await driverService.getDriverStatus(
            req.driver.driverId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.updateDriverStatus = async (req, res) => {

    try {

        const result = await driverService.updateDriverStatus(
            req.driver.driverId,
            req.body.status
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.updateLocation = async (req, res) => {

    try {

        const result = await driverService.updateLocation(
            req.driver.driverId,
            req.body
        );

        res.status(200).json(result);

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};