require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { initDatabase } = require('./models');

// Initialize database
initDatabase();

// Start server
const server = app.listen(config.port, () => {
  logger.info(`FireSSL server started`, {
    port: config.port,
    env: config.env,
  });
  console.log(`\n🔐 FireSSL running at http://localhost:${config.port}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});
