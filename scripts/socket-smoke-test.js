// Socket smoke test — verifies live-location auth, booking ownership and
// validation WITHOUT touching the REST API. Run:
//   node scripts/socket-smoke-test.js
require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io: Client } = require("socket.io-client");

const { initSocket } = require("../src/config/socket");
const Booking = require("../src/models/Booking");
const Driver = require("../src/models/Driver");
const Customer = require("../src/models/Customer");
const LatestLocation = require("../src/models/LatestLocation");

const PORT = 5199;
const URL = `http://127.0.0.1:${PORT}`;

// Global failsafe so a blocked test can never hang the process.
const failsafe = setTimeout(() => {
    console.error("FAILSAFE: test did not finish in time");
    process.exit(2);
}, 45000);

let results = [];
const check = (name, ok, extra = "") => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  ->  " + extra : ""}`);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (socket, event, ms = 3000) =>
    new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), ms);
        socket.once(event, (data) => {
            clearTimeout(t);
            resolve(data);
        });
    });

const connectClient = (auth) =>
    new Promise((resolve, reject) => {
        const socket = Client(URL, { reconnection: false, auth });
        const t = setTimeout(() => reject(new Error("connect timeout")), 3000);
        socket.on("connect", () => {
            clearTimeout(t);
            resolve(socket);
        });
        socket.on("connect_error", (err) => {
            clearTimeout(t);
            reject(err);
        });
    });

const expectRejected = async (socket, event, emitFn, ms = 3000) => {
    const p = once(socket, event, ms);
    emitFn();
    return p;
};

const clients = [];
const track = (s) => {
    clients.push(s);
    return s;
};

async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/driver_db");

    // Idempotent: clear any leftovers from a previously interrupted run.
    await Booking.deleteMany({ bookingNumber: { $in: ["SMOKE-100", "SMOKE-200"] } });
    await Customer.deleteMany({ phone: { $in: ["9000000001", "9000000002"] } });
    await Driver.deleteMany({ mobileNumber: { $in: ["9111111111", "9111111112"] } });
    await LatestLocation.deleteMany({});

    const customerA = await Customer.create({ name: "A", phone: "9000000001", password: "x" });
    const customerB = await Customer.create({ name: "B", phone: "9000000002", password: "x" });
    const driverA = await Driver.create({ fullName: "DA", mobileNumber: "9111111111" });
    const driverB = await Driver.create({ fullName: "DB", mobileNumber: "9111111112" });

    const booking = await Booking.create({
        bookingNumber: "SMOKE-100",
        customerId: customerA._id,
        driverId: driverA._id,
        assignedDriverId: driverA._id,
        pickupAddress: "Test",
        pickupLocation: { latitude: 12.9, longitude: 77.5 },
        bookingStatus: "CONFIRMED",
        driverAssignmentStatus: "CONFIRMED"
    });
    const otherBooking = await Booking.create({
        bookingNumber: "SMOKE-200",
        customerId: customerB._id,
        driverId: driverB._id,
        assignedDriverId: driverB._id,
        pickupAddress: "Test",
        pickupLocation: { latitude: 12.9, longitude: 77.5 },
        bookingStatus: "PENDING",
        driverAssignmentStatus: "SEARCHING"
    });

    const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
    const tA = token({ customerId: customerA._id });
    const tB = token({ customerId: customerB._id });
    const tDriverA = token({ driverId: driverA._id });
    const tDriverB = token({ driverId: driverB._id });

    const server = http.createServer();
    initSocket(server);
    await new Promise((r) => server.listen(PORT, r));

    let custA = null;

    try {
        // 1. No token -> rejected at handshake
        const anon = Client(URL, { reconnection: false });
        track(anon);
        try {
            await once(anon, "connect_error", 3000);
            check("1. socket without token rejected", true);
        } catch {
            check("1. socket without token rejected", false);
        }

        // 2. Customer A subscribes to own booking -> tracking started
        custA = track(await connectClient({ token: tA }));
        const stateP = once(custA, "tracking:state", 3000);
        custA.emit("booking:subscribe", { bookingId: String(booking._id) });
        const state = await stateP;
        check("2. owner customer joins own room", state.state === "tracking_started", `state=${state.state}`);

        // 3. Customer B tries to subscribe to A's booking -> unauthorized
        const custB = track(await connectClient({ token: tB }));
        const errB = await expectRejected(custB, "location:error", () =>
            custB.emit("booking:subscribe", { bookingId: String(booking._id) })
        );
        check("3. intruder customer rejected", errB.code === "UNAUTHORIZED", `code=${errB.code}`);

        // 4. Driver A updates location -> customer room receives it
        const drvA = track(await connectClient({ token: tDriverA }));
        const updateP = once(custA, "location:updated", 5000);
        drvA.emit("driver:location:update", {
            bookingId: String(booking._id),
            latitude: 12.901, longitude: 77.501,
            accuracy: 8, heading: 90, speed: 12,
            timestamp: new Date().toISOString()
        });
        const d = await updateP;
        check(
            "4. driver location reaches owner room",
            d.role === "driver" && Math.abs(d.latitude - 12.901) < 1e-9,
            `lat=${d.latitude} lng=${d.longitude} acc=${d.accuracy} heading=${d.heading}`
        );

        // 5. Driver B tries to update A's booking -> unauthorized
        const drvB = track(await connectClient({ token: tDriverB }));
        const errDrvB = await expectRejected(drvB, "location:error", () =>
            drvB.emit("driver:location:update", {
                bookingId: String(booking._id),
                latitude: 12.9, longitude: 77.5, timestamp: new Date().toISOString()
            })
        );
        check("5. intruder driver rejected", errDrvB.code === "UNAUTHORIZED", `code=${errDrvB.code}`);

        // 6. Driver B updates their OWN but non-trackable booking -> BOOKING_NOT_ACTIVE
        const errNotActive = await expectRejected(drvB, "location:error", () =>
            drvB.emit("driver:location:update", {
                bookingId: String(otherBooking._id),
                latitude: 12.9, longitude: 77.5, timestamp: new Date().toISOString()
            })
        );
        check("6. non-active booking rejected", errNotActive.code === "BOOKING_NOT_ACTIVE", `code=${errNotActive.code}`);

        // 7. Latest location persisted (single upserted doc)
        await wait(1500); // allow the (10s-throttled) persist to have written
        const latest = await LatestLocation.findOne({ bookingId: booking._id });
        check(
            "7. latest location persisted",
            !!latest && latest.driver && latest.driver.latitude === 12.901,
            latest && `lat=${latest.driver.latitude}`
        );
    } finally {
        for (const s of clients) {
            try { s.disconnect(); } catch (e) {}
        }
        await new Promise((r) => server.close(r));
        await LatestLocation.deleteMany({ bookingId: { $in: [booking._id, otherBooking._id] } });
        await Booking.deleteMany({ _id: { $in: [booking._id, otherBooking._id] } });
        await Customer.deleteMany({ _id: { $in: [customerA._id, customerB._id] } });
        await Driver.deleteMany({ _id: { $in: [driverA._id, driverB._id] } });
        await mongoose.disconnect();
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    clearTimeout(failsafe);
    process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
    console.error("SMOKE TEST CRASHED:", err);
    clearTimeout(failsafe);
    process.exit(1);
});