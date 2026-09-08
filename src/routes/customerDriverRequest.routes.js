const express = require("express");
const router = express.Router();

const customerDriverRequestController = require("../controllers/customerDriverRequest.controller");
const customerAuthMiddleware = require("../middlewares/customerAuth.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(customerAuthMiddleware);

router.post("/", customerDriverRequestController.createRequest);

router.get("/", customerDriverRequestController.getRequests);

router.get("/:id", customerDriverRequestController.getRequestById);

router.put("/:id/cancel", customerDriverRequestController.cancelRequest);

module.exports = router;

const driverRequestRouter = express.Router();

driverRequestRouter.get("/pending", authMiddleware, customerDriverRequestController.getPendingRequestsForDriver);

driverRequestRouter.put("/:id/accept", authMiddleware, customerDriverRequestController.acceptRequest);

driverRequestRouter.put("/:id/reject", authMiddleware, customerDriverRequestController.rejectRequest);

module.exports.driverRequestRouter = driverRequestRouter;
