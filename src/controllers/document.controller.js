 const documentService = require("../services/document.service");

exports.uploadDocuments = async (req, res) => {

    try {

        const result = await documentService.uploadDocuments(
            req.driver.driverId,
            req.files
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

exports.getDocuments = async (req, res) => {

    try {

        const result = await documentService.getDocuments(
            req.driver.driverId
        );

        res.status(200).json(result);

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};