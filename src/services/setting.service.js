const Driver = require("../models/Driver");


// Get Settings
exports.getSettings = async(driverId)=>{


    const driver = await Driver.findById(driverId)
    .select(
        "settings accountStatus fullName mobileNumber"
    );


    if(!driver){

        throw new Error("Driver not found");

    }


    return {

        success:true,

        settings:driver

    };

};




// Update Settings
exports.updateSettings = async(driverId,data)=>{


    const driver = await Driver.findById(driverId);


    if(!driver){

        throw new Error("Driver not found");

    }



    if(data.language){

        driver.settings.language=data.language;

    }


    if(data.notifications !== undefined){

        driver.settings.notifications=data.notifications;

    }


    await driver.save();



    return {

        success:true,

        message:"Settings Updated Successfully",

        settings:driver.settings

    };


};





// Update Language
exports.updateLanguage = async(driverId,language)=>{


    const driver = await Driver.findById(driverId);


    if(!driver){

        throw new Error("Driver not found");

    }


    driver.settings.language=language;


    await driver.save();



    return {

        success:true,

        message:"Language Updated",

        language

    };


};





// Update Notification
exports.updateNotification = async(driverId,status)=>{


    const driver = await Driver.findById(driverId);


    if(!driver){

        throw new Error("Driver not found");

    }


    driver.settings.notifications=status;


    await driver.save();



    return {

        success:true,

        message:"Notification Settings Updated",

        notifications:status

    };


};





// Delete Account
exports.deleteAccount = async(driverId)=>{


    const driver = await Driver.findById(driverId);


    if(!driver){

        throw new Error("Driver not found");

    }


    driver.isDeleted=true;

    driver.accountStatus="Offline";


    await driver.save();



    return {

        success:true,

        message:"Account Deleted Successfully"

    };


};
