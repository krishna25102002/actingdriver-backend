const crypto = require("crypto");
const Razorpay = require("razorpay");

const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

let instance = null;
if (KEY_ID && KEY_SECRET) {
    instance = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
}

const isConfigured = () => !!instance && !!KEY_ID && !!KEY_SECRET;

const requireRazorpay = () => {
    if (!isConfigured()) {
        throw new Error(
            "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Backend/.env"
        );
    }
    return instance;
};

/**
 * Verify the payment-link/gateway signature:
 * HMAC-SHA256(key_secret) of `${orderId}|${paymentId}`.
 */
exports.verifySignature = ({ orderId, paymentId, signature }) => {
    requireRazorpay();
    if (!orderId || !paymentId || !signature) return false;
    const expected = crypto
        .createHmac("sha256", KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, "hex"),
            Buffer.from(signature, "hex")
        );
    } catch (e) {
        return false;
    }
};

/**
 * Create a hosted Razorpay Payment Link. Opens in the system browser —
 * no native SDK required. link.status becomes "paid" once payment succeeds.
 */
exports.createPaymentLink = async ({
    amountInPaise,
    description,
    customerName,
    customerEmail,
    customerPhone,
    callbackUrl
}) => {
    const rzp = requireRazorpay();
    const link = await rzp.paymentLink.create({
        amount: Math.round(amountInPaise),
        currency: "INR",
        accept_partial: false,
        description: description || "DriveGo driver booking payment",
        callback_url: callbackUrl || "",
        callback_method: "get",
        customer: {
            name: customerName || "DriveGo Customer",
            email: customerEmail || `customer${Date.now()}@drivergo.local`,
            contact: customerPhone || ""
        },
        notify: {
            email: false,
            sms: false
        }
    });
    return link;
};

/**
 * Fetch the current status of a payment link.
 */
exports.fetchPaymentLink = async (linkId) => {
    const rzp = requireRazorpay();
    return rzp.paymentLink.fetch(linkId);
};

exports.getKeyId = () => KEY_ID;
exports.isConfigured = isConfigured;