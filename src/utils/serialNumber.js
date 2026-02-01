const crypto = require('crypto');

function generateSerialNumber() {
  // Generate a random 16-byte (128-bit) serial number
  const bytes = crypto.randomBytes(16);
  // Ensure the first bit is 0 (positive number) per X.509 spec
  bytes[0] &= 0x7f;
  return bytes.toString('hex').toUpperCase();
}

module.exports = {
  generateSerialNumber,
};
