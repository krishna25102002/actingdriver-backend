const adminConfigService = require("../services/adminConfig.service");

exports.getConfig = async (req, res) => {
    try {
        const result = await adminConfigService.getConfig();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const result = await adminConfigService.updateConfig(
            req.admin && (req.admin.adminId || req.admin.driverId),
            req.body
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
