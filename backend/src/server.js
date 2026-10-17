
const dns = require('node:dns');

// Use Google DNS for MongoDB SRV lookups
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = require('./app');
const config = require('./config/env');
const {
  connectDatabase,
  disconnectDatabase,
} = require('./config/database');

let server;

async function start() {
  await connectDatabase();

  server = app.listen(config.PORT, () => {
    console.info(
      `Institute ERP API listening on port ${config.PORT} (${config.NODE_ENV})`
    );
  });
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down gracefully`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await disconnectDatabase();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
  start().catch(async (error) => {
    console.error('Failed to start API:', error.message);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
}

module.exports = { start, shutdown };
