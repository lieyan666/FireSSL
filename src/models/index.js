const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

let db = null;
let dbPath = null;

const EMPTY_DB = {
  certificate_authorities: [],
  certificates: [],
};

function initDatabase() {
  dbPath = config.paths.database;

  // Ensure directories exist
  const dbDir = path.dirname(dbPath);
  for (const dir of [dbDir, config.paths.keys, config.paths.certs]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Load or create
  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, 'utf8');
    db = JSON.parse(raw);
    // Ensure both collections exist (forward-compat)
    if (!db.certificate_authorities) db.certificate_authorities = [];
    if (!db.certificates) db.certificates = [];
  } else {
    db = JSON.parse(JSON.stringify(EMPTY_DB));
    save();
  }

  logger.info('Database initialized', { path: dbPath });
  return db;
}

function save() {
  if (!db || !dbPath) return;
  const tmp = dbPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, dbPath);
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function closeDatabase() {
  if (db) {
    save();
    db = null;
    logger.info('Database closed');
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  save,
};
