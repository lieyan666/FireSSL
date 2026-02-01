const RSAService = require('./rsa.service');
const ECService = require('./ec.service');
const PKCS12Service = require('./pkcs12.service');

const CryptoService = {
  RSA: RSAService,
  EC: ECService,
  PKCS12: PKCS12Service,

  /**
   * Check if algorithm is RSA
   */
  isRSA(algorithm) {
    return algorithm.startsWith('RSA-');
  },

  /**
   * Check if algorithm is EC
   */
  isEC(algorithm) {
    return algorithm.startsWith('EC-');
  },

  /**
   * Get RSA bits from algorithm string
   */
  getRSABits(algorithm) {
    const match = algorithm.match(/RSA-(\d+)/);
    return match ? parseInt(match[1], 10) : 2048;
  },

  /**
   * Generate key pair for the given algorithm
   */
  async generateKeyPair(algorithm) {
    if (this.isRSA(algorithm)) {
      return RSAService.generateKeyPair(this.getRSABits(algorithm));
    } else if (this.isEC(algorithm)) {
      return ECService.generateKeyPair(algorithm);
    }
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  },

  /**
   * Create root CA
   */
  async createRootCA(options) {
    if (this.isRSA(options.keyAlgorithm)) {
      return RSAService.createRootCA(options);
    } else if (this.isEC(options.keyAlgorithm)) {
      return ECService.createRootCA({
        keyPair: options.keyPair,
        subject: options.subject,
        validityDays: options.validityDays,
      });
    }
    throw new Error(`Unsupported algorithm: ${options.keyAlgorithm}`);
  },

  /**
   * Create intermediate CA
   */
  async createIntermediateCA(options) {
    if (this.isRSA(options.keyAlgorithm)) {
      return RSAService.createIntermediateCA(options);
    } else if (this.isEC(options.keyAlgorithm)) {
      return ECService.createIntermediateCA({
        keyPair: options.keyPair,
        subject: options.subject,
        issuerCert: options.issuerCert,
        issuerKeyPair: options.issuerKeyPair,
        validityDays: options.validityDays,
      });
    }
    throw new Error(`Unsupported algorithm: ${options.keyAlgorithm}`);
  },

  /**
   * Create server certificate
   */
  async createServerCert(options) {
    if (this.isRSA(options.keyAlgorithm)) {
      return RSAService.createServerCert(options);
    } else if (this.isEC(options.keyAlgorithm)) {
      return ECService.createServerCert({
        keyPair: options.keyPair,
        subject: options.subject,
        issuerCert: options.issuerCert,
        issuerKeyPair: options.issuerKeyPair,
        validityDays: options.validityDays,
        sanDns: options.sanDns,
        sanIps: options.sanIps,
      });
    }
    throw new Error(`Unsupported algorithm: ${options.keyAlgorithm}`);
  },

  /**
   * Create client certificate
   */
  async createClientCert(options) {
    if (this.isRSA(options.keyAlgorithm)) {
      return RSAService.createClientCert(options);
    } else if (this.isEC(options.keyAlgorithm)) {
      return ECService.createClientCert({
        keyPair: options.keyPair,
        subject: options.subject,
        issuerCert: options.issuerCert,
        issuerKeyPair: options.issuerKeyPair,
        validityDays: options.validityDays,
      });
    }
    throw new Error(`Unsupported algorithm: ${options.keyAlgorithm}`);
  },

  /**
   * Convert PEM to DER
   */
  pemToDer(pem, algorithm) {
    if (this.isRSA(algorithm)) {
      return RSAService.pemToDer(pem);
    } else if (this.isEC(algorithm)) {
      return ECService.pemToDer(pem);
    }
    throw new Error(`Unsupported algorithm: ${algorithm}`);
  },
};

module.exports = CryptoService;
