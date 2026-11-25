const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');

// Ensure reliable SRV DNS lookup for mongodb+srv:// URIs on Windows networks
if (env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // ignore if restricted
  }
}

async function connectDB() {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in backend/.env');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  console.log(`[DB] Connected to MongoDB (${mongoose.connection.name})`);
}

module.exports = connectDB;
