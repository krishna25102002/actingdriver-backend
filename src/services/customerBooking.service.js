const Booking = require("../models/Booking");
const CustomerVehicle = require("../models/CustomerVehicle");
const Driver = require("../models/Driver");
const dispatchService = require("./dispatch.service");
const reassignment = require("./reassignment.service");

const generateBookingNumber = () => {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, "0");

    const day = String(now.getDate()).padStart(2, "0");

    const random = Math.floor(1000 + Math.random() * 9000);

    return `BK${year}${month}${day}${random}`;

};

exports.createBooking = async (customerId, data) => {

    let vehicle = null;

    if (data.customerVehicleId) {
        vehicle = await CustomerVehicle.findOne({
            customerId,
            _id: data.customerVehicleId,
            isDeleted: false
        });

        if (!vehicle) {
            throw new Error("Vehicle not found");
        }
    } else if (data.registrationNumber) {
        vehicle = await CustomerVehicle.findOne({
            customerId,
            registrationNumber: data.registrationNumber.toUpperCase(),
            isDeleted: false
        });

        if (!vehicle) {
            throw new Error("Vehicle not found");
        }
    }

    let driver = null;

    if (data.driverId) {
        driver = await Driver.findById(data.driverId);

        if (!driver) {
            throw new Error("Driver not found");
        }

        if (
            driver.verificationStatus !== "Approved" ||
            driver.accountStatus === "Offline"
        ) {
            throw new Error("Driver is currently offline");
        }
    }

    const pickup = typeof data.pickup === "string"
        ? { address: data.pickup, latitude: 0, longitude: 0 }
        : data.pickup;

    const drop = typeof data.drop === "string"
        ? { address: data.drop, latitude: 0, longitude: 0 }
        : data.drop;

    const booking = await Booking.create({
        bookingNumber: generateBookingNumber(),
        customerId,
        driverId: driver ? driver._id : null,
        customerVehicleId: vehicle ? vehicle._id : null,
        pickupAddress: pickup.address,
        dropAddress: drop.address,
        pickupLocation: {
            latitude: pickup.latitude || 0,
            longitude: pickup.longitude || 0
        },
        dropLocation: {
            latitude: drop.latitude || 0,
            longitude: drop.longitude || 0
        },
        estimatedDistance: data.estimatedDistance,
        estimatedDuration: data.estimatedDuration,
        estimatedFare: data.estimatedFare,
        bookingStatus: "Searching",
        dispatchRadius: 10,
        dispatchAttempt: 1,
        tripType: data.tripType,
        tripDate: data.tripDate,
        tripTime: data.tripTime,
        advanceAmount: data.advanceAmount,
        paymentStatus: data.paymentStatus || "Pending"
    });

    await dispatchService.findNearbyDrivers(booking);

    dispatchService.startDispatchTimer(booking._id);

    return {
        success: true,
        message: "Booking created successfully",
        booking
    };

};

exports.getBookings = async (customerId) => {

    const bookings = await Booking.find({
        customerId
    })
        .populate("driverId", "fullName mobileNumber profilePhoto rating")
        .populate("customerVehicleId")
        .sort({
            createdAt: -1
        });

    return {
        success: true,
        count: bookings.length,
        bookings
    };

};

exports.getBookingById = async (customerId, bookingId) => {

    const booking = await Booking.findOne({
        _id: bookingId,
        customerId
    })
        .populate("driverId", "fullName mobileNumber profilePhoto rating")
        .populate("customerVehicleId");

    if (!booking) {
        throw new Error("Booking not found");
    }

    return {
        success: true,
        booking
    };

};

exports.getBookingStatus = async (customerId, bookingId) => {

    const booking = await Booking.findOne({
        _id: bookingId,
        customerId
    })
        .select(
            "bookingNumber bookingStatus tripStatus paymentStatus cancelledBy cancelReason otp estimatedFare driverId"
        )
        .populate("driverId", "fullName mobileNumber profilePhoto rating");

    if (!booking) {
        throw new Error("Booking not found");
    }

    return {
        success: true,
        booking
    };

};

exports.cancelBooking = async (customerId, bookingId, reason) => {

    const booking = await Booking.findOne({
        _id: bookingId,
        customerId
    });

    if (!booking) {
        throw new Error("Booking not found");
    }

    // Atomic claim so a concurrent accept/cancel cannot both win.
    const claim = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            customerId,
            bookingStatus: { $nin: ["Completed", "Cancelled"] }
        },
        {
            $set: {
                bookingStatus: "Cancelled",
                cancelledBy: "Customer",
                cancelReason: reason || "Cancelled by customer",
                cancelledAt: new Date(),
                flowStatus: "CUSTOMER_CANCELLED",
                driverAssignmentStatus: "CANCELLED"
            },
            $push: {
                flowStatusHistory: {
                    status: "CUSTOMER_CANCELLED",
                    at: new Date(),
                    by: "customer"
                }
            }
        },
        { returnDocument: "after" }
    );

    if (!claim) {
        throw new Error("Booking was already cancelled or modified.");
    }

    // Release every dispatched driver, then free the assigned driver slot so
    // the driver can take other trips (previously the driver stayed stuck).
    await dispatchService.bookingCancelled(claim._id);
    const assignedDriverId =
        (claim.assignedDriverId && claim.assignedDriverId._id) ||
        claim.assignedDriverId ||
        claim.driverId;
    if (assignedDriverId) {
        await Driver.findByIdAndUpdate(assignedDriverId, {
            currentBookingId: null,
            currentDispatchRequest: null,
            accountStatus: "Online",
            isAvailable: true
        });
    }

    await reassignment.createCancellationRecord({
        booking: claim,
        driverId: assignedDriverId || null,
        cancelledBy: "CUSTOMER",
        reason: reason || "cancelled by customer",
        driverArrived: false,
        cancellationFee: 0,
        amountDue: 0
    });

    return {
        success: true,
        message: "Booking cancelled successfully",
        booking: claim
    };

};
 