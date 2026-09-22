const Driver = require("../models/Driver");
const Customer = require("../models/Customer");
const mailer = require("./mailer.service");
const logger = require("../utils/logger");

function fmtDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function money(value) {
    const n = Number(value);
    if (!isFinite(n)) return "—";
    return `₹${n.toLocaleString("en-IN")}`;
}

function bookingSummary(booking) {
    return [
        `Booking number: ${booking.bookingNumber || "—"}`,
        `Trip type: ${booking.tripType || "Local"}`,
        `Date(s): ${fmtDate(booking.fromDate)} → ${fmtDate(booking.toDate)}`,
        `Time: ${booking.startTime || "—"} → ${booking.endTime || "—"}`,
        `Pickup: ${booking.pickupAddress || "—"}`,
        `Drop: ${booking.dropAddress || "—"}`,
        `Estimated fare: ${money(booking.estimatedFare)}`
    ].join("\n");
}

async function loadParties(booking) {
    const [customer, driver] = await Promise.all([
        Customer.findById(booking.customerId).select("name phone email"),
        Driver.findById(booking.driverId || booking.assignedDriverId).select(
            "fullName mobileNumber email"
        )
    ]);
    return { customer, driver };
}

/**
 * Non-failing mail dispatcher. Skips recipients with no stored email; lets
 * mailer.handle (dev-log when SMTP is not configured); logs everything and
 * never throws, so no email failure can ever fail a booking state change.
 */
async function dispatchMail({ booking, recipient, to, subject, text, event }) {
    if (!to) {
        logger.warn(`${event}_skipped`, {
            bookingId: String(booking._id),
            recipient,
            reason: "no_email"
        });
        return;
    }
    try {
        const r = await mailer.sendMail({ to, subject, text });
        logger.info(`${event}_sent`, {
            bookingId: String(booking._id),
            to,
            via: r.via
        });
    } catch (e) {
        logger.error(`${event}_failed`, {
            bookingId: String(booking._id),
            to,
            reason: e.message
        });
    }
}

/**
 * Send booking-confirmation emails to BOTH the customer and the assigned
 * driver. Errors are caught and logged so a mail failure never fails the
 * booking flow.
 */
exports.sendConfirmationEmails = async (booking) => {
    let customer = null;
    let driver = null;
    try {
        ({ customer, driver } = await loadParties(booking));
    } catch (e) {
        logger.error("booking_confirm_email_lookup_failed", {
            bookingId: String(booking._id),
            reason: e.message
        });
        return;
    }

    const summary = bookingSummary(booking);

    await dispatchMail({
        booking,
        recipient: "customer",
        to: customer ? customer.email : "",
        subject: `Booking confirmed – ${booking.bookingNumber || "DriveGo"}`,
        event: "booking_confirm_email",
        text:
            `Hi ${customer ? customer.name : "there"},\n\n` +
            `Great news! Your booking is confirmed.\n\n${summary}\n\n` +
            `Driver: ${driver ? driver.fullName : "To be assigned"} (${driver ? driver.mobileNumber : "—"})\n\n` +
            "Thank you for choosing DriveGo!"
    });

    await dispatchMail({
        booking,
        recipient: "driver",
        to: driver ? driver.email : "",
        subject: `New confirmed booking – ${booking.bookingNumber || "DriveGo"}`,
        event: "booking_confirm_email",
        text:
            `Hi ${driver ? driver.fullName : "Driver"},\n\n` +
            `You have a confirmed booking.\n\n${summary}\n\n` +
            `Customer: ${customer ? customer.name : "—"} (${customer ? customer.phone : "—"})\n\n` +
            "Drive safely!"
    });
};

/**
 * Send trip-completion emails: the customer gets the final fare summary and
 * the driver gets their earnings for the trip.
 */
