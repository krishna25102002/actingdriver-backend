const settingService = require("../services/setting.service");


// Get Settings
exports.getSettings = async (req, res) => {

    try {

        const result = await settingService.getSettings(
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


// Update All Settings
exports.updateSettings = async (req, res) => {

    try {

        const result = await settingService.updateSettings(

            req.driver.driverId,

            req.body

        );

        res.status(200).json(result);


    } catch (error) {

        res.status(500).json({

            success:false,
            message:error.message

        });

    }

};



// Update Language
exports.updateLanguage = async (req, res) => {

    try {

        const result = await settingService.updateLanguage(

            req.driver.driverId,

            req.body.language

        );


        res.status(200).json(result);


    } catch(error){

        res.status(500).json({

            success:false,
            message:error.message

        });

    }

};




// Update Notification
exports.updateNotification = async (req,res)=>{


    try{


        const result = await settingService.updateNotification(

            req.driver.driverId,

            req.body.notifications

        );


        res.status(200).json(result);


    }catch(error){


        res.status(500).json({

            success:false,
            message:error.message

        });

    }

};




// Delete Account
exports.deleteAccount = async(req,res)=>{


    try{


        const result = await settingService.deleteAccount(

            req.driver.driverId

        );


        res.status(200).json(result);



    }catch(error){


        res.status(500).json({

            success:false,
            message:error.message

        });

    }


};