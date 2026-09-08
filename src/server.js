require("dotenv").config();
console.log(process.env.MONGO_URI);

const app = require("./app");

const connectDB = require("./config/db");

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`Server Running On Port ${PORT}`);

});

module.exports = app;