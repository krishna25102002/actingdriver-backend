const upload = require("../config/multer");

exports.uploadDocuments = upload.fields([

    {
        name: "profilePhoto",
        maxCount: 1
    },

    {
        name: "aadhaarFront",
        maxCount: 1
    },

    {
        name: "aadhaarBack",
        maxCount: 1
    },

    {
        name: "licenseFront",
        maxCount: 1
    },

    {
        name: "licenseBack",
        maxCount: 1
    },

    {
        name: "selfie",
        maxCount: 1
    },

    {
        name: "vehicleRc",
        maxCount: 1
    }

]);