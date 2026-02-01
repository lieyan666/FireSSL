const forge = require('node-forge');
const { generateSerialNumber } = require('../../utils/serialNumber');

const RSAService = {
  /**
   * Generate RSA key pair
   * @param {number} bits - 2048 or 4096
   * @returns {{ publicKey: string, privateKey: string }} PEM encoded keys
   */
  generateKeyPair(bits = 2048) {
    const keypair = forge.pki.rsa.generateKeyPair({ bits, workers: -1 });
    return {
      publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
      privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
    };
  },

  /**
   * Create a self-signed root CA certificate
   */
  createRootCA({ privateKey, publicKey, subject, validityDays = 3650 }) {
    const cert = forge.pki.createCertificate();
    const privKey = forge.pki.privateKeyFromPem(privateKey);
    const pubKey = forge.pki.publicKeyFromPem(publicKey);

    cert.publicKey = pubKey;
    cert.serialNumber = generateSerialNumber();

    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const attrs = buildAttributes(subject);
    cert.setSubject(attrs);
    cert.setIssuer(attrs); // Self-signed

    cert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      {
        name: 'subjectKeyIdentifier',
      },
      {
        name: 'authorityKeyIdentifier',
        keyIdentifier: true,
      },
    ]);

    cert.sign(privKey, forge.md.sha256.create());

    return {
      certificate: forge.pki.certificateToPem(cert),
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore.toISOString(),
      notAfter: cert.validity.notAfter.toISOString(),
      fingerprint: getFingerprint(cert),
    };
  },

  /**
   * Create an intermediate CA certificate signed by a parent CA
   */
  createIntermediateCA({ privateKey, publicKey, subject, issuerCert, issuerKey, validityDays = 1825 }) {
    const cert = forge.pki.createCertificate();
    const pubKey = forge.pki.publicKeyFromPem(publicKey);
    const issuerPrivKey = forge.pki.privateKeyFromPem(issuerKey);
    const issuerCertObj = forge.pki.certificateFromPem(issuerCert);

    cert.publicKey = pubKey;
    cert.serialNumber = generateSerialNumber();

    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const attrs = buildAttributes(subject);
    cert.setSubject(attrs);
    cert.setIssuer(issuerCertObj.subject.attributes);

    cert.setExtensions([
      { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      {
        name: 'subjectKeyIdentifier',
      },
      {
        name: 'authorityKeyIdentifier',
        keyIdentifier: true,
        authorityCertIssuer: true,
        serialNumber: issuerCertObj.serialNumber,
      },
    ]);

    cert.sign(issuerPrivKey, forge.md.sha256.create());

    return {
      certificate: forge.pki.certificateToPem(cert),
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore.toISOString(),
      notAfter: cert.validity.notAfter.toISOString(),
      fingerprint: getFingerprint(cert),
    };
  },

  /**
   * Create a server certificate signed by a CA
   */
  createServerCert({ publicKey, subject, issuerCert, issuerKey, validityDays = 365, sanDns = [], sanIps = [] }) {
    const cert = forge.pki.createCertificate();
    const pubKey = forge.pki.publicKeyFromPem(publicKey);
    const issuerPrivKey = forge.pki.privateKeyFromPem(issuerKey);
    const issuerCertObj = forge.pki.certificateFromPem(issuerCert);

    cert.publicKey = pubKey;
    cert.serialNumber = generateSerialNumber();

    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const attrs = buildAttributes(subject);
    cert.setSubject(attrs);
    cert.setIssuer(issuerCertObj.subject.attributes);

    // Build SAN extension
    const altNames = [];
    if (sanDns.length === 0 && subject.commonName) {
      altNames.push({ type: 2, value: subject.commonName }); // DNS
    }
    sanDns.forEach(dns => altNames.push({ type: 2, value: dns }));
    sanIps.forEach(ip => altNames.push({ type: 7, ip }));

    cert.setExtensions([
      { name: 'basicConstraints', cA: false, critical: true },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true,
        critical: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
      {
        name: 'subjectKeyIdentifier',
      },
      {
        name: 'authorityKeyIdentifier',
        keyIdentifier: true,
        authorityCertIssuer: true,
        serialNumber: issuerCertObj.serialNumber,
      },
      {
        name: 'subjectAltName',
        altNames,
      },
    ]);

    cert.sign(issuerPrivKey, forge.md.sha256.create());

    return {
      certificate: forge.pki.certificateToPem(cert),
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore.toISOString(),
      notAfter: cert.validity.notAfter.toISOString(),
      fingerprint: getFingerprint(cert),
    };
  },

  /**
   * Create a client certificate signed by a CA
   */
  createClientCert({ publicKey, subject, issuerCert, issuerKey, validityDays = 365 }) {
    const cert = forge.pki.createCertificate();
    const pubKey = forge.pki.publicKeyFromPem(publicKey);
    const issuerPrivKey = forge.pki.privateKeyFromPem(issuerKey);
    const issuerCertObj = forge.pki.certificateFromPem(issuerCert);

    cert.publicKey = pubKey;
    cert.serialNumber = generateSerialNumber();

    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const attrs = buildAttributes(subject);
    cert.setSubject(attrs);
    cert.setIssuer(issuerCertObj.subject.attributes);

    cert.setExtensions([
      { name: 'basicConstraints', cA: false, critical: true },
      {
        name: 'keyUsage',
        digitalSignature: true,
        critical: true,
      },
      {
        name: 'extKeyUsage',
        clientAuth: true,
      },
      {
        name: 'subjectKeyIdentifier',
      },
      {
        name: 'authorityKeyIdentifier',
        keyIdentifier: true,
        authorityCertIssuer: true,
        serialNumber: issuerCertObj.serialNumber,
      },
    ]);

    cert.sign(issuerPrivKey, forge.md.sha256.create());

    return {
      certificate: forge.pki.certificateToPem(cert),
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore.toISOString(),
      notAfter: cert.validity.notAfter.toISOString(),
      fingerprint: getFingerprint(cert),
    };
  },

  /**
   * Convert PEM to DER
   */
  pemToDer(pem) {
    const cert = forge.pki.certificateFromPem(pem);
    const asn1 = forge.pki.certificateToAsn1(cert);
    const der = forge.asn1.toDer(asn1);
    return Buffer.from(der.getBytes(), 'binary');
  },
};

function buildAttributes(subject) {
  const attrs = [];
  if (subject.commonName) {
    attrs.push({ shortName: 'CN', value: subject.commonName });
  }
  if (subject.organization) {
    attrs.push({ shortName: 'O', value: subject.organization });
  }
  if (subject.country) {
    attrs.push({ shortName: 'C', value: subject.country });
  }
  return attrs;
}

function getFingerprint(cert) {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert));
  const md = forge.md.sha256.create();
  md.update(der.getBytes());
  return md.digest().toHex().toUpperCase().match(/.{2}/g).join(':');
}

module.exports = RSAService;
