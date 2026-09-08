const earningService = require("../services/earning.service");

exports.getEarnings = async (req, res) => {
    try {
        const result = await earningService.getEarnings(req.driver.driverId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getDailyEarnings = async (req, res) => {
    try {
        const result = await earningService.getDailyEarnings(req.driver.driverId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getWeeklyEarnings = async (req, res) => {
    try {
        const result = await earningService.getWeeklyEarnings(req.driver.driverId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getMonthlyEarnings = async (req, res) => {
    try {
        const result = await earningService.getMonthlyEarnings(req.driver.driverId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getYearlyEarnings = async (req, res) => {
    try {
        const result = await earningService.getYearlyEarnings(req.driver.driverId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};