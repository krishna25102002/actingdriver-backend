 const Driver = require("../models/Driver");
const DriverDocument = require("../models/DriverDocument");

exports.uploadDocuments = async (driverId, files) => {

    const driver = await Driver.findById(driverId);

    if (!driver) {
        throw new Error("Driver not found");
    }

    let documents = await DriverDocument.findOne({ driverId });

    if (!documents) {

        documents = new DriverDocument({
            driverId
        });

    }

    if (files.profilePhoto) {
        documents.profilePhoto = files.profilePhoto[0].path;
    }

    if (files.aadhaarFront) {
        documents.aadhaarFront = files.aadhaarFront[0].path;
    }

    if (files.aadhaarBack) {
        documents.aadhaarBack = files.aadhaarBack[0].path;
    }

    if (files.licenseFront) {
        documents.licenseFront = files.licenseFront[0].path;
    }

    if (files.licenseBack) {
        documents.licenseBack = files.licenseBack[0].path;
    }

    if (files.selfie) {
        documents.selfie = files.selfie[0].path;
    }

    if (files.vehicleRc) {
        documents.vehicleRc = files.vehicleRc[0].path;
    }

    documents.status = "Pending";

    await documents.save();

    driver.verificationStatus = "Pending";

    await driver.save();

    return {

        success: true,

        message: "Documents Uploaded Successfully",

        documents

    };

};

exports.getDocuments = async (driverId) => {

    const documents = await DriverDocument.findOne({ driverId });

    if (!documents) {

        throw new Error("Documents not found");

    }

    return {

        success: true,

        documents

    };

};