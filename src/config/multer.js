const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create upload folders if they don't exist
const folders = [
    "uploads/profile",
    "uploads/aadhaar",
    "uploads/license",
    "uploads/selfie",
    "uploads/vehicle"
];

folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        switch (file.fieldname) {

            case "profilePhoto":
                cb(null, "uploads/profile");
                break;

            case "aadhaarFront":
            case "aadhaarBack":
                cb(null, "uploads/aadhaar");
                break;

            case "licenseFront":
            case "licenseBack":
                cb(null, "uploads/license");
                break;

            case "selfie":
                cb(null, "uploads/selfie");
                break;

            case "vehicleRc":
                cb(null, "uploads/vehicle");
                break;

            default:
                cb(new Error("Invalid File Type"));
        }

    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);

    }

});

const fileFilter = (req, file, cb) => {

    const allowedTypes = /jpg|jpeg|png|pdf/;

    const extension = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );

    const mimeType = allowedTypes.test(file.mimetype);

    if (extension && mimeType) {

        cb(null, true);

    } else {

        cb(new Error("Only JPG, PNG and PDF files are allowed"));

    }

};

const upload = multer({

    storage,

    limits: {

        fileSize: 10 * 1024 * 1024

    },

    fileFilter

});

module.exports = upload;