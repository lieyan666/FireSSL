const { getDatabase, save } = require('./index');

const CAModel = {
  create(data) {
    const db = getDatabase();
    const row = {
      id: data.id,
      name: data.name,
      type: data.type,
      parent_id: data.parentId || null,
      common_name: data.commonName,
      organization: data.organization || null,
      country: data.country || null,
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
    db.certificate_authorities.push(row);
    save();
    return row;
  },

  findById(id) {
    const db = getDatabase();
    return db.certificate_authorities.find(ca => ca.id === id) || null;
  },

  findAll(options = {}) {
    const db = getDatabase();
    let results = [...db.certificate_authorities];

    if (options.type) {
      results = results.filter(ca => ca.type === options.type);
    }
    if (options.status) {
      results = results.filter(ca => ca.status === options.status);
    }

    results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return results;
  },

  findByParentId(parentId) {
    const db = getDatabase();
    return db.certificate_authorities.filter(ca => ca.parent_id === parentId);
  },

  updateStatus(id, status) {
    const db = getDatabase();
    const ca = db.certificate_authorities.find(ca => ca.id === id);
    if (ca) {
      ca.status = status;
      save();
    }
  },

  delete(id) {
    const db = getDatabase();
    const idx = db.certificate_authorities.findIndex(ca => ca.id === id);
    if (idx !== -1) {
      db.certificate_authorities.splice(idx, 1);
      save();
    }
  },

  getChain(id) {
    const chain = [];
    let current = this.findById(id);

    while (current) {
      chain.push(current);
      if (current.parent_id) {
        current = this.findById(current.parent_id);
      } else {
        current = null;
      }
    }

    return chain;
  },
};

module.exports = CAModel;
