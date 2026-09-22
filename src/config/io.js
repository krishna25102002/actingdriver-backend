// Dependency-free holder for the Socket.IO server instance. Kept in its own
// module so nothing else needs to form a require() cycle to reach `io` at
// runtime (config/socket, sockets/index, location handlers and services can
// all safely depend on this single leaf module).
let io = null;

function setIO(instance) {
    io = instance;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io has not been initialized yet");
    }
    return io;
}

module.exports = { setIO, getIO };