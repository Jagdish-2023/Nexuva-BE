const mongoose = require("mongoose");
const mongoURI = process.env.MONGODB_URI;

const initializeDB = async () => {
  try {
    const connection = await mongoose.connect(mongoURI);
    if (connection) {
      console.log("DB connected successfully");
    }
  } catch (error) {
    console.log("Failed to connect to DB", error);
  }
};

module.exports = initializeDB;
