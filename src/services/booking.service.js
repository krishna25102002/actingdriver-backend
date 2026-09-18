const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const CustomerDriverRequest = require("../models/CustomerDriverRequest");
const dispatchService = require("./dispatch.service");
const driverPolicy = require("../utils/driverPolicy");

/**
 * Create Booking
 */
exports.createBooking = async (data) => {

    const booking = await Booking.create({

        bookingNumber: "BK" + Date.now(),

        customerId: data.customerId,

        customerVehicleId: data.customerVehicleId,

        pickupAddress: data.pickupAddress,

        dropAddress: data.dropAddress,

        pickupLocation: data.pickupLocation,

        dropLocation: data.dropLocation,

        estimatedDistance: data.estimatedDistance,

        estimatedDuration: data.estimatedDuration,

        estimatedFare: data.estimatedFare,

        bookingStatus: "Searching",

        dispatchRadius: 10,

        dispatchAttempt: 1

    });

    await dispatchService.findNearbyDrivers(booking);

    dispatchService.startDispatchTimer(booking._id);

    return {

        success: true,

        message: "Booking Created Successfully",

        booking

    };

};

/**
 * Driver Accept Booking
 */
exports.acceptBooking = async (bookingId, driverId) => {

    const booking = await Booking.findOneAndUpdate(

       {
        bookingNumber: bookingId,
        bookingStatus: "Assigned"
    },

        {

            bookingStatus: "Accepted",

            driverId,

            acceptedAt: new Date()

        },

        {

            new: true

        }

    );

    if (!booking) {

        throw new Error("Booking already accepted by another driver");

    }

    await Driver.findByIdAndUpdate(

        driverId,

        {

            accountStatus: "Busy",

            isAvailable: false,

            currentBookingId: booking._id,

            currentDispatchRequest: null,

            currentRideStatus: "HeadingToPickup"

        }

    );

    booking.dispatchStatus = "Accepted";
    booking.tripStatus = "Driver On The Way";
    await booking.save();

    await dispatchService.bookingAccepted(booking._id);

    return {

        success: true,

        message: "Booking Accepted Successfully",

        booking

    };

};

/**
 * Driver Reject Booking
 */
exports.rejectBooking = async (bookingId, driverId) => {

    const booking = await Booking.findOne({

        bookingNumber: bookingId

    });

    if (!booking) {

        throw new Error("Booking not found");

    }

    // Strike policy: X skips/cancels allowed, the next one is restricted.
    await driverPolicy.assertNotRestricted(driverId);

    await Booking.findByIdAndUpdate(

        booking._id,

        {

            $addToSet: {

                rejectedDrivers: driverId

            }

        }

    );

    return {

        success: true,

        message: "Booking Rejected Successfully"

    };

};

/**
 * Current Dispatch Request (pending, not yet accepted)
 */
exports.getCurrentRequest = async (driverId) => {

    const driver = await Driver.findById(driverId);

    if (!driver || !driver.currentDispatchRequest) {
        return {
            success: true,
            message: "No Pending Request",
            booking: null
        };
    }

    const booking = await Booking.findById(driver.currentDispatchRequest)
        .populate("customerId", "fullName mobileNumber")
        .populate("driverId", "fullName mobileNumber profilePhoto rating");

    if (!booking || booking.bookingStatus !== "Assigned") {
        return {
            success: true,
            message: "No Pending Request",
            booking: null
        };
    }

    return {
        success: true,
        booking
    };
};

/**
 * Current Booking
 */
exports.getCurrentBooking = async (driverId) => {

    const booking = await Booking.findOne({

        driverId: driverId,

        bookingStatus: {

            $in: [

                "Accepted",

                "Reached Pickup",

                "Trip Started"

            ]

        }

    })

    .populate("driverId", "fullName mobileNumber profilePhoto rating")

    .populate("customerVehicleId");

    if (!booking) {

        const request = await CustomerDriverRequest.findOne({
            driverId,
            requestStatus: "Accepted"
        }).populate("customerId", "name phone profileImage");

        if (request) {
            return {
                success: true,
                booking: {
                    _id: request._id,
                    bookingNumber: `BKREQ${request._id.toString().slice(-6)}`,
                    customerId: request.customerId,
                    pickupAddress: request.pickupAddress,
                    dropAddress: request.dropAddress,
                    pickupLocation: request.pickupLocation,
                    dropLocation: request.dropLocation,
                    estimatedFare: request.estimatedFare,
                    tripType: request.tripType,
                    bookingStatus: "Accepted",
                    acceptedAt: request.updatedAt || request.requestedAt,
                }
            };
        }

        return {
            success: true,
            message: "No Active Booking",
            booking: null
        };
    }

    return {
        success: true,
        booking
    };
};

