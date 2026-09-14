require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Driver = require("./src/models/Driver");
const Vehicle = require("./src/models/Vehicle");

/*
   Create 10 dummy drivers that are already APPROVED + ONLINE +
   AVAILABLE so they show up in the customer app and get dispatched.

   Usage:
     node make-dummy-drivers.js                      // defaults below
     node make-dummy-drivers.js 12.9716 77.5946      // center point
     node make-dummy-drivers.js <lat> <lng> <phoneStart> <password>

   Defaults:
     center  -> 12.9716, 77.5946 (Bangalore)
     phones  -> 9876540001 .. 9876540010
     password-> Driver@123
*/
const centerLat = parseFloat(process.argv[2] || "12.9716");
const centerLng = parseFloat(process.argv[3] || "77.5946");
const phoneStart = parseInt(process.argv[4] || "9876540001", 10);
const dummyPassword = process.argv[5] || "Driver@123";

const NAMES = [
    "Ravi Kumar",
    "Arjun Sharma",
    "Suresh Reddy",
    "Vikram Singh",
    "Manoj Patil",
    "Kiran Rao",
    "Rahul Verma",
    "Amit Joshi",
    "Naveen Gupta",
    "Sunil Nair",
];

const VEHICLE_TYPES = ["Sedan", "SUV", "Hatchback", "MUV", "Bike"];
const MAKES = {
    Sedan: ["Toyota", "Honda", "Hyundai"],
    SUV: ["Mahindra", "Tata", "Hyundai"],
    Hatchback: ["Maruti", "Hyundai", "Tata"],
    MUV: ["Toyota", "Kia", "Maruti"],
    Bike: ["Honda", "Bajaj", "TVS"],
};

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected (driver_db)");

        const hashedPassword = await bcrypt.hash(dummyPassword, 10);
        const created = [];
        const updated = [];

        for (let i = 0; i < 10; i++) {
            const mobileNumber = String(phoneStart + i);
            const fullName = NAMES[i];
            const vehicleType = VEHICLE_TYPES[i % VEHICLE_TYPES.length];

            // Small random spread around the center (~0.4-1.5 km) so all
            // drivers are inside the dispatch radius of the pickup point.
            const lat = centerLat + ((Math.random() - 0.5) * 0.01);
            const lng = centerLng + ((Math.random() - 0.5) * 0.01);

            let driver = await Driver.findOne({ mobileNumber });

            if (driver) {
                // Existing account -> just bring it to the approved/live state.
                driver.verificationStatus = "Approved";
                driver.accountStatus = "Online";
                driver.isAvailable = true;
                driver.isProfileCompleted = true;
                driver.isDeleted = false;
                driver.location = {
                    type: "Point",
                    coordinates: [lng, lat],
                };
                updated.push(mobileNumber);
            } else {
                driver = await Driver.create({
                    fullName,
                    mobileNumber,
                    email: `dummy.driver${i + 1}@drivego.test`,
                    password: hashedPassword,
                    gender: "Male",
                    address: "Indiranagar, Bengaluru",
                    city: "Bengaluru",
                    state: "Karnataka",
                    pincode: "560038",
                    emergencyContactName: "Emergency Contact",
                    emergencyContactNumber: "9876500000",
                    bloodGroup: "O+",
                    experience: 2 + i,
                    languages: ["English", "Hindi", "Kannada"],
                    isProfileCompleted: true,
                    verificationStatus: "Approved",
                    accountStatus: "Online",
                    rating: Number((4.0 + i * 0.1).toFixed(1)),
                    totalTrips: 50 + i * 17,
                    isAvailable: true,
                    location: {
                        type: "Point",
                        coordinates: [lng, lat],
                    },
                    isDeleted: false,
                    currentRideStatus: "Idle",
                    lastSeen: new Date(),
                });
                created.push(mobileNumber);
            }

            await driver.save();

            // One verified vehicle per driver so profiles look complete.
            const regNumber = `KA01DR${String(i + 1).padStart(4, "0")}`;
            let vehicle = await Vehicle.findOne({
                registrationNumber: regNumber,
            });

            if (!vehicle) {
                const makeList = MAKES[vehicleType];
                vehicle = await Vehicle.create({
                    driverId: driver._id,
                    vehicleType,
                    registrationNumber: regNumber,
                    make: makeList[i % makeList.length],
                    model:
                        vehicleType === "Bike"
                            ? "Shine"
                            : "Classic",
                    year: 2020 + (i % 4),
                    color: ["White", "Black", "Silver", "Blue", "Red"][i % 5],
                    isVerified: true,
                    isDeleted: false,
                });
            }

            driver.vehicleId = vehicle._id;
            await driver.save();
        }

        console.log("");
        console.log("========================================");
        console.log("DUMMY DRIVERS READY (10, all APPROVED)");
        console.log("========================================");
        console.log("Created : " + (created.length || "0"));
        console.log("Updated : " + (updated.length || "0"));
        console.log("");
        console.log("Credentials (password for all): " + dummyPassword);
        console.log("");
        console.log("Mobile        | Name          | Vehicle | Rating");
        console.log("-----------------------------------------------");

        const all = await Driver.find()
            .select("fullName mobileNumber rating")
            .sort({ mobileNumber: 1 });

        for (const d of all) {
            const vehicle = await Vehicle.findOne({ driverId: d._id });
            console.log(
                `${d.mobileNumber.padEnd(13)}| ${d.fullName.padEnd(14)}| ${
                    vehicle ? vehicle.vehicleType.padEnd(7) : "None   "
                }| ${d.rating}`
            );
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
};

run();