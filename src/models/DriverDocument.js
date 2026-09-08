const mongoose = require("mongoose");

const driverDocumentSchema = new mongoose.Schema({

    driverId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Driver",

        required: true

    },

    profilePhoto: {

        type: String,

        default: ""

    },

    aadhaarFront: {

        type: String,

        default: ""

    },

    aadhaarBack: {

        type: String,

        default: ""

    },

    licenseFront: {

        type: String,

        default: ""

    },

    licenseBack: {

        type: String,

        default: ""

    },

    selfie: {

        type: String,

        default: ""

    },

    vehicleRc: {

        type: String,

        default: ""

    },

    status: {

        type: String,

        enum: [

            "Pending",

            "Approved",

            "Rejected"

        ],

        default: "Pending"

    },

    remarks: {

        type: String,

        default: ""

    },

    verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null
},

    verifiedAt: {
        type: Date,
        default: null
    }

}, {

    timestamps: true

});

module.exports =
mongoose.models.DriverDocument ||
mongoose.model("DriverDocument", driverDocumentSchema);