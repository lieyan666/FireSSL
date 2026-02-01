const forge = require('node-forge');

const PKCS12Service = {
  /**
   * Create a PKCS12 file with certificate, private key, and certificate chain
   * @param {Object} options
   * @param {string} options.certificate - PEM encoded certificate
   * @param {string} options.privateKey - PEM encoded private key (RSA only)
   * @param {string[]} options.chain - Array of PEM encoded CA certificates
   * @param {string} options.password - Password to protect the PKCS12 file
   * @param {string} options.friendlyName - Friendly name for the certificate
   * @returns {Buffer} PKCS12 file content
   */
  createPKCS12({ certificate, privateKey, chain = [], password, friendlyName = 'certificate' }) {
    const cert = forge.pki.certificateFromPem(certificate);
    const key = forge.pki.privateKeyFromPem(privateKey);
    const chainCerts = chain.map(c => forge.pki.certificateFromPem(c));

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert, ...chainCerts], password, {
      friendlyName,
      generateLocalKeyId: true,
      algorithm: '3des', // Use 3DES for better compatibility
    });

    const p12Der = forge.asn1.toDer(p12Asn1);
    return Buffer.from(p12Der.getBytes(), 'binary');
  },

  /**
   * Create a PKCS12 file for EC certificates (certificate only, no private key)
   * Note: node-forge doesn't support EC keys in PKCS12
   * For EC certificates, we can only include the certificate chain
   */
  createPKCS12CertOnly({ certificate, chain = [], password, friendlyName = 'certificate' }) {
    const cert = forge.pki.certificateFromPem(certificate);
    const chainCerts = chain.map(c => forge.pki.certificateFromPem(c));

    // Create PKCS12 with certificates only (no private key)
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(null, [cert, ...chainCerts], password, {
      friendlyName,
      generateLocalKeyId: false,
      algorithm: '3des',
    });

    const p12Der = forge.asn1.toDer(p12Asn1);
    return Buffer.from(p12Der.getBytes(), 'binary');
  },
};

module.exports = PKCS12Service;
