const Customer = require("../models/Customer");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

exports.register = async (data) => {

    const existingCustomer = await Customer.findOne({
        phone: data.phone
    });

    if (existingCustomer) {
        throw new Error("Customer already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const customer = await Customer.create({
        name: data.name,
        phone: data.phone,
        email: data.email,
        password: hashedPassword
    });

    const token = jwt.sign(
        {
            customerId: customer._id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d"
        }
    );

    const customerResponse = customer.toObject();
    delete customerResponse.password;

    return {
        success: true,
        message: "Customer Registered Successfully",
        token,
        customer: customerResponse
    };

};

exports.login = async (data) => {

    const customer = await Customer.findOne({
        phone: data.phone
    });

    if (!customer) {
        throw new Error("Customer not found");
    }

    if (customer.isDeleted) {
        throw new Error("This account has been disabled by admin");
    }

    const match = await bcrypt.compare(data.password, customer.password);

    if (!match) {
        throw new Error("Invalid Password");
    }

    const token = jwt.sign(
        {
            customerId: customer._id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d"
        }
    );

    const customerResponse = customer.toObject();
    delete customerResponse.password;

    return {
        success: true,
        message: "Login Successful",
        token,
        customer: customerResponse
    };

};

exports.updateProfile = async (customerId, data) => {

    const customer = await Customer.findById(customerId);

    if (!customer) {
        throw new Error("Customer not found");
    }

    // Only allow updating safe editable fields.
    // Phone is the login identifier and is not changeable here.
    if (data.name !== undefined) {
        if (!String(data.name).trim()) throw new Error("Name cannot be empty");
        customer.name = String(data.name).trim();
    }

    if (data.email !== undefined) {
        customer.email = data.email || "";
    }

    if (data.profileImage !== undefined) {
        customer.profileImage = data.profileImage || "";
    }

    if (data.location !== undefined) {
        const loc = data.location || {};
        customer.location = {
            latitude: loc.latitude != null ? loc.latitude : (customer.location && customer.location.latitude != null ? customer.location.latitude : 0),
            longitude: loc.longitude != null ? loc.longitude : (customer.location && customer.location.longitude != null ? customer.location.longitude : 0),
            address: loc.address || (customer.location && customer.location.address) || ""
        };
    }

    await customer.save();

    const customerResponse = customer.toObject();
    delete customerResponse.password;

    return {
        success: true,
        message: "Profile updated successfully",
        customer: customerResponse
    };

};
