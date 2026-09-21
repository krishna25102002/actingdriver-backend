const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const driverPolicy = require("../utils/driverPolicy");

exports.getDashboard = async (driverId) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {

        throw new Error("Driver not found");

    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const totalTrips = await Booking.countDocuments({

        driverId,

        bookingStatus: "Completed"

    });

    const todayTrips = await Booking.countDocuments({

        driverId,

        bookingStatus: "Completed",

        completedAt: {

            $gte: today

        }

    });

    const monthlyTrips = await Booking.countDocuments({

        driverId,

        bookingStatus: "Completed",

        completedAt: {

            $gte: firstDay

        }

    });

    const cancelledTrips = await Booking.countDocuments({

        driverId,

        bookingStatus: "Cancelled"

    });

    const todayBookings = await Booking.find({

        driverId,

        bookingStatus: "Completed",

        completedAt: {

            $gte: today

        }

    });

    const monthlyBookings = await Booking.find({

        driverId,

        bookingStatus: "Completed",

        completedAt: {

            $gte: firstDay

        }

    });

    let todayEarnings = 0;

    todayBookings.forEach((trip) => {

        todayEarnings += trip.estimatedFare || 0;

    });

    let monthlyEarnings = 0;

    monthlyBookings.forEach((trip) => {

        monthlyEarnings += trip.estimatedFare || 0;

    });

    const completionRate = totalTrips + cancelledTrips === 0
        ? 0
        : Number(
            (
                (totalTrips / (totalTrips + cancelledTrips)) * 100
            ).toFixed(2)
        );

    return {

        success: true,

        dashboard: {

            todayTrips,

            todayEarnings,

            monthlyTrips,

            monthlyEarnings,

            totalTrips,

            completedTrips: totalTrips,

            cancelledTrips,

            acceptanceRate: 100,

            completionRate,

            rating: driver.rating,

            onlineStatus: driver.accountStatus,

            strikePolicy: await driverPolicy.getStrikeSummary(driverId)

        }

    };

};