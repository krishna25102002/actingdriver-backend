const vehicleService = require("../services/vehicle.service");

exports.addVehicle = async (req, res) => {

    try {

        const result = await vehicleService.addVehicle(
            req.driver.driverId,
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

exports.getVehicles = async (req, res) => {

    try {

        const result = await vehicleService.getVehicles(
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

exports.getVehicleById = async (req, res) => {

    try {

        const result = await vehicleService.getVehicleById(
            req.driver.driverId,
            req.params.vehicleId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.updateVehicle = async (req, res) => {

    try {

        const result = await vehicleService.updateVehicle(
            req.driver.driverId,
            req.params.vehicleId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.deleteVehicle = async (req, res) => {

    try {

        const result = await vehicleService.deleteVehicle(
            req.driver.driverId,
            req.params.vehicleId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};