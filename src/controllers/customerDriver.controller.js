const Driver = require("../models/Driver");
const Rating = require("../models/Rating");
const Booking = require("../models/Booking");

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

// GET /api/customer/drivers/:id/profile — full public driver profile with
// REAL stats (completed trips, hours/km driven) and every review, so the next
// customer can book with confidence.
exports.getDriverProfile = async (req, res) => {
    try {

        const driver = await Driver.findById(req.params.id).select(
            "fullName profilePhoto mobileNumber city state experience languages " +
                "rating ratingCount ratingSum totalTrips verificationStatus createdAt"
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const [agg, reviews] = await Promise.all([
            Booking.aggregate([
                {
                    $match: {
                        $or: [
                            { assignedDriverId: driver._id },
                            { driverId: driver._id }
                        ],
                        bookingStatus: "Completed"
                    }
                },
                {
                    $group: {
                        _id: null,
                        trips: { $sum: 1 },
                        totalKm: { $sum: { $ifNull: ["$estimatedDistance", 0] } },
                        totalHours: { $sum: { $ifNull: ["$actualHours", { $ifNull: ["$estimatedDuration", 0] }] } }
                    }
                }
            ]),
            Rating.find({ driverId: driver._id })
                .sort({ createdAt: -1 })
                .limit(30)
                .populate("customerId", "name")
        ]);

        const stats = agg[0] || { trips: 0, totalKm: 0, totalHours: 0 };

        const reviewList = reviews.map((r) => ({
            stars: r.stars,
            comment: r.comment,
            customerName: r.customerId ? r.customerId.name : "Verified Customer",
            date: r.createdAt
        }));

        res.json({
            success: true,
            driver: {
                id: driver._id,
                fullName: driver.fullName,
                profilePhoto: driver.profilePhoto || "",
                mobileNumber: driver.mobileNumber || "",
                city: driver.city || "",
                state: driver.state || "",
                experience: driver.experience || 0,
                languages: driver.languages || [],
                rating: driver.rating,
                ratingCount: driver.ratingCount || 0,
                completedTrips: stats.trips,
                totalKm: Math.round(stats.totalKm),
                totalHours: Math.round(stats.totalHours * 10) / 10,
                reviews: reviewList,
                verified: driver.verificationStatus === "Approved"
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
