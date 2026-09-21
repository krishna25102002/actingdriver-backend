const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Driver = require("../models/Driver");
const DriverDocument = require("../models/DriverDocument");
const Customer = require("../models/Customer");
const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const OTP = require("../models/OTP");
const CustomerVehicle = require("../models/CustomerVehicle");
const CustomerDriverRequest = require("../models/CustomerDriverRequest");
const BookingDriverRequest = require("../models/BookingDriverRequest");
const reassignment = require("./reassignment.service");

const startOfDay = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const startOfWeek = () => {
    const d = startOfDay();
    const diff = d.getDate() - d.getDay();
    d.setDate(diff);
    return d;
};

const startOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const revenueGroup = (match) =>
    Booking.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                trips: { $sum: 1 },
                gross: { $sum: { $ifNull: ["$actualFare", "$estimatedFare", 0] } },
                driver: { $sum: { $ifNull: ["$driverEarning", 0] } },
                platform: {
                    $sum: {
                        $add: [
                            { $ifNull: ["$fareBreakup.platformFee", 0] },
                            { $ifNull: ["$fareBreakup.taxGst", 0] }
                        ]
                    }
                }
            }
        }
    ]);


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

// ============================
// Platform dashboard + lists (admin panel)
// ============================

exports.getDashboard = async () => {
    const [
        customers,
        drivers,
        pendingDrivers,
        completedBookings,
        cancelledBookings,
        activeBookings,
        todayBookings,
        revenue,
        paidRevenue,
        weekRevenue,
        monthRevenue
    ] = await Promise.all([
        Customer.countDocuments({ isDeleted: false }),
        Driver.countDocuments({ isDeleted: false }),
        Driver.countDocuments({ verificationStatus: "Pending" }),
        Booking.countDocuments({ bookingStatus: "Completed" }),
        Booking.countDocuments({ bookingStatus: { $in: ["Cancelled", "CANCELLED"] } }),
        Booking.countDocuments({
            bookingStatus: { $in: ["Searching", "Assigned", "Accepted", "PENDING", "CONFIRMED", "ONGOING"] }
        }),
        Booking.countDocuments({ bookingStatus: "Completed", completedAt: { $gte: startOfDay() } }),
        revenueGroup({ bookingStatus: "Completed" }),
        revenueGroup({ bookingStatus: "Completed", paymentStatus: "Paid" }),
        revenueGroup({ bookingStatus: "Completed", completedAt: { $gte: startOfWeek() } }),
        revenueGroup({ bookingStatus: "Completed", completedAt: { $gte: startOfMonth() } })
    ]);

    const flatten = (arr) =>
        arr[0] || { trips: 0, gross: 0, driver: 0, platform: 0 };

    const recent = await Booking.find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("customerId", "name phone")
        .populate("assignedDriverId", "fullName mobileNumber")
        .populate("driverId", "fullName mobileNumber")
        .select("-currentNotifiedDrivers -rejectedDrivers -requestedDriverIds")
        .lean();

    return {
        success: true,
        dashboard: {
            customers,
            drivers,
            pendingDrivers,
            approvedDrivers: drivers - pendingDrivers,
            bookingStats: {
                active: activeBookings,
                completed: completedBookings,
                cancelled: cancelledBookings,
                today: todayBookings
            },
            revenue: {
                total: flatten(revenue),
                paid: flatten(paidRevenue),
                thisWeek: flatten(weekRevenue),
                thisMonth: flatten(monthRevenue)
            },
            recentBookings: recent
        }
    };
};

