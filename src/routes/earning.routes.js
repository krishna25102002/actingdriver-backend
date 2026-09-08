const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const earningController = require("../controllers/earning.controller");

router.get("/", authMiddleware, earningController.getEarnings);

router.get("/daily", authMiddleware, earningController.getDailyEarnings);

router.get("/weekly", authMiddleware, earningController.getWeeklyEarnings);

router.get("/monthly", authMiddleware, earningController.getMonthlyEarnings);

router.get("/yearly", authMiddleware, earningController.getYearlyEarnings);

module.exports = router;