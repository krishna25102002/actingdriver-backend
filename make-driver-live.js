require("dotenv").config();

const mongoose = require("mongoose");
const Driver = require("./src/models/Driver");

// Helper: approve + go online a driver so it appears in the customer app.
// Usage: node make-driver-live.js <phone> <latitude> <longitude>
//   phone      -> the mobileNumber the driver registered with in the DRIVER app
//   latitude   -> e.g. 12.9716
//   longitude  -> e.g. 77.5946
const phone = process.argv[2];
const lat = parseFloat(process.argv[3] || "12.9716");
const lng = parseFloat(process.argv[4] || "77.5946");

if (!phone) {
    console.log("Usage: node make-driver-live.js <phone> <latitude> <longitude>");
    process.exit(1);
}

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected (driver_db)");

        const driver = await Driver.findOne({ mobileNumber: phone });

        if (!driver) {
            console.log("No driver found with phone:", phone);
            console.log("Registered drivers in DB:");
            const all = await Driver.find().select("fullName mobileNumber verificationStatus accountStatus");
            all.forEach((d) => {
                console.log(
                    `  ${d.fullName} | ${d.mobileNumber} | verify=${d.verificationStatus} | acct=${d.accountStatus}`
                );
            });
            process.exit(1);
        }

        driver.verificationStatus = "Approved";
        driver.accountStatus = "Online";
        driver.isAvailable = true;
        driver.location = {
            type: "Point",
            coordinates: [lng, lat],
        };
        await driver.save();

        console.log("Driver now live & visible to the customer app:");
        console.log(`  Name: ${driver.fullName}`);
        console.log(`  Phone: ${driver.mobileNumber}`);
        console.log(`  Verification: ${driver.verificationStatus}`);
        console.log(`  Account: ${driver.accountStatus}`);
        console.log(`  Location: [${lng}, ${lat}]`);

        await mongoose.disconnect();
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
};

run();