exports.getAllDrivers = async ({ status, search, limit } = {}) => {
    const filter = { isDeleted: false };
    if (status && status !== "All") {
        if (status === "Online" || status === "Offline" || status === "Busy") {
            filter.accountStatus = status;
        } else {
            filter.verificationStatus = status;
        }
    }
    if (search) {
        filter.$or = [
            { fullName: { $regex: search, $options: "i" } },
            { mobileNumber: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
        ];
    }

    const [drivers, total] = await Promise.all([
        Driver.find(filter)
            .select("fullName mobileNumber email verificationStatus accountStatus rating ratingCount totalTrips city isAvailable createdAt")
            .sort({ createdAt: -1 })
            .limit(Number(limit) || 100)
            .lean(),
        Driver.countDocuments(filter)
    ]);

    return { success: true, count: drivers.length, total, drivers };
};

exports.getCustomers = async ({ search, limit } = {}) => {
    const filter = { isDeleted: false };
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
        ];
    }

    const [customers, total] = await Promise.all([
        Customer.find(filter)
            .select("-password")
            .sort({ createdAt: -1 })
            .limit(Number(limit) || 100)
            .lean(),
        Customer.countDocuments(filter)
    ]);

    const stats = await Booking.aggregate([
        { $match: { customerId: { $in: customers.map((c) => c._id) } } },
        {
            $group: {
                _id: "$customerId",
                bookings: { $sum: 1 },
                spent: {
                    $sum: { $ifNull: ["$actualFare", "$estimatedFare", 0] }
                }
            }
        }
    ]);
    const statMap = {};
    stats.forEach((s) => {
        statMap[String(s._id)] = { bookings: s.bookings, spent: s.spent };
    });

    const enriched = customers.map((c) => ({
        ...c,
        bookings: statMap[String(c._id)]?.bookings || 0,
        spent: statMap[String(c._id)]?.spent || 0
    }));

    return { success: true, count: enriched.length, total, customers: enriched, hasMore: total > (Number(limit) || 100) };
};

exports.getCustomerDetails = async (customerId) => {
    const customer = await Customer.findById(customerId).select("-password");
    if (!customer) throw new Error("Customer not found");

    const bookings = await Booking.find({ customerId })
        .sort({ createdAt: -1 })
        .populate("assignedDriverId", "fullName mobileNumber")
        .select("-currentNotifiedDrivers -rejectedDrivers -requestedDriverIds")
        .lean();

    return { success: true, customer, bookings };
};

exports.getAllBookings = async ({ status, paymentStatus, search, limit } = {}) => {
    const filter = {};
    if (status && status !== "All") filter.bookingStatus = status;
    if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
    if (search) filter.bookingNumber = { $regex: search, $options: "i" };

    const [bookings, total] = await Promise.all([
        Booking.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit) || 100)
            .populate("customerId", "name phone")
            .populate("assignedDriverId", "fullName mobileNumber")
            .populate("driverId", "fullName mobileNumber")
            .select("bookingNumber customerId assignedDriverId driverId fromDate toDate startTime endTime tripType estimatedFare actualFare driverEarning fareBreakup bookingStatus paymentStatus completedAt startedAt")
            .lean(),
        Booking.countDocuments(filter)
    ]);

    return { success: true, count: bookings.length, total, bookings, hasMore: total > (Number(limit) || 100) };
};

exports.getBookingDetails = async (bookingId) => {
    const booking = await Booking.findById(bookingId)
        .populate("customerId", "name phone email")
        .populate("assignedDriverId", "fullName mobileNumber city verificationStatus")
        .populate("driverId", "fullName mobileNumber")
        .populate("customerVehicleId", "brand model vehicleNumber")
        .populate("requestedDriverIds", "fullName mobileNumber verificationStatus");

    if (!booking) throw new Error("Booking not found");

    return { success: true, booking };
};

// ============================
// Admin CRUD — Drivers
// ============================

const DRIVER_EDITABLE_FIELDS = [
    "fullName",
    "email",
    "mobileNumber",
    "gender",
    "address",
    "city",
    "state",
    "pincode",
    "bloodGroup",
    "emergencyContactName",
    "emergencyContactNumber",
    "experience",
    "verificationStatus",
    "accountStatus",
    "rating",
    "totalTrips"
];

const VERIFICATION_STATUSES = ["Pending", "Approved", "Rejected"];
const ACCOUNT_STATUSES = ["Offline", "Online", "Busy"];

exports.updateDriver = async (driverId, data = {}) => {
    const driver = await Driver.findById(driverId);
    if (!driver) throw new Error("Driver not found");

    DRIVER_EDITABLE_FIELDS.forEach((field) => {
        if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
            driver[field] = data[field];
        }
    });

    if (Array.isArray(data.languages)) {
        driver.languages = data.languages
            .map((l) => String(l).trim())
            .filter(Boolean);
    }

    if (data.dateOfBirth) driver.dateOfBirth = new Date(data.dateOfBirth);
    if (driver.verificationStatus === "Approved" && driver.accountStatus === "Online") {
        driver.isAvailable = true;
    }
    if (driver.accountStatus !== "Online") driver.isAvailable = false;

    await driver.save();

    const out = driver.toObject();
    delete out.password;

    return { success: true, message: "Driver updated successfully", driver: out };
};

