const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const StorageService = {
  /**
   * Encrypt and save a private key to a file
   * @param {string} id - Unique identifier for the key
   * @param {string} privateKey - PEM encoded private key
   * @returns {string} Path to the saved key file
   */
  savePrivateKey(id, privateKey) {
    const encryptedData = encrypt(privateKey, config.security.keyEncryptionSecret);
    const filePath = path.join(config.paths.keys, `${id}.key.enc`);

    fs.writeFileSync(filePath, encryptedData);

    // Set restrictive permissions (owner read/write only)
    try {
      fs.chmodSync(filePath, 0o600);
    } catch (err) {
      // chmod may fail on some systems (e.g., Windows)
      logger.warn('Could not set file permissions', { path: filePath, error: err.message });
    }

    logger.debug('Private key saved', { id, path: filePath });
    return filePath;
  },

  /**
   * Load and decrypt a private key from a file
   * @param {string} filePath - Path to the encrypted key file
   * @returns {string} PEM encoded private key
   */
  loadPrivateKey(filePath) {
    const encryptedData = fs.readFileSync(filePath, 'utf8');
    return decrypt(encryptedData, config.security.keyEncryptionSecret);
  },

  /**
   * Save a certificate to a file
   * @param {string} id - Unique identifier for the certificate
   * @param {string} certificate - PEM encoded certificate
   * @returns {string} Path to the saved certificate file
   */
  saveCertificate(id, certificate) {
    const filePath = path.join(config.paths.certs, `${id}.crt`);
    fs.writeFileSync(filePath, certificate);
    logger.debug('Certificate saved', { id, path: filePath });
    return filePath;
  },

  /**
   * Load a certificate from a file
   * @param {string} filePath - Path to the certificate file
   * @returns {string} PEM encoded certificate
   */
  loadCertificate(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  },

  /**
   * Delete a key file
   * @param {string} filePath - Path to the key file
   */
  deleteKey(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug('Key file deleted', { path: filePath });
    }
  },

  /**
   * Delete a certificate file
   * @param {string} filePath - Path to the certificate file
   */
  deleteCertificate(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug('Certificate file deleted', { path: filePath });
    }
  },

  /**
   * Save an EC key pair (stores both public and private keys for later reconstruction)
   * @param {string} id - Unique identifier
   * @param {string} privateKey - PEM encoded private key
   * @param {string} publicKey - PEM encoded public key
   * @returns {string} Path to the saved key file
   */
  saveECKeyPair(id, privateKey, publicKey) {
    const keyData = JSON.stringify({ privateKey, publicKey });
    const encryptedData = encrypt(keyData, config.security.keyEncryptionSecret);
    const filePath = path.join(config.paths.keys, `${id}.key.enc`);

    fs.writeFileSync(filePath, encryptedData);

    try {
      fs.chmodSync(filePath, 0o600);
    } catch (err) {
      logger.warn('Could not set file permissions', { path: filePath, error: err.message });
    }

    logger.debug('EC key pair saved', { id, path: filePath });
    return filePath;
  },

  /**
   * Load an EC key pair
   * @param {string} filePath - Path to the encrypted key file
   * @returns {{ privateKey: string, publicKey: string }} PEM encoded keys
   */
  loadECKeyPair(filePath) {
    const encryptedData = fs.readFileSync(filePath, 'utf8');
    const keyData = decrypt(encryptedData, config.security.keyEncryptionSecret);
    return JSON.parse(keyData);
  },
};

/**
 * Encrypt data using AES-256-GCM
 */
function encrypt(data, secret) {
  const key = crypto.scryptSync(secret, 'firessl-salt', 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  });
}

/**
 * Decrypt data using AES-256-GCM
 */
function decrypt(encryptedJson, secret) {
  const { iv, encrypted, authTag } = JSON.parse(encryptedJson);

  const key = crypto.scryptSync(secret, 'firessl-salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = StorageService;
