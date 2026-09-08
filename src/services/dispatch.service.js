const Driver = require("../models/Driver");
const Booking = require("../models/Booking");

/**
 * Find nearby drivers and assign booking
 */
exports.findNearbyDrivers = async (booking) => {

    try {

        console.log("====================================");
        console.log("DISPATCH ENGINE STARTED");
        console.log("Booking :", booking.bookingNumber);
        console.log("Radius :", booking.dispatchRadius, "KM");
        console.log("Attempt :", booking.dispatchAttempt);
        console.log("====================================");

        const nearbyDrivers = await Driver.find({

            accountStatus: "Online",

            verificationStatus: "Approved",

            isAvailable: true,

            currentDispatchRequest: null,

            location: {

                $near: {

                    $geometry: {

                        type: "Point",

                        coordinates: [

                            booking.pickupLocation.longitude,

                            booking.pickupLocation.latitude

                        ]

                    },

                    $maxDistance: booking.dispatchRadius * 1000

                }

            }

        }).limit(5);

        console.log("------------------------------------");
        console.log("Drivers Found :", nearbyDrivers.length);
        console.log("------------------------------------");

        if (nearbyDrivers.length === 0) {

            console.log("No Drivers Found");

            return [];
        }

        const driverIds = nearbyDrivers.map(driver => driver._id);

        await Booking.findByIdAndUpdate(

            booking._id,

            {

                bookingStatus: "Assigned",

                currentNotifiedDrivers: driverIds

            }

        );

        await Driver.updateMany(

            {

                _id: {

                    $in: driverIds

                }

            },

            {

                currentDispatchRequest: booking._id

            }

        );

        console.log("------------------------------------");

        nearbyDrivers.forEach((driver, index) => {

            console.log(

                `${index + 1}. ${driver.fullName} (${driver.mobileNumber})`

            );

        });

        console.log("------------------------------------");

        console.log("Booking Assigned To Nearby Drivers");

        console.log("------------------------------------");

        return nearbyDrivers;

    } catch (error) {

        console.log(error);

        throw error;

    }

};

/**
 * Increase Search Radius
 */
exports.expandSearchRadius = async (bookingId) => {

    const booking = await Booking.findById(bookingId);

    if (!booking) {

        throw new Error("Booking not found");

    }

    if (booking.bookingStatus === "Accepted") {

        console.log("Booking already accepted");

        return;

    }

    if (booking.dispatchRadius >= 50) {

        booking.bookingStatus = "Cancelled";

        booking.cancelReason = "No Drivers Available";

        await booking.save();

        console.log("Booking Cancelled");

        return;

    }

    booking.dispatchRadius += 10;

    booking.dispatchAttempt += 1;

    booking.bookingStatus = "Searching";

    booking.currentNotifiedDrivers = [];

    await booking.save();

    console.log("------------------------------------");

    console.log("Radius Expanded");

    console.log("New Radius :", booking.dispatchRadius);

    console.log("Attempt :", booking.dispatchAttempt);

    console.log("------------------------------------");

    await exports.findNearbyDrivers(booking);

};

/**
 * Release Dispatch Request
 */
exports.releaseDrivers = async (bookingId) => {

    await Driver.updateMany(

        {

            currentDispatchRequest: bookingId

        },

        {

            currentDispatchRequest: null

        }

    );

    console.log("Drivers Released");

};

/**
 * Booking Accepted
 */
exports.bookingAccepted = async (bookingId) => {

    await exports.releaseDrivers(bookingId);

    console.log("Dispatch Closed");

};

/**
 * Booking Cancelled
 */
exports.bookingCancelled = async (bookingId) => {

    await exports.releaseDrivers(bookingId);

    console.log("Booking Cancelled");

};

/**
 * Timer (Temporary)
 */
exports.startDispatchTimer = async (bookingId) => {

    console.log("Dispatch Timer Started");

    setTimeout(async () => {

        console.log("20 Seconds Completed");

        await exports.expandSearchRadius(bookingId);

    }, 20000);

};