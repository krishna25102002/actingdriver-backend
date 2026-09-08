const Driver = require("../models/Driver");

exports.getProfile = async (driverId) => {

    const driver = await Driver.findById(driverId)
        .select("-password");

    if (!driver) {

        throw new Error("Driver not found");

    }

    return {

        success: true,

        driver

    };

};

exports.updateProfile = async (driverId, data) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {

        throw new Error("Driver not found");

    }

    driver.fullName = data.fullName || driver.fullName;
    driver.email = data.email || driver.email;
    driver.gender = data.gender || driver.gender;
    driver.dateOfBirth = data.dateOfBirth || driver.dateOfBirth;
    driver.address = data.address || driver.address;
    driver.city = data.city || driver.city;
    driver.state = data.state || driver.state;
    driver.pincode = data.pincode || driver.pincode;
    driver.bloodGroup = data.bloodGroup || driver.bloodGroup;
    driver.emergencyContactName =
        data.emergencyContactName || driver.emergencyContactName;
    driver.emergencyContactNumber =
        data.emergencyContactNumber || driver.emergencyContactNumber;

    if (Array.isArray(data.languages)) {
        driver.languages = data.languages;
    }

    if (data.experience !== undefined) {
        driver.experience = data.experience;
    }

    driver.isProfileCompleted = true;

    await driver.save();

    return {

        success: true,

        message: "Profile Updated Successfully",

        driver

    };

};


exports.getDriverStatus = async (driverId) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {
        throw new Error("Driver not found");
    }

    return {
        success: true,
        status: driver.accountStatus,
        isAvailable: driver.isAvailable
    };

};

exports.updateDriverStatus = async (driverId, status) => {

    const allowedStatus = ["Online", "Offline", "Busy"];

    if (!allowedStatus.includes(status)) {
        throw new Error("Invalid status");
    }

    const driver = await Driver.findById(driverId);

    if (!driver) {
        throw new Error("Driver not found");
    }

    // Business Rule
    if (status === "Online" && driver.verificationStatus !== "Approved") {
        throw new Error("Driver is not approved by admin");
    }

    driver.accountStatus = status;
    driver.isAvailable = status === "Online";

    driver.lastSeen = new Date();

    await driver.save();

    return {
        success: true,
        message: `Driver status updated to ${status}`,
        status: driver.accountStatus,
        isAvailable: driver.isAvailable
    };

};

exports.updateLocation = async (driverId, data) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {
        throw new Error("Driver not found");
    }

    driver.location = {
        type: "Point",
        coordinates: [
            data.longitude,
            data.latitude
        ]
    };

    driver.lastSeen = new Date();

    await driver.save();

    return {

        success: true,

        message: "Location Updated Successfully"

    };

};