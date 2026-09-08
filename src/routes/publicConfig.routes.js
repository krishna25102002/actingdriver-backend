const express = require("express");
const router = express.Router();

const adminConfigController = require("../controllers/adminConfig.controller");
const adminMiddleware = require("../middlewares/admin.middleware");

// Public: get global app config (per-hour rate etc.) - no auth required.
router.get("/", adminConfigController.getConfig);

// Admin protected: update global app config.
router.put("/", adminMiddleware, adminConfigController.updateConfig);

module.exports = router;
