const otpService = require("../services/otp.service");

exports.generateOtp = async (req, res) => {

    try {

        const result = await otpService.generateOtp(
            req.body.bookingNumber,
            req.driver.driverId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

exports.verifyOtp = async (req, res) => {

    try {

        const result = await otpService.verifyOtp(
            req.body.bookingNumber,
            req.driver.driverId,
            req.body.otp
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};