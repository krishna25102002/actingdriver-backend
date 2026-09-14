/*
   Create / update the admin user for the DriveGo admin panel.

   Usage:
     node create-admin.js                      // defaults admin@drivergo.com / Admin@123
     node create-admin.js <email> <password>
*/
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("./src/models/Admin");

const email = (process.argv[2] || "admin@drivergo.com").toLowerCase();
const password = process.argv[3] || "Admin@123";
const role = "SUPER_ADMIN";

async function run() {
    console.log("Connecting to:", process.env.MONGO_URI || "mongodb://127.0.0.1:27017/driver_db");
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/driver_db");

    const hash = await bcrypt.hash(password, 10);

    const admin = await Admin.findOneAndUpdate(
        { email },
        {
            $set: {
                password: hash,
                role,
                name: email.split("@")[0] || "Admin"
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { new: true, upsert: true }
    );

    console.log("Admin ready ->");
    console.log("  email   :", admin.email);
    console.log("  password:", password);
    console.log("  role    :", admin.role);

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});