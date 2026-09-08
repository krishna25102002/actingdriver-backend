const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({

    fullName: {
        type: String,
        required: true
    },

    mobileNumber: {
        type: String,
        required: true,
        unique: true
    },

    email: String,

    password: String,

    profilePhoto: {
        type: String,
        default: ""
    },

    gender: String,

    dateOfBirth: Date,

    address: String,

    city: String,

    state: String,

    pincode: String,

    emergencyContactName: String,

    emergencyContactNumber: String,

    bloodGroup: String,

    experience: {
        type: Number,
        default: 0
    },

    languages: [{
        type: String
    }],

    isProfileCompleted: {
        type: Boolean,
        default: false
    },

    verificationStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },

    accountStatus: {
        type: String,
        enum: ["Offline", "Online", "Busy"],
        default: "Offline"
    },

    rating: {
        type: Number,
        default: 5
    },

    totalTrips: {
        type: Number,
        default: 0
    },

    isAvailable: {
        type: Boolean,
        default: false
    },

    currentBookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null
    },

    lastSeen: {
        type: Date,
        default: Date.now
    },

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    settings: {

    language: {
        type:String,
        default:"English"
    },

    notifications:{
        type:Boolean,
        default:true
    }

},

isDeleted:{
    type:Boolean,
    default:false
},
    currentDispatchRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null
        },

        fcmToken: {
            type: String,
            default: ""
        },

        deviceType: {
            type: String,
            enum: ["Android", "iOS"],
            default: "Android"
        },

        isLocationSharing: {
            type: Boolean,
            default: false
        },

        currentRideStatus: {
            type: String,
            enum: [
                "Idle",
                "HeadingToPickup",
                "WaitingAtPickup",
                "TripStarted",
                "TripCompleted"
            ],
            default: "Idle"
        },

        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null
        }

}, {
    timestamps: true
});

driverSchema.index({ location: "2dsphere" });

module.exports =
    mongoose.models.Driver ||
    mongoose.model("Driver", driverSchema);