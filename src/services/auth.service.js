const Driver = require("../models/Driver");

const Vehicle = require("../models/Vehicle");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

console.log("Driver Type:", typeof Driver);
console.log("Driver:", Driver);
console.log("Driver.findOne:", Driver.findOne);
console.log("Driver.create:", Driver.create);

// Log the Driver model to ensure it's loaded correctly   
exports.register = async (data) => {

    const existingDriver = await Driver.findOne({
        mobileNumber: data.mobileNumber
    });

    if (existingDriver) {

        throw new Error("Driver already exists");

    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const driver = await Driver.create({

        fullName: data.fullName || data.name,

        mobileNumber: data.mobileNumber || data.phoneNumber,

        email: data.email,

        city: data.city,

        state: data.state,

        password: hashedPassword

    });

    let vehicle = null;

    if (data.vehicleType && (data.registrationNumber || data.vehicleNumber)) {

        vehicle = await Vehicle.create({

            driverId: driver._id,

            vehicleType: data.vehicleType,

            registrationNumber: data.registrationNumber || data.vehicleNumber,

            make: data.make,

            model: data.model,

            year: data.year,

            color: data.color

        });

        driver.vehicleId = vehicle._id;

        await driver.save();

    }

    const driverResponse = driver.toObject();

    delete driverResponse.password;

    const token = jwt.sign(

        {

            driverId: driver._id

        },

        process.env.JWT_SECRET,

        {

            expiresIn: process.env.JWT_EXPIRES_IN

        }

    );

    return {

        success: true,

        message: "Driver Registered Successfully",

        token,

        driver: driverResponse,

        vehicle

    };

};

exports.login = async (data) => {

    const driver = await Driver.findOne({

        mobileNumber: data.mobileNumber

    });

    if (!driver) {

        throw new Error("Driver not found");

    }

    const match = await bcrypt.compare(

        data.password,

        driver.password

    );

    if (!match) {

        throw new Error("Invalid Password");

    }

    const token = jwt.sign(

        {

            driverId: driver._id

        },

        process.env.JWT_SECRET,

        {

            expiresIn: process.env.JWT_EXPIRES_IN

        }

    );

    return {

        success: true,

        message: "Login Successful",

        token,

        driver

    };

};