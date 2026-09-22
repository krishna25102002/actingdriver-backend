const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// =========================
// Authentication Routes
// =========================

// Register Driver
router.post("/register", authController.register);

// Login Driver
router.post("/login", authController.login);

// Get Logged-in Driver Profile
router.get("/profile", authMiddleware, authController.getProfile);

// Change Password
router.put("/changePassword", authMiddleware, authController.changePassword);

// Forgot Password (email OTP flow)
router.post("/forgotPassword", authController.forgotPassword);

router.post("/verifyResetOtp", authController.verifyResetOtp);

router.post("/resetPassword", authController.resetPassword);

// Logout (optional for now)
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;