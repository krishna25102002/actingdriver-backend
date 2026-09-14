const express = require("express");
const router = express.Router();

const actionBookingService = require("../services/actionBooking.service");

/**
 * Public GET callback that Razorpay redirects the payer's browser to after a
 * payment link is paid. The browser (on the same LAN as the phone) can reach
 * our server even though Razorpay servers cannot. We verify the link status
 * server-side before marking the booking Paid.
 */
router.get("/pay-link/callback", async (req, res) => {
    const paymentLinkId =
        req.query.razorpay_payment_link_id ||
        req.query.payment_link_id;

    res.type("html");
    try {
        const result = await actionBookingService.handlePaymentLinkCallback(paymentLinkId);
        const ok = result.success && (result.message || "").includes("verified");
        res.send(
            `<html><body style="font-family:sans-serif;text-align:center;padding:80px 20px;background:#f5f5f5;">
                <h2 style="color:${ok ? "#16a34a" : "#d97706"};">${ok ? "Payment Successful ✓" : "Payment Pending"}</h2>
                <p>${result.message || "You can close this page and return to the app."}</p>
            </body></html>`
        );
    } catch (error) {
        res.status(400).send(
            `<html><body style="font-family:sans-serif;text-align:center;padding:80px 20px;">
                <h3>${error.message}</h3>
            </body></html>`
        );
    }
});

module.exports = router;