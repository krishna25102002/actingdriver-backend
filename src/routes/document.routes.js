 const express = require("express");
const router = express.Router();

const documentController = require("../controllers/document.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const uploadMiddleware = require("../middlewares/upload.middleware");

// =====================================
// Driver Document Routes
// =====================================

// Upload Driver Documents
router.post(
    "/upload",
    authMiddleware,
    uploadMiddleware.uploadDocuments,
    documentController.uploadDocuments
);

// Get Driver Documents
router.get(
    "/",
    authMiddleware,
    documentController.getDocuments
);

module.exports = router;