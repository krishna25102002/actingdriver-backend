const customerAuthService = require("../services/customerAuth.service");
const passwordResetService = require("../services/passwordReset.service");

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

exports.forgotPassword = async (req, res) => {

    try {

        const result = await passwordResetService.requestReset({
            email: req.body.email,
            role: "customer"
        });

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({ success: false, message: error.message });

    }

};

exports.verifyResetOtp = async (req, res) => {

    try {

        const result = await passwordResetService.verifyOtp({
            email: req.body.email,
            role: "customer",
            otp: req.body.otp
        });

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({ success: false, message: error.message });

    }

};

exports.resetPassword = async (req, res) => {

    try {

        const result = await passwordResetService.resetPassword({
            email: req.body.email,
            role: "customer",
            otp: req.body.otp,
            newPassword: req.body.newPassword
        });

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({ success: false, message: error.message });

    }

};
