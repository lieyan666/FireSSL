const { getDatabase, save } = require('./index');

const CertModel = {
  create(data) {
    const db = getDatabase();
    const row = {
      id: data.id,
      ca_id: data.caId,
      type: data.type,
      common_name: data.commonName,
      organization: data.organization || null,
      san_dns: data.sanDns || null,
      san_ips: data.sanIps || null,
      key_algorithm: data.keyAlgorithm,
      key_file_path: data.keyFilePath,
      cert_file_path: data.certFilePath,
      serial_number: data.serialNumber,
      not_before: data.notBefore,
      not_after: data.notAfter,
      fingerprint: data.fingerprint,
      status: data.status || 'active',
      created_at: new Date().toISOString(),
    };
    db.certificates.push(row);
    save();
    return row;
  },

  findById(id) {
    const db = getDatabase();
    const row = db.certificates.find(c => c.id === id) || null;
    if (row) {
      row.san_dns = row.san_dns || [];
      row.san_ips = row.san_ips || [];
    }
    return row;
  },

  findAll(options = {}) {
    const db = getDatabase();
    let results = [...db.certificates];

    if (options.caId) {
      results = results.filter(c => c.ca_id === options.caId);
    }
    if (options.type) {
      results = results.filter(c => c.type === options.type);
    }
    if (options.status) {
      results = results.filter(c => c.status === options.status);
    }

    results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return results.map(row => ({
      ...row,
      san_dns: row.san_dns || [],
      san_ips: row.san_ips || [],
    }));
  },

  findByCAId(caId) {
    return this.findAll({ caId });
  },

  updateStatus(id, status) {
    const db = getDatabase();
    const cert = db.certificates.find(c => c.id === id);
    if (cert) {
      cert.status = status;
      save();
    }
  },

  delete(id) {
    const db = getDatabase();
    const idx = db.certificates.findIndex(c => c.id === id);
    if (idx !== -1) {
      db.certificates.splice(idx, 1);
      save();
    }
  },

  countByCAId(caId) {
    const db = getDatabase();
    return db.certificates.filter(c => c.ca_id === caId).length;
  },
};

module.exports = CertModel;
