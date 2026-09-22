require("dotenv").config();
console.log(process.env.MONGO_URI);

const http = require("http");

const app = require("./app");

const connectDB = require("./config/db");
const { initSocket } = require("./config/socket");
const { startCronJobs } = require("./cron/jobRunner");

connectDB().then(() => {
    startCronJobs();
}).catch((err) => {
    console.log("DB init failed:", err && err.message);
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {

    console.log(`Server Running On Port ${PORT}`);

});

module.exports = app;