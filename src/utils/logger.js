/**
 * Minimal structured logger for booking lifecycle events.
 * Never accepts or writes passwords, API keys, access tokens or payment
 * secrets — callers pass only bookingId/driverId/status/reason/meta.
 */

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL || "INFO").toUpperCase()] || LEVELS.INFO;

const ts = () => new Date().toISOString();

const write = (level, msg, fields) => {
    if (LEVELS[level] < currentLevel) return;
    const line = JSON.stringify({
        level,
        time: ts(),
        message: msg,
        ...(fields || {})
    });
    // eslint-disable-next-line no-console
    console.log(line);
};

const logEvent = (event, fields = {}) => {
    write("INFO", event, {
        event,
        bookingId: fields.bookingId ? String(fields.bookingId) : undefined,
        driverId: fields.driverId ? String(fields.driverId) : undefined,
        oldStatus: fields.oldStatus,
        newStatus: fields.newStatus,
        reason: fields.reason || undefined,
        at: ts(),
        ...(fields.meta || {})
    });
};

const logger = {
    logEvent,
    debug: (msg, fields) => write("DEBUG", msg, fields),
    info: (msg, fields) => write("INFO", msg, fields),
    warn: (msg, fields) => write("WARN", msg, fields),
    error: (msg, fields) => write("ERROR", msg, fields)
};

module.exports = logger;