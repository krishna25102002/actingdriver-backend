const jwt = require("jsonwebtoken");

// Accepts a driver OR a customer JWT (map tile style / routing endpoints are
// shared by both apps). Populates req.driver for drivers and req.customer for
// customers so downstream handlers can read whichever applies.
module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.customerId) {
            req.customer = decoded;
        } else if (decoded.driverId) {
            req.driver = decoded;
        } else {
            return res.status(401).json({ success: false, message: "Invalid token" });
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};