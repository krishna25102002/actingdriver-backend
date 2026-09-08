const CustomerDriverRequest = require("../models/CustomerDriverRequest");
const Driver = require("../models/Driver");
const Customer = require("../models/Customer");
const Booking = require("../models/Booking");

exports.createRequest = async (customerId, data) => {

    const driver = await Driver.findById(data.driverId);

    if (!driver) {
        throw new Error("Driver not found");
    }

    const customer = await Customer.findById(customerId);

    const pickupLocation = data.pickupLocation || {};

    const request = await CustomerDriverRequest.create({
        customerId,
        driverId: driver._id,
        pickupAddress: data.pickupAddress || customer?.location?.address || "",
        dropAddress: data.dropAddress || "",
        pickupLocation: {
            latitude: pickupLocation.latitude != null ? pickupLocation.latitude : customer?.location?.latitude || 0,
            longitude: pickupLocation.longitude != null ? pickupLocation.longitude : customer?.location?.longitude || 0
        },
        dropLocation: {
            latitude: data.dropLocation?.latitude || 0,
            longitude: data.dropLocation?.longitude || 0
        },
        estimatedFare: data.estimatedFare || 0,
        tripType: data.tripType || "Local",
        requestedAt: new Date()
    });

    return {
        success: true,
        message: "Booking request sent to driver",
        request
    };
};

exports.getRequests = async (customerId) => {

    const requests = await CustomerDriverRequest.find({
        customerId
    })
        .populate("driverId", "fullName mobileNumber profilePhoto rating totalTrips")
        .sort({ requestedAt: -1 });

    return {
        success: true,
        count: requests.length,
        requests
    };
};

exports.getRequestById = async (customerId, requestId) => {

    const request = await CustomerDriverRequest.findOne({
        _id: requestId,
        customerId
    }).populate("driverId", "fullName mobileNumber profilePhoto rating totalTrips");

    if (!request) {
        throw new Error("Request not found");
    }

    return {
        success: true,
        request
    };
};

exports.cancelRequest = async (customerId, requestId) => {

    const request = await CustomerDriverRequest.findOne({
        _id: requestId,
        customerId
    });

    if (!request) {
        throw new Error("Request not found");
    }

    if (request.requestStatus === "Accepted") {
        throw new Error("Accepted request cannot be cancelled");
    }

    request.requestStatus = "Cancelled";
    await request.save();

    return {
        success: true,
        message: "Request cancelled",
        request
    };
};

exports.getPendingRequestsForDriver = async (driverId) => {

    const driver = await Driver.findById(driverId);
    if (!driver) {
        throw new Error("Driver not found");
    }

    const request = await CustomerDriverRequest.findOne({
        driverId,
        requestStatus: "Requested"
    })
        .populate("customerId", "name phone profileImage")
        .sort({ requestedAt: -1 });

    return {
        success: true,
        request
    };
};

exports.acceptRequest = async (driverId, requestId) => {

    const request = await CustomerDriverRequest.findOne({
        _id: requestId,
        driverId
    });

    if (!request) {
        throw new Error("Request not found");
    }

    if (request.requestStatus !== "Requested") {
        throw new Error("Request already handled");
    }

    request.requestStatus = "Accepted";
    await request.save();

    await CustomerDriverRequest.updateMany(
        {
            _id: { $ne: request._id },
            customerId: request.customerId,
            requestStatus: "Requested"
        },
        { requestStatus: "Cancelled" }
    );

    const booking = await Booking.create({
        bookingNumber: `BKREQ${Date.now()}`,
        customerId: request.customerId,
        driverId,
        pickupAddress: request.pickupAddress,
        dropAddress: request.dropAddress,
        pickupLocation: request.pickupLocation,
        dropLocation: request.dropLocation,
        estimatedFare: request.estimatedFare,
        tripType: request.tripType,
        bookingStatus: "Accepted",
        dispatchStatus: "Accepted",
        acceptedAt: new Date()
    });

    await Driver.findByIdAndUpdate(driverId, {
        accountStatus: "Busy",
        currentBookingId: booking._id,
        currentDispatchRequest: null
    });

    return {
        success: true,
        message: "Booking request accepted",
        booking,
        request
    };
};

exports.rejectRequest = async (driverId, requestId) => {

    const request = await CustomerDriverRequest.findOne({
        _id: requestId,
        driverId
    });

    if (!request) {
        throw new Error("Request not found");
    }

    if (request.requestStatus !== "Requested") {
        throw new Error("Request already handled");
    }

    request.requestStatus = "Rejected";
    await request.save();

    return {
        success: true,
        message: "Booking request rejected",
        request
    };
};
