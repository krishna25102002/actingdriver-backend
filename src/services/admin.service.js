const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Driver = require("../models/Driver");
const DriverDocument = require("../models/DriverDocument");


exports.login = async (data) => {

    const admin = await Admin.findOne({
        email: data.email
    });

    if (!admin) {
        throw new Error("Admin not found");
    }

    const match = await bcrypt.compare(
        data.password,
        admin.password
    );

    if (!match) {
        throw new Error("Invalid Password");
    }

    const token = jwt.sign(

        {
            adminId: admin._id,
            role: admin.role
        },

        process.env.JWT_SECRET,

        {
            expiresIn: "7d"
        }

    );

    const adminResponse = admin.toObject();
    delete adminResponse.password;

    return {

        success: true,

        message: "Admin Login Successful",

        token,

        admin: adminResponse

    };

};

exports.getProfile = async (adminId) => {

    const admin = await Admin.findById(adminId)
        .select("-password");

    if (!admin) {

        throw new Error("Admin not found");

    }

    return {

        success: true,

        admin

    };

};


exports.getPendingDrivers = async () => {

    const drivers = await Driver.find({

        verificationStatus: "Pending"

    }).select("-password");

    return {

        success: true,

        count: drivers.length,

        drivers

    };

};

exports.getDriverDetails = async (driverId) => {

    const driver = await Driver.findById(driverId)
        .select("-password");

    if (!driver) {

        throw new Error("Driver not found");

    }

    const documents = await DriverDocument.findOne({

        driverId

    });

    return {

        success: true,

        driver,

        documents

    };

};

exports.approveDriver = async (driverId, adminId) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {

        throw new Error("Driver not found");

    }

    driver.verificationStatus = "Approved";

    await driver.save();

    await DriverDocument.findOneAndUpdate(

        {

            driverId

        },

        {

            status: "Approved",

            remarks: "",

            verifiedBy: adminId,

            verifiedAt: new Date()

        }

    );

    return {

        success: true,

        message: "Driver Approved Successfully"

    };

};

exports.rejectDriver = async (

    driverId,

    adminId,

    remarks

) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {

        throw new Error("Driver not found");

    }

    driver.verificationStatus = "Rejected";

    await driver.save();

    await DriverDocument.findOneAndUpdate(

        {

            driverId

        },

        {

            status: "Rejected",

            remarks,

            verifiedBy: adminId,

            verifiedAt: new Date()

        }

    );

    return {

        success: true,

        message: "Driver Rejected Successfully"

    };

};