exports.deleteDriver = async (driverId) => {
    const driver = await Driver.findById(driverId);
    if (!driver) throw new Error("Driver not found");

    // Null out driver references on any active bookings
    await Booking.updateMany(
        { $or: [{ driverId }, { assignedDriverId: driverId }] },
        { $set: { driverId: null, assignedDriverId: null }, $pull: { requestedDriverIds: driverId } }
    );

    // Remove all driver-owned related records
    await Promise.all([
        DriverDocument.deleteMany({ driverId }),
        Vehicle.deleteMany({ driverId }),
        OTP.deleteMany({ driverId }),
        CustomerDriverRequest.deleteMany({ driverId }),
        BookingDriverRequest.deleteMany({ driverId }),
    ]);

    // Permanently remove the driver document
    await Driver.findByIdAndDelete(driverId);

    return { success: true, message: "Driver deleted successfully" };
};

// ============================
// Admin CRUD — Customers
// ============================

exports.updateCustomer = async (customerId, data = {}) => {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");

    if (data.name !== undefined) customer.name = String(data.name);
    if (data.email !== undefined) customer.email = String(data.email);
    if (data.phone !== undefined) customer.phone = String(data.phone);

    await customer.save();

    const out = customer.toObject();
    delete out.password;

    return { success: true, message: "Customer updated successfully", customer: out };
};

exports.deleteCustomer = async (customerId) => {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error("Customer not found");

    // Remove customer-owned related records
    await Promise.all([
        CustomerVehicle.deleteMany({ customerId }),
        CustomerDriverRequest.deleteMany({ customerId }),
    ]);

    // Permanently remove the customer document
    await Customer.findByIdAndDelete(customerId);

    return { success: true, message: "Customer deleted successfully" };
};

// ============================
// Admin CRUD — Bookings
// ============================

const BOOKING_STATUSES = [
    "Searching",
    "Assigned",
    "Accepted",
    "Reached Pickup",
    "Trip Started",
    "Completed",
    "Cancelled",
    "PENDING",
    "CONFIRMED",
    "ONGOING",
    "CANCELLED",
    "EXPIRED",
    "NO_DRIVER_AVAILABLE"
];
const PAYMENT_STATUSES = ["Pending", "Paid", "Refunded"];

exports.updateBooking = async (bookingId, data = {}) => {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    if (data.bookingStatus && BOOKING_STATUSES.includes(data.bookingStatus)) {
        booking.bookingStatus = data.bookingStatus;
    }
    if (data.paymentStatus && PAYMENT_STATUSES.includes(data.paymentStatus)) {
        booking.paymentStatus = data.paymentStatus;
    }
    if (data.actualFare !== undefined && data.actualFare !== "") {
        booking.actualFare = Number(data.actualFare);
    }
    if (data.estimatedFare !== undefined && data.estimatedFare !== "") {
        booking.estimatedFare = Number(data.estimatedFare);
    }
    if (data.driverEarning !== undefined && data.driverEarning !== "") {
        booking.driverEarning = Number(data.driverEarning);
    }
    if (data.advanceAmount !== undefined && data.advanceAmount !== "") {
        booking.advanceAmount = Number(data.advanceAmount);
    }
    if (data.bookingNumber !== undefined && data.bookingNumber !== "") {
        booking.bookingNumber = String(data.bookingNumber);
    }

    await booking.save();

    return { success: true, message: "Booking updated successfully", booking };
};

exports.deleteBooking = async (bookingId) => {
    const booking = await Booking.findByIdAndDelete(bookingId);
    if (!booking) throw new Error("Booking not found");

    return { success: true, message: "Booking deleted successfully" };
};

// ============================
// Admin — cancellation & reassignment support
// ============================

exports.reassignBookingDriver = async (adminId, bookingId, data = {}) => {
    return reassignment.adminReassign(adminId, bookingId, data);
};

exports.adminCancelBooking = async (adminId, bookingId, data = {}) => {
    return reassignment.adminCancel(adminId, bookingId, data);
};

exports.adminMarkDriverNoShow = async (adminId, bookingId, data = {}) => {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (!booking.assignedDriverId) throw new Error("No driver is assigned to this booking");
    return reassignment.markDriverNoShow({ bookingId, driverId: booking.assignedDriverId });
};