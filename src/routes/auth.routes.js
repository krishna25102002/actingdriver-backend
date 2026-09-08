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

// Logout (optional for now)
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;