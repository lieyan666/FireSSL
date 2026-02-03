const { Crypto } = require('@peculiar/webcrypto');
const x509 = require('@peculiar/x509');
const { generateSerialNumber } = require('../../utils/serialNumber');

// Use the WebCrypto polyfill
const crypto = new Crypto();
x509.cryptoProvider.set(crypto);

const CURVES = {
  'EC-P256': 'P-256',
  'EC-P384': 'P-384',
  'EC-P521': 'P-521',
};

const ECService = {
  /**
   * Generate EC key pair
   * @param {string} algorithm - EC-P256, EC-P384, or EC-P521
   * @returns {Promise<{ publicKey: string, privateKey: string }>} PEM encoded keys
   */
  async generateKeyPair(algorithm = 'EC-P256') {
    const curve = CURVES[algorithm];
    if (!curve) {
      throw new Error(`Unsupported EC algorithm: ${algorithm}`);
    }

    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: curve,
      },
      true,
      ['sign', 'verify']
    );

    const privateKeyPem = await exportPrivateKey(keyPair.privateKey);
    const publicKeyPem = await exportPublicKey(keyPair.publicKey);

    return {
      publicKey: publicKeyPem,
      privateKey: privateKeyPem,
      keyPair, // Keep CryptoKeyPair for signing
    };
  },

  /**
   * Create a self-signed root CA certificate
   */
  async createRootCA({ keyPair, subject, validityDays = 3650 }) {
    const serialNumber = generateSerialNumber();
    const now = new Date();
    const notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const cert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber,
      notBefore: now,
      notAfter,
      name: buildDistinguishedName(subject),
      keys: keyPair,
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
      extensions: [
        new x509.BasicConstraintsExtension(true, undefined, true),
        new x509.KeyUsagesExtension(
          x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRlSign,
          true
        ),
        await x509.SubjectKeyIdentifierExtension.create(keyPair.publicKey),
      ],
    });

    return {
      certificate: cert.toString('pem'),
      serialNumber,
      notBefore: now.toISOString(),
      notAfter: notAfter.toISOString(),
      fingerprint: await getFingerprint(cert),
    };
  },

  /**
   * Create an intermediate CA certificate signed by a parent CA
   */
  async createIntermediateCA({ keyPair, subject, issuerCert, issuerKeyPair, validityDays = 1825 }) {
    const serialNumber = generateSerialNumber();
    const now = new Date();
    const notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const issuerCertObj = new x509.X509Certificate(issuerCert);

    const cert = await x509.X509CertificateGenerator.create({
      serialNumber,
      notBefore: now,
      notAfter,
      subject: buildDistinguishedName(subject),
      issuer: issuerCertObj.subject,
      publicKey: keyPair.publicKey,
      signingKey: issuerKeyPair.privateKey,
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
      extensions: [
        new x509.BasicConstraintsExtension(true, 0, true),
        new x509.KeyUsagesExtension(
          x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRlSign,
          true
        ),
        await x509.SubjectKeyIdentifierExtension.create(keyPair.publicKey),
        await x509.AuthorityKeyIdentifierExtension.create(issuerCertObj.publicKey),
      ],
    });

    return {
      certificate: cert.toString('pem'),
      serialNumber,
      notBefore: now.toISOString(),
      notAfter: notAfter.toISOString(),
      fingerprint: await getFingerprint(cert),
    };
  },

  /**
   * Create a server certificate signed by a CA
   */
  async createServerCert({ keyPair, subject, issuerCert, issuerKeyPair, validityDays = 365, sanDns = [], sanIps = [] }) {
    const serialNumber = generateSerialNumber();
    const now = new Date();
    const notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const issuerCertObj = new x509.X509Certificate(issuerCert);

    // Build SAN entries as JSON format for @peculiar/x509
    const sanEntries = [];
    const dnsNames = sanDns.length > 0 ? sanDns : (subject.commonName ? [subject.commonName] : []);
    dnsNames.forEach(dns => {
      sanEntries.push({ type: 'dns', value: dns });
    });
    sanIps.forEach(ip => {
      sanEntries.push({ type: 'ip', value: ip });
    });

    const cert = await x509.X509CertificateGenerator.create({
      serialNumber,
      notBefore: now,
      notAfter,
      subject: buildDistinguishedName(subject),
      issuer: issuerCertObj.subject,
      publicKey: keyPair.publicKey,
      signingKey: issuerKeyPair.privateKey,
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
      extensions: [
        new x509.BasicConstraintsExtension(false, undefined, true),
        new x509.KeyUsagesExtension(
          x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment,
          true
        ),
        new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
        await x509.SubjectKeyIdentifierExtension.create(keyPair.publicKey),
        await x509.AuthorityKeyIdentifierExtension.create(issuerCertObj.publicKey),
        new x509.SubjectAlternativeNameExtension(sanEntries),
      ],
    });

    return {
      certificate: cert.toString('pem'),
      serialNumber,
      notBefore: now.toISOString(),
      notAfter: notAfter.toISOString(),
      fingerprint: await getFingerprint(cert),
    };
  },

  /**
   * Create a client certificate signed by a CA
   */
  async createClientCert({ keyPair, subject, issuerCert, issuerKeyPair, validityDays = 365 }) {
    const serialNumber = generateSerialNumber();
    const now = new Date();
    const notAfter = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const issuerCertObj = new x509.X509Certificate(issuerCert);

    const cert = await x509.X509CertificateGenerator.create({
      serialNumber,
      notBefore: now,
      notAfter,
      subject: buildDistinguishedName(subject),
      issuer: issuerCertObj.subject,
      publicKey: keyPair.publicKey,
      signingKey: issuerKeyPair.privateKey,
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
      extensions: [
        new x509.BasicConstraintsExtension(false, undefined, true),
        new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
        new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.clientAuth]),
        await x509.SubjectKeyIdentifierExtension.create(keyPair.publicKey),
        await x509.AuthorityKeyIdentifierExtension.create(issuerCertObj.publicKey),
      ],
    });

    return {
      certificate: cert.toString('pem'),
      serialNumber,
      notBefore: now.toISOString(),
      notAfter: notAfter.toISOString(),
      fingerprint: await getFingerprint(cert),
    };
  },

  /**
   * Import a private key from PEM format
   */
  async importPrivateKey(pem, algorithm = 'EC-P256') {
    const curve = CURVES[algorithm];
    const pemContent = pem
      .replace('-----BEGIN EC PRIVATE KEY-----', '')
      .replace('-----END EC PRIVATE KEY-----', '')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');

    const binaryDer = Buffer.from(pemContent, 'base64');

    return crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'ECDSA', namedCurve: curve },
      true,
      ['sign']
    );
  },

  /**
   * Import a public key from PEM format
   */
  async importPublicKey(pem, algorithm = 'EC-P256') {
    const curve = CURVES[algorithm];
    const pemContent = pem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    const binaryDer = Buffer.from(pemContent, 'base64');

    return crypto.subtle.importKey(
      'spki',
      binaryDer,
      { name: 'ECDSA', namedCurve: curve },
      true,
      ['verify']
    );
  },

  /**
   * Convert PEM to DER
   */
  pemToDer(pem) {
    const cert = new x509.X509Certificate(pem);
    return Buffer.from(cert.rawData);
  },
};

function buildDistinguishedName(subject) {
  const parts = [];
  if (subject.commonName) {
    parts.push(`CN=${subject.commonName}`);
  }
  if (subject.organization) {
    parts.push(`O=${subject.organization}`);
  }
  if (subject.country) {
    parts.push(`C=${subject.country}`);
  }
  return parts.join(', ');
}

async function exportPrivateKey(key) {
  const exported = await crypto.subtle.exportKey('pkcs8', key);
  const base64 = Buffer.from(exported).toString('base64');
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

async function exportPublicKey(key) {
  const exported = await crypto.subtle.exportKey('spki', key);
  const base64 = Buffer.from(exported).toString('base64');
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

async function getFingerprint(cert) {
  const hash = await crypto.subtle.digest('SHA-256', cert.rawData);
  return Buffer.from(hash)
    .toString('hex')
    .toUpperCase()
    .match(/.{2}/g)
    .join(':');
}

module.exports = ECService;
