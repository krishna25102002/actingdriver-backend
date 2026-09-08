const express = require("express");

const router = express.Router();


const authMiddleware = require("../middlewares/auth.middleware");

const settingController = require("../controllers/setting.controller");



router.get(
    "/",
    authMiddleware,
    settingController.getSettings
);



router.put(
    "/",
    authMiddleware,
    settingController.updateSettings
);



router.put(
    "/language",
    authMiddleware,
    settingController.updateLanguage
);



router.put(
    "/notification",
    authMiddleware,
    settingController.updateNotification
);



router.delete(
    "/account",
    authMiddleware,
    settingController.deleteAccount
);



module.exports = router;