const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const driverRoutes = require("./routes/driver.routes");
const documentRoutes = require("./routes/document.routes");
const adminRoutes = require("./routes/admin.routes");
const bookingRoutes = require("./routes/booking.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const otpRoutes = require("./routes/otp.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const earningRoutes = require("./routes/earning.routes");
const settingRoutes = require("./routes/setting.routes");

const customerAuthRoutes = require("./routes/customerAuth.routes");
const customerDriverRoutes = require("./routes/customerDriver.routes");
const customerVehicleRoutes = require("./routes/customerVehicle.routes");
const customerBookingRoutes = require("./routes/customerBooking.routes");
const customerDriverRequestRoutes = require("./routes/customerDriverRequest.routes");
const { driverRequestRouter } = require("./routes/customerDriverRequest.routes");

const actionBookingRoutes = require("./routes/actionBooking.routes");
const publicConfigRoutes = require("./routes/publicConfig.routes");

const app = express();

app.use(express.json());

app.use(cors());

app.use(helmet());

app.use(morgan("dev"));

// =====================
// Auth Routes
// =====================
app.use("/api/auth", authRoutes);

app.use("/api/register", authRoutes);

app.use("/api/login", authRoutes);

app.use("/api/profile", authRoutes);

app.use("/api/logout", authRoutes);

app.use("/api/changePassword", authRoutes);

// =====================
// Driver Routes
// =====================
app.use("/api/driver", driverRoutes);

app.use("/api/status", driverRoutes);

app.use("/api/updateStatus", driverRoutes);

app.use("/api/location", driverRoutes);

// =====================
// Vehicle Routes
// =====================
app.use("/api/vehicle", vehicleRoutes);

// =====================
// Document Routes
// =====================
app.use("/api/documents", documentRoutes);

app.use("/api/upload", documentRoutes);

app.use("/api/get", documentRoutes);

// =====================
// Admin Routes
// =====================
app.use("/api/admin", adminRoutes);

app.use("/api/pending-drivers", adminRoutes);

app.use("/api/driver/:driverId", adminRoutes);

app.use("/api/approve/:driverId", adminRoutes);

app.use("/api/reject/:driverId", adminRoutes);

// =====================
// Booking Routes
// =====================
app.use("/api/bookings", bookingRoutes);

app.use("/api/accept/:bookingId", bookingRoutes);

app.use("/api/reject/:bookingId", bookingRoutes);

app.use("/api/current", bookingRoutes);

app.use("/api/reached/:bookingNumber", bookingRoutes);

app.use("/api/start/:bookingNumber", bookingRoutes);

app.use("/api/complete/:bookingNumber", bookingRoutes);

app.use("/api/cancel/:bookingNumber", bookingRoutes);

app.use("/api/history", bookingRoutes);

app.use("/api/history/today", bookingRoutes);

app.use("/api/history/monthly", bookingRoutes);

app.use("/api/history/details/:bookingNumber", bookingRoutes);

// =====================
// OTP Routes
// =====================
app.use("/api/otp", otpRoutes);

// =====================
// Dashboard
// =====================
app.use("/api/dashboard", dashboardRoutes);

// =====================
// Earnings
// =====================
app.use("/api/earnings", earningRoutes);

// =====================
// Settings
// =====================
app.use("/api/settings", settingRoutes);

// =====================
// Customer Routes
// =====================
app.use("/api/customer/auth", customerAuthRoutes);

// Nearby Drivers for Customer
app.use("/api/customer/drivers", customerDriverRoutes);

// Customer Vehicles
app.use("/api/customer/vehicles", customerVehicleRoutes);

// Customer Bookings
app.use("/api/customer/bookings", customerBookingRoutes);

// Customer Driver Requests (sent to drivers)
app.use("/api/customer/driver-requests", customerDriverRequestRoutes);

// Driver side: pending customer-driver requests
app.use("/api/driver/requests", driverRequestRouter);

// =====================
// Acting Driver Booking Flow (1 booking -> up to 10 driver requests)
// =====================
app.use("/api/action", actionBookingRoutes);

// =====================
// Public / Admin App Config (per-hour rate etc.)
// =====================
app.use("/api/config", publicConfigRoutes);

app.get("/", (req, res) => {

    res.send("Hello World");

});

module.exports = app;