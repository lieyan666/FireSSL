const { v4: uuidv4 } = require('uuid');
const CertModel = require('../models/cert.model');
const CAService = require('./ca.service');
const CryptoService = require('./crypto');
const StorageService = require('./storage.service');
const config = require('../config');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

const CertService = {
  /**
   * Create a server certificate
   */
  async createServerCert({
    caId,
    commonName,
    organization,
    keyAlgorithm = config.defaults.keyAlgorithm,
    validityDays = config.defaults.validityDays.server,
    sanDns = [],
    sanIps = [],
  }) {
    // Load CA
    const caData = await CAService.getCAWithKey(caId);

    // Validate key type compatibility
    const caIsEC = CryptoService.isEC(caData.ca.key_algorithm);
    const certIsEC = CryptoService.isEC(keyAlgorithm);
    if (caIsEC !== certIsEC) {
      throw new ValidationError('Certificate must use the same key type as the signing CA (RSA with RSA, EC with EC)');
    }

    const id = uuidv4();

    // Generate key pair
    const keys = await CryptoService.generateKeyPair(keyAlgorithm);

    const subject = {
      commonName,
      organization: organization || caData.ca.organization,
    };

    // Create certificate
    let certResult;
    if (CryptoService.isRSA(keyAlgorithm)) {
      certResult = await CryptoService.createServerCert({
        publicKey: keys.publicKey,
        subject,
        issuerCert: caData.cert,
        issuerKey: caData.privateKey,
        validityDays,
        sanDns,
        sanIps,
        keyAlgorithm,
      });
    } else {
      certResult = await CryptoService.createServerCert({
        keyPair: keys.keyPair,
        subject,
        issuerCert: caData.cert,
        issuerKeyPair: caData.keyPair,
        validityDays,
        sanDns,
        sanIps,
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
    CertModel.create({
      id,
      caId,
      type: 'server',
      commonName,
      organization: subject.organization,
      sanDns: sanDns.length > 0 ? sanDns : null,
      sanIps: sanIps.length > 0 ? sanIps : null,
      keyAlgorithm,
      keyFilePath,
      certFilePath,
      serialNumber: certResult.serialNumber,
      notBefore: certResult.notBefore,
      notAfter: certResult.notAfter,
      fingerprint: certResult.fingerprint,
    });

    logger.info('Server certificate created', { id, commonName, caId });

    return this.getById(id);
  },

  /**
   * Create a client certificate
   */
  async createClientCert({
    caId,
    commonName,
    organization,
    keyAlgorithm = config.defaults.keyAlgorithm,
    validityDays = config.defaults.validityDays.client,
  }) {
    // Load CA
    const caData = await CAService.getCAWithKey(caId);

    // Validate key type compatibility
    const caIsEC = CryptoService.isEC(caData.ca.key_algorithm);
    const certIsEC = CryptoService.isEC(keyAlgorithm);
    if (caIsEC !== certIsEC) {
      throw new ValidationError('Certificate must use the same key type as the signing CA (RSA with RSA, EC with EC)');
    }

    const id = uuidv4();

    // Generate key pair
    const keys = await CryptoService.generateKeyPair(keyAlgorithm);

    const subject = {
      commonName,
      organization: organization || caData.ca.organization,
    };

    // Create certificate
    let certResult;
    if (CryptoService.isRSA(keyAlgorithm)) {
      certResult = await CryptoService.createClientCert({
        publicKey: keys.publicKey,
        subject,
        issuerCert: caData.cert,
        issuerKey: caData.privateKey,
        validityDays,
        keyAlgorithm,
      });
    } else {
      certResult = await CryptoService.createClientCert({
        keyPair: keys.keyPair,
        subject,
        issuerCert: caData.cert,
        issuerKeyPair: caData.keyPair,
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
    CertModel.create({
      id,
      caId,
      type: 'client',
      commonName,
      organization: subject.organization,
      sanDns: null,
      sanIps: null,
      keyAlgorithm,
      keyFilePath,
      certFilePath,
      serialNumber: certResult.serialNumber,
      notBefore: certResult.notBefore,
      notAfter: certResult.notAfter,
      fingerprint: certResult.fingerprint,
    });

    logger.info('Client certificate created', { id, commonName, caId });

    return this.getById(id);
  },

  /**
   * List all certificates
   */
  list(options = {}) {
    return CertModel.findAll(options);
  },

  /**
   * Get certificate by ID
   */
  getById(id) {
    const cert = CertModel.findById(id);
    if (!cert) {
      throw new NotFoundError(`Certificate not found: ${id}`);
    }
    return cert;
  },

  /**
   * Revoke a certificate
   */
  revoke(id) {
    const cert = CertModel.findById(id);
    if (!cert) {
      throw new NotFoundError(`Certificate not found: ${id}`);
    }
    if (cert.status === 'revoked') {
      throw new ValidationError('Certificate is already revoked');
    }

    CertModel.updateStatus(id, 'revoked');
    logger.info('Certificate revoked', { id });

    return this.getById(id);
  },

  /**
   * Delete a certificate
   */
  delete(id) {
    const cert = CertModel.findById(id);
    if (!cert) {
      throw new NotFoundError(`Certificate not found: ${id}`);
    }

    // Delete files
    StorageService.deleteKey(cert.key_file_path);
    StorageService.deleteCertificate(cert.cert_file_path);

    // Delete from database
    CertModel.delete(id);

    logger.info('Certificate deleted', { id });
  },
};

module.exports = CertService;
