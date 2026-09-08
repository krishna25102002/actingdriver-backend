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

module.exports = router;
