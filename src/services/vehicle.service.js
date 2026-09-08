const Vehicle = require("../models/Vehicle");

exports.addVehicle = async (driverId, data) => {

    const existing = await Vehicle.findOne({
        registrationNumber: data.registrationNumber,
        isDeleted: false
    });

    if (existing && String(existing.driverId) !== String(driverId)) {
        throw new Error("Vehicle registration number already exists");
    }

    const vehicle = await Vehicle.create({
        driverId,
        vehicleType: data.vehicleType,
        registrationNumber: data.registrationNumber,
        make: data.make,
        model: data.model,
        year: data.year,
        color: data.color
    });

    return {
        success: true,
        message: "Vehicle Added Successfully",
        vehicle
    };
};

exports.updateVehicle = async (driverId, vehicleId, data) => {

    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        driverId,
        isDeleted: false
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    vehicle.vehicleType = data.vehicleType || vehicle.vehicleType;
    vehicle.registrationNumber = data.registrationNumber || vehicle.registrationNumber;
    vehicle.make = data.make || vehicle.make;
    vehicle.model = data.model || vehicle.model;
    vehicle.year = data.year || vehicle.year;
    vehicle.color = data.color || vehicle.color;

    await vehicle.save();

    return {
        success: true,
        message: "Vehicle Updated Successfully",
        vehicle
    };
};

exports.getVehicles = async (driverId) => {

    const vehicles = await Vehicle.find({
        driverId,
        isDeleted: false
    });

    return {
        success: true,
        count: vehicles.length,
        vehicles
    };
};

exports.getVehicleById = async (driverId, vehicleId) => {

    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        driverId,
        isDeleted: false
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    return {
        success: true,
        vehicle
    };
};

exports.deleteVehicle = async (driverId, vehicleId) => {

    const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        driverId,
        isDeleted: false
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    vehicle.isDeleted = true;
    await vehicle.save();

    return {
        success: true,
        message: "Vehicle Deleted Successfully"
    };
};