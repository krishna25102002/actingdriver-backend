const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) return null;

    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    return transporter;
}

// Returns { delivered: boolean, via: "smtp" | "dev-log" }
exports.sendMail = async ({ to, subject, text, html }) => {
    const smtp = getTransporter();

    if (!smtp) {
        // Dev fallback: no SMTP configured — just log so the flow can be tested.
        console.log(
            "\n========== [MAIL DEV MODE] ==========\n" +
            `TO: ${to}\nSUBJECT: ${subject}\n` +
            `${text || html}\n` +
            "======================================\n"
        );
        return { delivered: false, via: "dev-log" };
    }

    await smtp.sendMail({
        from: process.env.MAIL_FROM || `"DriveGo" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html
    });

    return { delivered: true, via: "smtp" };
};