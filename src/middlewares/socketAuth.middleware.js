const jwt = require("jsonwebtoken");

const Driver = require("../models/Driver");
const Customer = require("../models/Customer");

// Authenticate every socket connection from headers/handshake, never from the
// event payload. Driver tokens carry { driverId }, customer tokens carry
// { customerId } — the role is inferred from whichever claim exists.
module.exports.socketAuthMiddleware = async (socket, next) => {
    try {
        const token =
            socket.handshake.auth && socket.handshake.auth.token
                ? socket.handshake.auth.token
                : "";

        if (!token) {
            return next(new Error("UNAUTHORIZED"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.customerId) {
            const customer = await Customer.findById(decoded.customerId).lean();
            if (!customer || customer.isDeleted) {
                return next(new Error("UNAUTHORIZED"));
            }
            socket.user = { role: "customer", _id: customer._id.toString() };
            return next();
        }

        if (decoded.driverId) {
            const driver = await Driver.findById(decoded.driverId).lean();
            if (!driver || driver.isDeleted) {
                return next(new Error("UNAUTHORIZED"));
            }
            socket.user = { role: "driver", _id: driver._id.toString() };
            return next();
        }

        return next(new Error("UNAUTHORIZED"));
    } catch (err) {
        return next(new Error("UNAUTHORIZED"));
    }
};