exports.sendTripCompletionEmails = async (booking) => {
    let customer = null;
    let driver = null;
    try {
        ({ customer, driver } = await loadParties(booking));
    } catch (e) {
        logger.error("trip_complete_email_lookup_failed", {
            bookingId: String(booking._id),
            reason: e.message
        });
        return;
    }

    const fare = booking.fareBreakup || {};
    const finalTotal = booking.actualFare || booking.estimatedFare;

    await dispatchMail({
        booking,
        recipient: "customer",
        to: customer ? customer.email : "",
        subject: `Trip completed – ${booking.bookingNumber || "DriveGo"}`,
        event: "trip_complete_email",
        text:
            `Hi ${customer ? customer.name : "there"},\n\n` +
            `Your trip has been completed. Here is the final summary.\n\n` +
            `Booking number: ${booking.bookingNumber || "—"}\n` +
            `Date(s): ${fmtDate(booking.fromDate)} → ${fmtDate(booking.toDate)}\n` +
            `Time: ${booking.startTime || "—"} → ${booking.endTime || "—"}\n` +
            `Driver: ${driver ? driver.fullName : "—"} (${driver ? driver.mobileNumber : "—"})\n` +
            `Fare breakdown:\n` +
            `  Billable hours: ${fare.billableHours != null ? fare.billableHours : "—"}\n` +
            `  Base fare: ${money(fare.baseFare)}\n` +
            `  Platform fee: ${money(fare.platformFee)}\n` +
            `  GST: ${money(fare.taxGst)}\n` +
            `  Total: ${money(finalTotal)}\n\n` +
            "Please complete the payment in the app. Thank you for choosing DriveGo!"
    });

    await dispatchMail({
        booking,
        recipient: "driver",
        to: driver ? driver.email : "",
        subject: `Trip completed – earnings ${money(booking.driverEarning || booking.estimatedFare)}`,
        event: "trip_complete_email",
        text:
            `Hi ${driver ? driver.fullName : "Driver"},\n\n` +
            `Your trip is completed.\n\n` +
            `Booking number: ${booking.bookingNumber || "—"}\n` +
            `Date(s): ${fmtDate(booking.fromDate)} → ${fmtDate(booking.toDate)}\n` +
            `Customer: ${customer ? customer.name : "—"} (${customer ? customer.phone : "—"})\n` +
            `Your earnings for this trip: ${money(booking.driverEarning || booking.estimatedFare)}\n\n` +
            "View full earnings in your app. Drive safely!"
    });
};

/**
 * Send a payment-receipt email to the customer and a payout-confirmation
 * email to the driver after a Razorpay payment is verified/confirmed.
 */
exports.sendPaymentReceiptEmails = async (booking) => {
    let customer = null;
    let driver = null;
    try {
        ({ customer, driver } = await loadParties(booking));
    } catch (e) {
        logger.error("payment_receipt_email_lookup_failed", {
            bookingId: String(booking._id),
            reason: e.message
        });
        return;
    }

    await dispatchMail({
        booking,
        recipient: "customer",
        to: customer ? customer.email : "",
        subject: `Payment received – ${booking.bookingNumber || "DriveGo"}`,
        event: "payment_receipt_email",
        text:
            `Hi ${customer ? customer.name : "there"},\n\n` +
            `Thank you! We have received your payment for the completed trip.\n\n` +
            `Booking number: ${booking.bookingNumber || "—"}\n` +
            `Amount paid: ${money(booking.actualFare || booking.estimatedFare)}\n` +
            `Payment id: ${booking.paymentGatewayId || "—"}\n\n` +
            "This is your payment receipt. Thank you for choosing DriveGo!"
    });

    await dispatchMail({
        booking,
        recipient: "driver",
        to: driver ? driver.email : "",
        subject: `Payout confirmed – ${booking.bookingNumber || "DriveGo"}`,
        event: "payment_receipt_email",
        text:
            `Hi ${driver ? driver.fullName : "Driver"},\n\n` +
            `The customer has paid for your completed trip.\n\n` +
            `Booking number: ${booking.bookingNumber || "—"}\n` +
            `Trip earnings: ${money(booking.driverEarning || booking.estimatedFare)}\n` +
            `Payment id: ${booking.paymentGatewayId || "—"}\n\n` +
            "Your payout is confirmed in the app. Drive safely!"
    });
};