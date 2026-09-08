const CustomerVehicle = require("../models/CustomerVehicle");

exports.addVehicle = async (req, res) => {

    try {

        const vehicle = await CustomerVehicle.create({
            customerId: req.customer.customerId,
            ...req.body
        });

        res.status(201).json({
            success: true,
            message: "Vehicle added successfully",
            vehicle
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.getVehicles = async (req, res) => {

    try {

        const vehicles = await CustomerVehicle.find({
            customerId: req.customer.customerId,
            isDeleted: false
        });

        res.json({
            success: true,
            count: vehicles.length,
            vehicles
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.getVehicleById = async (req, res) => {

    try {

        const vehicle = await CustomerVehicle.findOne({
            _id: req.params.id,
            customerId: req.customer.customerId,
            isDeleted: false
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        res.json({
            success: true,
            vehicle
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.updateVehicle = async (req, res) => {

    try {

        const vehicle = await CustomerVehicle.findOneAndUpdate(
            {
                _id: req.params.id,
                customerId: req.customer.customerId
            },
            req.body,
            {
                new: true
            }
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        res.json({
            success: true,
            message: "Vehicle updated",
            vehicle
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.deleteVehicle = async (req, res) => {

    try {

        const vehicle = await CustomerVehicle.findOneAndUpdate(
            {
                _id: req.params.id,
                customerId: req.customer.customerId
            },
            {
                isDeleted: true
            },
            {
                new: true
            }
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        res.json({
            success: true,
            message: "Vehicle deleted"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// Update ONLY the car model. Ignore everything else in the body.
exports.updateVehicleModel = async (req, res) => {

    try {

        const model = (req.body.model || "").toString().trim();

        if (!model) {
            return res.status(400).json({
                success: false,
                message: "Vehicle model is required"
            });
        }

        const vehicle = await CustomerVehicle.findOneAndUpdate(
            {
                _id: req.params.id,
                customerId: req.customer.customerId,
                isDeleted: false
            },
            { model },
            { new: true }
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found"
            });
        }

        res.json({
            success: true,
            message: "Vehicle model updated",
            vehicle
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};
