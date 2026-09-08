const customerAuthService = require("../services/customerAuth.service");

const Customer = require("../models/Customer");

exports.register = async (req, res) => {

    try {

        const result = await customerAuthService.register(req.body);

        res.status(201).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.login = async (req, res) => {

    try {

        const result = await customerAuthService.login(req.body);

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.getProfile = async (req, res) => {

    try {

        const customer = await Customer.findById(req.customer.customerId)
            .select("-password");

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            customer
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.updateProfile = async (req, res) => {

    try {

        const result = await customerAuthService.updateProfile(
            req.customer.customerId,
            req.body
        );

        res.json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};
