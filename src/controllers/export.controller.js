const CertModel = require('../models/cert.model');
const CAModel = require('../models/ca.model');
const CAService = require('../services/ca.service');
const CryptoService = require('../services/crypto');
const StorageService = require('../services/storage.service');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

const exportController = {
  /**
   * Export certificate and key as PEM
   */
  exportPem(req, res, next) {
    try {
      const { id } = req.params;
      const { type } = req.query; // 'cert', 'key', or 'both' (default)
      const entity = findEntity(id);

      if (type === 'cert') {
        const cert = StorageService.loadCertificate(entity.cert_file_path);
        res.setHeader('Content-Type', 'application/x-pem-file');
        res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name}.crt"`);
        return res.send(cert);
      }

      if (type === 'key') {
        const key = loadPrivateKeyPem(entity);
        res.setHeader('Content-Type', 'application/x-pem-file');
        res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name}.key"`);
        return res.send(key);
      }

      // Default: both cert and key
      const cert = StorageService.loadCertificate(entity.cert_file_path);
      const key = loadPrivateKeyPem(entity);
      const combined = cert + '\n' + key;

      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name}.pem"`);
      res.send(combined);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export certificate as DER
   */
  exportDer(req, res, next) {
    try {
      const { id } = req.params;
      const entity = findEntity(id);
      const certPem = StorageService.loadCertificate(entity.cert_file_path);
      const der = CryptoService.pemToDer(certPem, entity.key_algorithm);

      res.setHeader('Content-Type', 'application/x-x509-ca-cert');
      res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name}.der"`);
      res.send(der);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export as PKCS12
   */
  exportP12(req, res, next) {
    try {
      const { id } = req.params;
      const { password } = req.query;
      const entity = findEntity(id);

      // Build certificate chain
      const chain = [];
      if (entity.ca_id) {
        const caChain = CAModel.getChain(entity.ca_id);
        caChain.forEach(ca => {
          chain.push(StorageService.loadCertificate(ca.cert_file_path));
        });
      } else if (entity.type === 'intermediate') {
        // It's an intermediate CA - get parent chain
        const caChain = CAModel.getChain(entity.id);
        // Skip the first one (itself), add the rest
        caChain.slice(1).forEach(ca => {
          chain.push(StorageService.loadCertificate(ca.cert_file_path));
        });
      }

      const certPem = StorageService.loadCertificate(entity.cert_file_path);

      if (CryptoService.isRSA(entity.key_algorithm)) {
        const privateKey = StorageService.loadPrivateKey(entity.key_file_path);
        const p12Buffer = CryptoService.PKCS12.createPKCS12({
          certificate: certPem,
          privateKey,
          chain,
          password,
          friendlyName: entity.common_name || entity.name,
        });

        res.setHeader('Content-Type', 'application/x-pkcs12');
        res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name || entity.name}.p12"`);
        res.send(p12Buffer);
      } else {
        // EC: certificate-only PKCS12 (node-forge can't handle EC private keys)
        const p12Buffer = CryptoService.PKCS12.createPKCS12CertOnly({
          certificate: certPem,
          chain,
          password,
          friendlyName: entity.common_name || entity.name,
        });

        res.setHeader('Content-Type', 'application/x-pkcs12');
        res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name || entity.name}.p12"`);
        res.send(p12Buffer);
      }
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export certificate chain as PEM
   */
  exportChain(req, res, next) {
    try {
      const { id } = req.params;
      const entity = findEntity(id);

      let chainPem = StorageService.loadCertificate(entity.cert_file_path);

      // Build chain
      let caId = entity.ca_id || (entity.parent_id ? entity.parent_id : null);
      if (!caId && entity.type === 'intermediate') {
        caId = entity.parent_id;
      }

      if (caId) {
        const caChain = CAModel.getChain(caId);
        caChain.forEach(ca => {
          chainPem += '\n' + StorageService.loadCertificate(ca.cert_file_path);
        });
      }

      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${entity.common_name || entity.name}-chain.pem"`);
      res.send(chainPem);
    } catch (err) {
      next(err);
    }
  },
};

/**
 * Find entity (cert or CA) by ID
 */
function findEntity(id) {
  // Try certificate first
  let entity = CertModel.findById(id);
  if (entity) return entity;

  // Try CA
  entity = CAModel.findById(id);
  if (entity) return entity;

  throw new NotFoundError(`Certificate or CA not found: ${id}`);
}

/**
 * Load private key PEM for an entity
 */
function loadPrivateKeyPem(entity) {
  if (CryptoService.isEC(entity.key_algorithm)) {
    const ecKeys = StorageService.loadECKeyPair(entity.key_file_path);
    return ecKeys.privateKey;
  }
  return StorageService.loadPrivateKey(entity.key_file_path);
}

module.exports = exportController;
