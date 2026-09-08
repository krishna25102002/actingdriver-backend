const bookingService = require("../services/booking.service");

exports.createBooking = async (req, res) => {

    try {

        const result = await bookingService.createBooking(req.body);

        res.status(201).json(result);

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};
//booking controller for driver to accept or reject the booking
exports.acceptBooking = async (req, res) => {

    try {

        const result = await bookingService.acceptBooking(

            req.params.bookingId,

            req.driver.driverId

        );

        res.json(result);

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.rejectBooking = async (req, res) => {

    try {

        const result = await bookingService.rejectBooking(

            req.params.bookingId,

            req.driver.driverId

        );

        res.json(result);

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.getCurrentBooking = async (req, res) => {

    try {

        const result = await bookingService.getCurrentBooking(

            req.driver.driverId

        );

        res.json(result);

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.getCurrentRequest = async (req, res) => {

    try {

        const result = await bookingService.getCurrentRequest(

            req.driver.driverId

        );

        res.json(result);

    } catch (err) {

        res.status(400).json({

            success: false,

            message: err.message

        });

    }

};

exports.reachedPickup = async (req, res) => {

    try {

        const result = await bookingService.reachedPickup(

            req.params.bookingNumber,

            req.driver.driverId

        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};

/**
 * Start Trip
 */
exports.startTrip = async (req, res) => {

    try {

        const result = await bookingService.startTrip(

            req.params.bookingNumber,

            req.driver.driverId

        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};


/**
 * Complete Trip
 */
exports.completeTrip = async (req, res) => {

    try {

        const result = await bookingService.completeTrip(

            req.params.bookingNumber,

            req.driver.driverId

        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({

            success: false,

            message: error.message

        });

    }

};


exports.cancelTrip = async (req, res) => {

    try {

        const result = await bookingService.cancelTrip(
            req.params.bookingNumber,
            req.driver.driverId,
            req.body.reason
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });

    }

};

/**
 * Get All Trip History
 */
exports.getTripHistory = async (req, res) => {

    try {

        const result = await bookingService.getTripHistory(
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


/**
 * Today's Trips
 */
exports.getTodayTrips = async (req, res) => {

    try {

        const result = await bookingService.getTodayTrips(
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


/**
 * Monthly Trips
 */
exports.getMonthlyTrips = async (req, res) => {

    try {

        const result = await bookingService.getMonthlyTrips(
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


/**
 * Trip Details
 */
exports.getTripDetails = async (req, res) => {

    try {

        const result = await bookingService.getTripDetails(
            req.driver.driverId,
            req.params.bookingNumber
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.getUpcomingTrips = async (req, res) => {

    try {

        const result = await bookingService.getUpcomingTrips(
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
