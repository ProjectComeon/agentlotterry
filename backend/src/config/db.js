const mongoose = require('mongoose');
const { buildDirectMongoUri, isMongoSrvUri } = require('../utils/mongoUri');

const connectDB = async () => {
  const originalUri = process.env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(originalUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return;
  } catch (error) {
    if (isMongoSrvUri(originalUri) && String(error.message || '').includes('querySrv')) {
      try {
        const fallbackUri = await buildDirectMongoUri(originalUri);
        const conn = await mongoose.connect(fallbackUri);
        console.log(`MongoDB Connected via direct URI: ${conn.connection.host}`);
        return;
      } catch (fallbackError) {
        console.error(`MongoDB Connection Error: ${fallbackError.message}`);
        process.exit(1);
      }
    }

    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
