require('dotenv').config();
const path = require('path');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  security: {
    keyEncryptionSecret: process.env.KEY_ENCRYPTION_SECRET || 'default-dev-secret-change-in-production',
  },

  paths: {
    database: process.env.DATABASE_PATH || path.join(__dirname, '../../data/firessl.json'),
    keys: process.env.KEYS_PATH || path.join(__dirname, '../../data/keys'),
    certs: process.env.CERTS_PATH || path.join(__dirname, '../../data/certs'),
  },

  defaults: {
    validityDays: {
      rootCA: 3650,      // 10 years
      intermediateCA: 1825, // 5 years
      server: 365,       // 1 year
      client: 365,       // 1 year
    },
    keyAlgorithm: 'RSA-2048',
  },
};