exports.reachedPickup = async (

    bookingNumber,

    driverId

) => {

    const booking = await Booking.findOne({

        bookingNumber,

        driverId,

        bookingStatus: "Accepted"

    });

    if (!booking) {

        throw new Error(

            "Booking not found or not accepted."

        );

    }

    booking.bookingStatus = "Reached Pickup";

    booking.reachedAt = new Date();

    booking.tripStatus = "Reached Pickup";

    await booking.save();

    await Driver.findByIdAndUpdate(
        driverId,
        {
            currentRideStatus: "WaitingAtPickup"
        }
    );

    return {

        success: true,

        message: "Driver reached pickup location.",

        booking

    };

};
exports.startTrip = async (

    bookingNumber,

    driverId

) => {

    const booking = await Booking.findOne({

        bookingNumber,

        driverId,

        bookingStatus: "Reached Pickup"

    });

    if (!booking) {

        throw new Error(

            "Driver has not reached pickup location."

        );

    }

    if (!booking.otpVerified) {

        throw new Error(

            "OTP not verified. Please verify OTP before starting the trip."

        );

    }

    booking.bookingStatus = "Trip Started";

    booking.tripStartedAt = new Date();

    booking.tripStatus = "Trip Started";

    await booking.save();

    await Driver.findByIdAndUpdate(
        driverId,
        {
            currentRideStatus: "TripStarted"
        }
    );

    return {

        success: true,

        message: "Trip Started Successfully",

        booking

    };

};
exports.completeTrip = async (

    bookingNumber,

    driverId

) => {

    const booking = await Booking.findOne({

        bookingNumber,

        driverId,

        bookingStatus: "Trip Started"

    });

    if (!booking) {

        throw new Error(

            "Trip has not started."

        );

    }

    booking.bookingStatus = "Completed";

    booking.completedAt = new Date();

    booking.tripStatus = "Trip Completed";

    await booking.save();

    await Driver.findByIdAndUpdate(

        driverId,

        {

            $inc: { totalTrips: 1 },

            accountStatus: "Online",

            isAvailable: true,

            currentBookingId: null,

            currentDispatchRequest: null,

            currentRideStatus: "Idle",

            lastSeen: new Date()

        }

    );

    await dispatchService.bookingCancelled(booking._id);

    return {

        success: true,

        message: "Trip Completed Successfully",

        booking

    };

};

exports.cancelTrip = async (bookingNumber, driverId, reason) => {

    const booking = await Booking.findOne({
        bookingNumber,
        driverId,
        bookingStatus: { $in: ["Accepted", "Reached Pickup"] }
    });

    if (!booking) {
        throw new Error("No active booking found to cancel");
    }

    booking.bookingStatus = "Cancelled";
    booking.cancelReason = reason || "Driver cancelled the booking";
    booking.cancelledAt = new Date();
    booking.dispatchStatus = "Rejected";

    await booking.save();

    await Driver.findByIdAndUpdate(
        driverId,
        {
            accountStatus: "Online",
            isAvailable: true,
            currentBookingId: null,
            currentDispatchRequest: null,
            currentRideStatus: "Idle",
            lastSeen: new Date()
        }
    );

    await dispatchService.bookingCancelled(booking._id);

    return {
        success: true,
        message: "Booking Cancelled Successfully",
        booking
    };
};

exports.getTripHistory = async (driverId) => {

    const bookings = await Booking.find({

        driverId,

        bookingStatus: "Completed"

    }).sort({

        completedAt: -1

    });

    return {

        success: true,

        totalTrips: bookings.length,

        history: bookings

    };

};
exports.getTodayTrips = async (driverId) => {

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const bookings = await Booking.find({

        driverId,

        bookingStatus: "Completed",

        completedAt: {

            $gte: today

        }

    });

    return {

        success: true,

        totalTrips: bookings.length,

        trips: bookings

    };

};
exports.getMonthlyTrips = async (driverId) => {

    const today = new Date();

    const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const bookings = await Booking.find({

        driverId,

        bookingStatus: "Completed",

        completedAt: {

            $gte: firstDay

        }

    });

    return {

        success: true,

        totalTrips: bookings.length,

        trips: bookings

    };

};

exports.getUpcomingTrips = async (driverId) => {

    const bookings = await Booking.find({
        driverId,
        bookingStatus: {
            $in: ["Accepted", "Reached Pickup", "Trip Started"]
        }
    })
        .populate("customerId", "name phone mobileNumber")
        .sort({ acceptedAt: -1 });

    const acceptedRequests = await CustomerDriverRequest.find({
        driverId,
        requestStatus: "Accepted"
    })
        .populate("customerId", "name phone profileImage")
        .sort({ requestedAt: -1 });

    const combinedBookings = [...bookings];
    for (const req of acceptedRequests) {
        const exists = combinedBookings.some(b => b._id.toString() === req._id.toString());
        if (!exists) {
            combinedBookings.push({
                _id: req._id,
                bookingNumber: `BKREQ${req._id.toString().slice(-6)}`,
                customerId: req.customerId,
                pickupAddress: req.pickupAddress,
                dropAddress: req.dropAddress,
                pickupLocation: req.pickupLocation,
                dropLocation: req.dropLocation,
                estimatedFare: req.estimatedFare,
                tripType: req.tripType,
                bookingStatus: "Accepted",
                acceptedAt: req.updatedAt || req.requestedAt,
            });
        }
    }

    combinedBookings.sort((a, b) => new Date(b.acceptedAt || b.createdAt) - new Date(a.acceptedAt || a.createdAt));

    return {
        success: true,
        count: combinedBookings.length,
        bookings: combinedBookings
    };

};

exports.getTripDetails = async (

    driverId,

    bookingNumber

) => {

    const booking = await Booking.findOne({

        driverId,

        bookingNumber

    });

    if (!booking) {

        throw new Error("Trip not found");

    }

    return {

        success: true,

        booking

    };

};