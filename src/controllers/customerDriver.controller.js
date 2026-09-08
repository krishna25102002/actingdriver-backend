const Driver = require("../models/Driver");

exports.getNearbyDrivers = async (req, res) => {

    try {

        const {
            latitude,
            longitude
        } = req.query;

        if (latitude == null || longitude == null) {
            return res.status(400).json({
                success: false,
                message: "latitude and longitude are required"
            });
        }

        const drivers = await Driver.find({
            verificationStatus: "Approved",
            accountStatus: { $in: ["Online", "Busy"] },
            isDeleted: false,
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [
                            Number(longitude),
                            Number(latitude)
                        ]
                    },
                    $maxDistance: 20000
                }
            }
        }).select("-password");

        res.json({
            success: true,
            count: drivers.length,
            drivers
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

exports.getDriverById = async (req, res) => {

    try {

        const driver = await Driver.findById(req.params.id)
            .select("-password");

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        res.json({
            success: true,
            driver
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};
