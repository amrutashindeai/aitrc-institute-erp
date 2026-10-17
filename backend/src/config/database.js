const mongoose = require('mongoose');
const config = require('./env');

async function connectDatabase(uri = config.MONGODB_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: config.NODE_ENV !== 'production'
  });
  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

function databaseState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    connected: mongoose.connection.readyState === 1,
    state: states[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null
  };
}

module.exports = { connectDatabase, disconnectDatabase, databaseState };
