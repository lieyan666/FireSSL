const { v4: uuidv4 } = require('uuid');
const CAModel = require('../models/ca.model');
const CertModel = require('../models/cert.model');
const CryptoService = require('./crypto');
const StorageService = require('./storage.service');
const config = require('../config');
const logger = require('../utils/logger');
const { NotFoundError, ConflictError, ValidationError } = require('../middleware/errorHandler');

const CAService = {
  /**
   * Create a root CA
   */
  async createRootCA({
    name,
    commonName,
    organization,
    country,
    keyAlgorithm = config.defaults.keyAlgorithm,
    validityDays = config.defaults.validityDays.rootCA,
  }) {
    const id = uuidv4();

    // Generate key pair
    const keys = await CryptoService.generateKeyPair(keyAlgorithm);

    const subject = { commonName, organization, country };

    // Create certificate
    let certResult;
    if (CryptoService.isRSA(keyAlgorithm)) {
      certResult = await CryptoService.createRootCA({
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        subject,
        validityDays,
        keyAlgorithm,
      });
    } else {
      certResult = await CryptoService.createRootCA({
        keyPair: keys.keyPair,
        subject,
        validityDays,
        keyAlgorithm,
      });
    }

    // Save key and certificate
    let keyFilePath;
    if (CryptoService.isEC(keyAlgorithm)) {
      keyFilePath = StorageService.saveECKeyPair(id, keys.privateKey, keys.publicKey);
    } else {
      keyFilePath = StorageService.savePrivateKey(id, keys.privateKey);
    }
    const certFilePath = StorageService.saveCertificate(id, certResult.certificate);

    // Save to database
    CAModel.create({
      id,
      name,
      type: 'root',
      parentId: null,
      commonName,
      organization,
      country,
      keyAlgorithm,
      keyFilePath,
      certFilePath,
      serialNumber: certResult.serialNumber,
      notBefore: certResult.notBefore,
      notAfter: certResult.notAfter,
      fingerprint: certResult.fingerprint,
    });

    logger.info('Root CA created', { id, name, commonName });

    return this.getById(id);
  },

  /**
   * Create an intermediate CA
   */
  async createIntermediateCA({
    name,
    parentId,
    commonName,
    organization,
    country,
    keyAlgorithm = config.defaults.keyAlgorithm,
    validityDays = config.defaults.validityDays.intermediateCA,
  }) {
    // Verify parent CA exists and is active
    const parentCA = CAModel.findById(parentId);
    if (!parentCA) {
      throw new NotFoundError(`Parent CA not found: ${parentId}`);
    }
    if (parentCA.status !== 'active') {
      throw new ValidationError('Parent CA is not active');
    }

    // Check key algorithm compatibility
    const parentIsEC = CryptoService.isEC(parentCA.key_algorithm);
    const childIsEC = CryptoService.isEC(keyAlgorithm);

    // For simplicity, require same key type (RSA with RSA, EC with EC)
    if (parentIsEC !== childIsEC) {
      throw new ValidationError('Intermediate CA must use the same key type as parent CA (RSA with RSA, EC with EC)');
    }

    const id = uuidv4();

    // Generate key pair
    const keys = await CryptoService.generateKeyPair(keyAlgorithm);

    // Load parent CA key and certificate
    const parentCert = StorageService.loadCertificate(parentCA.cert_file_path);
    let parentKey, parentKeyPair;

    if (parentIsEC) {
      const ecKeys = StorageService.loadECKeyPair(parentCA.key_file_path);
      parentKeyPair = {
        privateKey: await CryptoService.EC.importPrivateKey(ecKeys.privateKey, parentCA.key_algorithm),
        publicKey: await CryptoService.EC.importPublicKey(ecKeys.publicKey, parentCA.key_algorithm),
      };
    } else {
      parentKey = StorageService.loadPrivateKey(parentCA.key_file_path);
    }

    const subject = { commonName, organization: organization || parentCA.organization, country: country || parentCA.country };

    // Create certificate
    let certResult;
    if (CryptoService.isRSA(keyAlgorithm)) {
      certResult = await CryptoService.createIntermediateCA({
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        subject,
        issuerCert: parentCert,
        issuerKey: parentKey,
        validityDays,
        keyAlgorithm,
      });
    } else {
      certResult = await CryptoService.createIntermediateCA({
        keyPair: keys.keyPair,
        subject,
        issuerCert: parentCert,
        issuerKeyPair: parentKeyPair,
        validityDays,
        keyAlgorithm,
      });
    }

    // Save key and certificate
    let keyFilePath;
    if (CryptoService.isEC(keyAlgorithm)) {
      keyFilePath = StorageService.saveECKeyPair(id, keys.privateKey, keys.publicKey);
    } else {
      keyFilePath = StorageService.savePrivateKey(id, keys.privateKey);
    }
    const certFilePath = StorageService.saveCertificate(id, certResult.certificate);

    // Save to database
    CAModel.create({
      id,
      name,
      type: 'intermediate',
      parentId,
      commonName,
      organization: subject.organization,
      country: subject.country,
      keyAlgorithm,
      keyFilePath,
      certFilePath,
      serialNumber: certResult.serialNumber,
      notBefore: certResult.notBefore,
      notAfter: certResult.notAfter,
      fingerprint: certResult.fingerprint,
    });

    logger.info('Intermediate CA created', { id, name, commonName, parentId });

    return this.getById(id);
  },

  /**
   * List all CAs
   */
  list(options = {}) {
    return CAModel.findAll(options);
  },

  /**
   * Get CA by ID
   */
  getById(id) {
    const ca = CAModel.findById(id);
    if (!ca) {
      throw new NotFoundError(`CA not found: ${id}`);
    }
    return ca;
  },

  /**
   * Get CA certificate chain
   */
  getChain(id) {
    const chain = CAModel.getChain(id);
    if (chain.length === 0) {
      throw new NotFoundError(`CA not found: ${id}`);
    }
    return chain.map(ca => ({
      id: ca.id,
      name: ca.name,
      type: ca.type,
      commonName: ca.common_name,
      certificate: StorageService.loadCertificate(ca.cert_file_path),
    }));
  },

  /**
   * Delete a CA
   */
  delete(id) {
    const ca = CAModel.findById(id);
    if (!ca) {
      throw new NotFoundError(`CA not found: ${id}`);
    }

    // Check for child CAs
    const childCAs = CAModel.findByParentId(id);
    if (childCAs.length > 0) {
      throw new ConflictError('Cannot delete CA with child CAs. Delete child CAs first.');
    }

    // Check for certificates
    const certCount = CertModel.countByCAId(id);
    if (certCount > 0) {
      throw new ConflictError(`Cannot delete CA with ${certCount} issued certificate(s). Delete certificates first.`);
    }

    // Delete files
    StorageService.deleteKey(ca.key_file_path);
    StorageService.deleteCertificate(ca.cert_file_path);

    // Delete from database
    CAModel.delete(id);

    logger.info('CA deleted', { id });
  },

  /**
   * Get CA with private key (for signing operations)
   */
  async getCAWithKey(id) {
    const ca = this.getById(id);
    const cert = StorageService.loadCertificate(ca.cert_file_path);

    if (CryptoService.isEC(ca.key_algorithm)) {
      const ecKeys = StorageService.loadECKeyPair(ca.key_file_path);
      const keyPair = {
        privateKey: await CryptoService.EC.importPrivateKey(ecKeys.privateKey, ca.key_algorithm),
        publicKey: await CryptoService.EC.importPublicKey(ecKeys.publicKey, ca.key_algorithm),
      };
      return { ca, cert, keyPair, privateKeyPem: ecKeys.privateKey };
    } else {
      const privateKey = StorageService.loadPrivateKey(ca.key_file_path);
      return { ca, cert, privateKey };
    }
  },
};

module.exports = CAService;
