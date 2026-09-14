const Booking = require("../models/Booking");


async function calculateEarnings(driverId, startDate = null) {

    const query = {
        driverId,
        bookingStatus: "Completed"
    };

    if (startDate) {
        query.completedAt = { $gte: startDate };
    }

    const trips = await Booking.find(query);

    const totalTrips = trips.length;

    // Gross earnings = the driver's take for the trip. Action-flow trips store
    // driverEarning (base fare, fees/commission already handled separately);
    // legacy trips fall back to estimatedFare.
    const grossEarnings = trips.reduce((sum, trip) => {
        return sum + (trip.driverEarning || trip.estimatedFare || 0);
    }, 0);

    // Change this later if commission changes.
    const commissionRate = 20;

    const commissionable = trips.filter((t) => !t.driverEarning);
    const commissionBase = commissionable.reduce((sum, trip) => {
        return sum + (trip.estimatedFare || 0);
    }, 0);

    const commission = commissionBase * (commissionRate / 100);

    const netEarnings = grossEarnings - commission;

    return {
        totalTrips,
        grossEarnings,
        commission,
        netEarnings
    };
}

exports.getEarnings = async (driverId) => {

    const today = new Date();
    today.setHours(0,0,0,0);

    const week = new Date();
    week.setDate(week.getDate()-7);

    const month = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const year = new Date(
        today.getFullYear(),
        0,
        1
    );

    const total = await calculateEarnings(driverId);
    const daily = await calculateEarnings(driverId, today);
    const weekly = await calculateEarnings(driverId, week);
    const monthly = await calculateEarnings(driverId, month);
    const yearly = await calculateEarnings(driverId, year);

    return {

        success: true,

        earnings: {

            total,

            daily,

            weekly,

            monthly,

            yearly

        }

    };

};

exports.getDailyEarnings = async (driverId) => {

    const today = new Date();
    today.setHours(0,0,0,0);

    return {
        success:true,
        earnings: await calculateEarnings(driverId, today)
    };

};
exports.getWeeklyEarnings = async (driverId) => {

    const week = new Date();
    week.setDate(week.getDate()-7);

    return {
        success:true,
        earnings: await calculateEarnings(driverId, week)
    };

};

exports.getMonthlyEarnings = async (driverId) => {

    const month = new Date();

    month.setDate(1);

    month.setHours(0,0,0,0);

    return {
        success:true,
        earnings: await calculateEarnings(driverId, month)
    };

};
exports.getYearlyEarnings = async (driverId) => {

    const year = new Date(
        new Date().getFullYear(),
        0,
        1
    );

    return {
        success:true,
        earnings: await calculateEarnings(driverId, year)
    };

};


