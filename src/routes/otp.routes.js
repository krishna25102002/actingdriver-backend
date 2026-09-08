const express = require("express");
const router = express.Router();

const otpController = require("../controllers/otp.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post(
    "/generate",
    authMiddleware,
    otpController.generateOtp
);

router.post(
    "/verify",
    authMiddleware,
    otpController.verifyOtp
);

module.exports = router;