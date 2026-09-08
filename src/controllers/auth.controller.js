const authService = require("../services/auth.service");
const Driver = require("../models/driver");
const bcrypt = require("bcrypt");


exports.register = async (req, res) => {

    try {

        const result = await authService.register(req.body);

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

        const result = await authService.login(req.body);

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

        const driver = await Driver.findById(req.driver.driverId)
            .select("-password");

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        res.json({
            success: true,
            driver
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


    exports.changePassword = async (req, res) => {
        try {
            const driver = await Driver.findById(req.driver.driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    message: "Driver not found"
                });
            }
            const match = await bcrypt.compare(req.body.oldPassword, driver.password);
            if (!match) {
                return res.status(400).json({
                    success: false,
                    message: "Old password is incorrect"
                });
            }

            const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
            driver.password = hashedPassword;
            await driver.save();
            res.status(200).json({
                success: true,
                message: "Password changed successfully"
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };


    exports.logout = async (req, res) => {
        try {
            // For JWT, logout can be handled on the client side by simply deleting the token.
            res.status(200).json({
                success: true,
                message: "Logged out successfully"
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    };
    
