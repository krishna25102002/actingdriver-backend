const Driver = require("../models/Driver");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

exports.register = async (data) => {

    if (!data.email || !String(data.email).trim()) {
        throw new Error("Email is required");
    }

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

        driver: driverResponse

    };

};

exports.login = async (data) => {

    const driver = await Driver.findOne({

        mobileNumber: data.mobileNumber

    });

    if (!driver) {

        throw new Error("Driver not found");

    }

    if (driver.isDeleted) {

        throw new Error("This account has been disabled by admin");

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