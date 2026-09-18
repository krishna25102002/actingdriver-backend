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

// ============================
// Platform dashboard + lists (admin panel)
// ============================

exports.getDashboard = async (req, res) => {

    try {

        const result = await adminService.getDashboard();

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getAllDrivers = async (req, res) => {

    try {

        const result = await adminService.getAllDrivers({
            status: req.query.status,
            search: req.query.search,
            limit: req.query.limit
        });

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getCustomers = async (req, res) => {

    try {

        const result = await adminService.getCustomers({
            search: req.query.search,
            limit: req.query.limit
        });

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getCustomerDetails = async (req, res) => {

    try {

        const result = await adminService.getCustomerDetails(
            req.params.customerId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getAllBookings = async (req, res) => {

    try {

        const result = await adminService.getAllBookings({
            status: req.query.status,
            paymentStatus: req.query.paymentStatus,
            search: req.query.search,
            limit: req.query.limit
        });

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getBookingDetails = async (req, res) => {

    try {

        const result = await adminService.getBookingDetails(
            req.params.bookingId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

// ============================
// Admin CRUD — update & delete
// ============================

exports.updateDriver = async (req, res) => {

    try {

        const result = await adminService.updateDriver(
            req.params.driverId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.deleteDriver = async (req, res) => {

    try {

        const result = await adminService.deleteDriver(
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

exports.updateCustomer = async (req, res) => {

    try {

        const result = await adminService.updateCustomer(
            req.params.customerId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.deleteCustomer = async (req, res) => {

    try {

        const result = await adminService.deleteCustomer(
            req.params.customerId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.updateBooking = async (req, res) => {

    try {

        const result = await adminService.updateBooking(
            req.params.bookingId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.deleteBooking = async (req, res) => {

    try {

        const result = await adminService.deleteBooking(
            req.params.bookingId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

// ============================
// Admin — cancellation & reassignment support
// ============================

exports.reassignBookingDriver = async (req, res) => {

    try {

        const result = await adminService.reassignBookingDriver(
            req.admin.adminId,
            req.params.bookingId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

exports.adminCancelBooking = async (req, res) => {

    try {

        const result = await adminService.adminCancelBooking(
            req.admin.adminId,
            req.params.bookingId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

exports.adminMarkDriverNoShow = async (req, res) => {

    try {

        const result = await adminService.adminMarkDriverNoShow(
            req.admin.adminId,
            req.params.bookingId,
            req.body
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};
