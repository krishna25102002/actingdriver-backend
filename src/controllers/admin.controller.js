const adminService = require("../services/admin.service");

exports.login = async (req, res) => {

    try {

        const result = await adminService.login(req.body);

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

exports.getProfile = async (req, res) => {

    try {

        const result = await adminService.getProfile(
            req.admin.adminId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

exports.logout = async (req, res) => {

    res.status(200).json({

        success: true,

        message: "Admin Logged Out Successfully"

    });

};

//drives approval and rejection
exports.getPendingDrivers = async (req, res) => {

    try {

        const result = await adminService.getPendingDrivers();

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getDriverDetails = async (req, res) => {

    try {

        const result = await adminService.getDriverDetails(
            req.params.driverId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.approveDriver = async (req, res) => {

    try {

        const result = await adminService.approveDriver(
            req.params.driverId,
            req.admin.adminId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.rejectDriver = async (req, res) => {

    try {

        const result = await adminService.rejectDriver(
            req.params.driverId,
            req.admin.adminId,
            req.body.remarks
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
