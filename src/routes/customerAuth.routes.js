const express = require("express");
const router = express.Router();

const customerAuthController = require("../controllers/customerAuth.controller");
const customerAuthMiddleware = require("../middlewares/customerAuth.middleware");

// Register Customer
router.post("/register", customerAuthController.register);

// Login Customer
router.post("/login", customerAuthController.login);

// Get Logged-in Customer Profile
router.get("/profile", customerAuthMiddleware, customerAuthController.getProfile);

// Update Logged-in Customer Profile
router.put("/profile", customerAuthMiddleware, customerAuthController.updateProfile);

// Forgot Password (email OTP flow)
router.post("/forgotPassword", customerAuthController.forgotPassword);

router.post("/verifyResetOtp", customerAuthController.verifyResetOtp);

router.post("/resetPassword", customerAuthController.resetPassword);

module.exports = router;
