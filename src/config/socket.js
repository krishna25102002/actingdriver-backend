const { Server } = require("socket.io");

const { socketAuthMiddleware } = require("../middlewares/socketAuth.middleware");
const { registerSocketHandlers } = require("../sockets/index");
const { setIO } = require("./io");

let httpServer = null;

function initSocket(server) {
    httpServer = server;

    const io = new Server(server, {
        cors: {
            origin: process.env.SOCKET_CORS_ORIGIN
                ? process.env.SOCKET_CORS_ORIGIN.split(",").map((o) => o.trim())
                : "*",
            methods: ["GET", "POST"]
        }
    });

    setIO(io);

    io.use(socketAuthMiddleware);

    io.on("connection", (socket) => {
        registerSocketHandlers(io, socket);
    });

    return io;
}

module.exports = { initSocket };