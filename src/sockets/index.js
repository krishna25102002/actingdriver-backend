const { registerLocationHandlers } = require("./location.socket");

// Central socket handler mount point. Additional namespaced/feature handlers
// (notifications, dispatch, chat, ...) can be added here later.
function registerSocketHandlers(io, socket) {
    registerLocationHandlers(io, socket);
}

module.exports = { registerSocketHandlers };