const dashboardService = require("../services/dashboard.service");

exports.getDashboard = async (req, res) => {

    try {

        const result = await dashboardService.getDashboard(
            req.driver.driverId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};