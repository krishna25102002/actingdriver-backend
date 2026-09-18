const CustomerDriverRequest = require("../models/CustomerDriverRequest");
const Driver = require("../models/Driver");
const Customer = require("../models/Customer");
const Booking = require("../models/Booking");
const driverPolicy = require("../utils/driverPolicy");

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

    // ATOMIC first-accept-wins: claim this driver's request in a single update.
    // If it fails, the request was already handled by someone else.
    const claim = await CustomerDriverRequest.findOneAndUpdate(
        {
            _id: requestId,
            driverId,
            requestStatus: "Requested"
        },
        {
            $set: {
                requestStatus: "Accepted"
            }
        },
        { returnDocument: "after" }
    );

    if (!claim) {
        const existing = await CustomerDriverRequest.findOne({
            _id: requestId,
            driverId
        });
        if (!existing) {
            throw new Error("Request not found");
        }
        throw new Error("Request already handled");
    }

    // Close every other pending request for this customer so no other driver
    // can accept a parallel request and create a duplicate booking afterwards.
    await CustomerDriverRequest.updateMany(
        {
            customerId: claim.customerId,
            _id: { $ne: claim._id },
            requestStatus: "Requested"
        },
        { requestStatus: "Cancelled" }
    );

    // If a rival request for this customer was already accepted (booking got
    // created first), roll this claim back to avoid a duplicate booking.
    const rival = await CustomerDriverRequest.findOne({
        customerId: claim.customerId,
        _id: { $ne: claim._id },
        requestStatus: "Accepted"
    });
    if (rival) {
        await CustomerDriverRequest.updateOne(
            { _id: claim._id },
            { $set: { requestStatus: "Cancelled" } }
        );
        throw new Error("Another driver has already accepted a request from this customer.");
    }

    const booking = await Booking.create({
        bookingNumber: `BKREQ${Date.now()}`,
        customerId: claim.customerId,
        driverId,
        pickupAddress: claim.pickupAddress,
        dropAddress: claim.dropAddress,
        pickupLocation: claim.pickupLocation,
        dropLocation: claim.dropLocation,
        estimatedFare: claim.estimatedFare,
        tripType: claim.tripType,
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
        request: claim
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

    // Strike policy: X skips/cancels allowed, the next one is restricted.
    await driverPolicy.assertNotRestricted(driverId);

    request.requestStatus = "Rejected";
    await request.save();

    return {
        success: true,
        message: "Booking request rejected",
        request
    };
};
