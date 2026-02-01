const CertPage = {
  async renderList() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading">Loading certificates...</div>';

    try {
      const [certs, cas] = await Promise.all([
        api.certs.list(),
        api.ca.list(),
      ]);

      const caMap = {};
      cas.forEach(ca => { caMap[ca.id] = ca; });

      container.innerHTML = `
        <div class="page-header">
          <h2>Certificates</h2>
          <div class="header-actions">
            ${cas.length > 0 ? `
              <button class="btn btn-primary" onclick="CertPage.showCreateForm()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Issue Certificate
              </button>
            ` : ''}
          </div>
        </div>

        ${certs.length === 0 ? `
          <div class="empty-state-large">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h6"/></svg>
            <h3>No Certificates</h3>
            <p>${cas.length === 0 ? 'Create a CA first, then issue certificates.' : 'Issue your first certificate from a CA.'}</p>
            ${cas.length === 0 ? `<button class="btn btn-primary" onclick="app.navigate('ca')">Go to CAs</button>` :
              `<button class="btn btn-primary" onclick="CertPage.showCreateForm()">Issue Certificate</button>`}
          </div>
        ` : `
          <div class="filter-bar">
            <select id="filter-type" class="input input-sm" onchange="CertPage.applyFilters()">
              <option value="">All Types</option>
              <option value="server">Server</option>
              <option value="client">Client</option>
            </select>
            <select id="filter-status" class="input input-sm" onchange="CertPage.applyFilters()">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <table class="data-table" id="certs-table">
            <thead>
              <tr>
                <th>Common Name</th>
                <th>Type</th>
                <th>Signing CA</th>
                <th>Algorithm</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${certs.map(cert => {
                const ca = caMap[cert.ca_id];
                return `
                  <tr data-type="${cert.type}" data-status="${cert.status}">
                    <td class="clickable" onclick="app.navigate('cert-detail', '${cert.id}')"><strong>${escapeHtml(cert.common_name)}</strong></td>
                    <td><span class="badge badge-${cert.type}">${cert.type}</span></td>
                    <td>${ca ? escapeHtml(ca.name) : '-'}</td>
                    <td>${cert.key_algorithm}</td>
                    <td><span class="status-dot status-${cert.status}"></span>${cert.status}</td>
                    <td>${formatDate(cert.not_after)}</td>
                    <td class="actions-cell">
                      <a href="${api.export.pemUrl(cert.id, 'cert')}" class="btn btn-xs btn-outline" title="Download PEM" download>PEM</a>
                      ${cert.status === 'active' ? `<button class="btn btn-xs btn-warning" onclick="CertPage.revoke('${cert.id}'); event.stopPropagation();">Revoke</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(err.message)}</div>`;
    }
  },

  async renderDetail(id) {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading">Loading certificate details...</div>';

    try {
      const cert = await api.certs.getById(id);
      let ca = null;
      try {
        ca = await api.ca.getById(cert.ca_id);
      } catch (e) { /* CA may have been deleted */ }

      container.innerHTML = `
        <div class="page-header">
          <div class="breadcrumb">
            <a href="#" onclick="app.navigate('certs'); return false;">Certificates</a> &gt; ${escapeHtml(cert.common_name)}
          </div>
          <div class="header-actions">
            ${cert.status === 'active' ? `
              <button class="btn btn-warning" onclick="CertPage.revoke('${cert.id}')">Revoke</button>
            ` : ''}
            <button class="btn btn-danger" onclick="CertPage.deleteCert('${cert.id}')">Delete</button>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <h3>Certificate Information</h3>
            <dl class="detail-list">
              <dt>Common Name</dt><dd>${escapeHtml(cert.common_name)}</dd>
              <dt>Type</dt><dd><span class="badge badge-${cert.type}">${cert.type}</span></dd>
              <dt>Organization</dt><dd>${escapeHtml(cert.organization || '-')}</dd>
              <dt>Signing CA</dt><dd>${ca ? `<a href="#" onclick="app.navigate('ca-detail', '${ca.id}'); return false;">${escapeHtml(ca.name)}</a>` : '-'}</dd>
              <dt>Key Algorithm</dt><dd>${cert.key_algorithm}</dd>
              <dt>Serial Number</dt><dd class="monospace">${cert.serial_number}</dd>
              <dt>Status</dt><dd><span class="status-dot status-${cert.status}"></span>${cert.status}</dd>
              <dt>Not Before</dt><dd>${formatDate(cert.not_before)}</dd>
              <dt>Not After</dt><dd>${formatDate(cert.not_after)}</dd>
              <dt>Fingerprint (SHA-256)</dt><dd class="monospace fingerprint">${cert.fingerprint}</dd>
              <dt>Created</dt><dd>${formatDate(cert.created_at)}</dd>
            </dl>
          </div>

          ${cert.type === 'server' ? `
            <div class="detail-card">
              <h3>Subject Alternative Names</h3>
              <div class="san-list">
                ${(cert.san_dns && cert.san_dns.length > 0) ? `
                  <div class="san-group">
                    <h4>DNS Names</h4>
                    <ul>${cert.san_dns.map(dns => `<li>${escapeHtml(dns)}</li>`).join('')}</ul>
                  </div>
                ` : ''}
                ${(cert.san_ips && cert.san_ips.length > 0) ? `
                  <div class="san-group">
                    <h4>IP Addresses</h4>
                    <ul>${cert.san_ips.map(ip => `<li>${escapeHtml(ip)}</li>`).join('')}</ul>
                  </div>
                ` : ''}
                ${(!cert.san_dns || cert.san_dns.length === 0) && (!cert.san_ips || cert.san_ips.length === 0) ? '<p>No SANs configured</p>' : ''}
              </div>
            </div>
          ` : ''}

          <div class="detail-card">
            <h3>Export</h3>
            <div class="export-buttons">
              <a href="${api.export.pemUrl(cert.id, 'cert')}" class="btn btn-outline" download>Download Certificate (PEM)</a>
              <a href="${api.export.pemUrl(cert.id, 'key')}" class="btn btn-outline" download>Download Private Key (PEM)</a>
              <a href="${api.export.pemUrl(cert.id)}" class="btn btn-outline" download>Download Cert + Key (PEM)</a>
              <a href="${api.export.derUrl(cert.id)}" class="btn btn-outline" download>Download Certificate (DER)</a>
              <a href="${api.export.chainUrl(cert.id)}" class="btn btn-outline" download>Download Chain (PEM)</a>
              <div class="p12-export">
                <input type="password" id="p12-password" placeholder="PKCS12 Password (min 8 chars)" class="input" minlength="8">
                <button class="btn btn-outline" onclick="CertPage.downloadP12('${cert.id}')">Download PKCS12</button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(err.message)}</div>`;
    }
  },

  async showCreateForm(preselectedCaId) {
    let cas;
    try {
      cas = await api.ca.list({ status: 'active' });
    } catch (e) {
      showToast('Failed to load CAs', 'error');
      return;
    }

    if (cas.length === 0) {
      showToast('No active CAs available. Create a CA first.', 'error');
      return;
    }

    showModal('Issue Certificate', `
      <form id="create-cert-form" onsubmit="CertPage.create(event)">
        <div class="form-row">
          <div class="form-group">
            <label for="cert-type">Certificate Type *</label>
            <select id="cert-type" class="input" onchange="CertPage.toggleSANFields()">
              <option value="server">Server (TLS)</option>
              <option value="client">Client (mTLS)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cert-ca">Signing CA *</label>
            <select id="cert-ca" class="input">
              ${cas.map(ca => `<option value="${ca.id}" ${ca.id === preselectedCaId ? 'selected' : ''}>${escapeHtml(ca.name)} (${ca.key_algorithm})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="cert-cn">Common Name (CN) *</label>
          <input type="text" id="cert-cn" class="input" required placeholder="example.com">
        </div>
        <div class="form-group">
          <label for="cert-org">Organization</label>
          <input type="text" id="cert-org" class="input" placeholder="My Company">
        </div>
        <div class="form-group">
          <label for="cert-algorithm">Key Algorithm</label>
          <select id="cert-algorithm" class="input">
            <option value="RSA-2048">RSA-2048</option>
            <option value="RSA-4096">RSA-4096</option>
            <option value="EC-P256">EC P-256</option>
            <option value="EC-P384">EC P-384</option>
            <option value="EC-P521">EC P-521</option>
          </select>
        </div>
        <div class="form-group">
          <label for="cert-validity">Validity (days)</label>
          <input type="number" id="cert-validity" class="input" value="365" min="1" max="3650">
        </div>
        <div id="san-fields">
          <div class="form-group">
            <label for="cert-san-dns">Subject Alternative Names (DNS)</label>
            <textarea id="cert-san-dns" class="input" rows="3" placeholder="One per line:\nexample.com\n*.example.com\nwww.example.com"></textarea>
            <small class="form-help">One DNS name per line. Supports wildcards (*.example.com)</small>
          </div>
          <div class="form-group">
            <label for="cert-san-ips">Subject Alternative Names (IPs)</label>
            <textarea id="cert-san-ips" class="input" rows="2" placeholder="One per line:\n192.168.1.1\n10.0.0.1"></textarea>
            <small class="form-help">One IP address per line</small>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="create-cert-btn">Issue Certificate</button>
        </div>
      </form>
    `);
  },

  toggleSANFields() {
    const type = document.getElementById('cert-type').value;
    const sanFields = document.getElementById('san-fields');
    sanFields.style.display = type === 'server' ? 'block' : 'none';
  },

  async create(event) {
    event.preventDefault();
    const btn = document.getElementById('create-cert-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    const type = document.getElementById('cert-type').value;
    const data = {
      caId: document.getElementById('cert-ca').value,
      commonName: document.getElementById('cert-cn').value,
      organization: document.getElementById('cert-org').value || undefined,
      keyAlgorithm: document.getElementById('cert-algorithm').value,
      validityDays: parseInt(document.getElementById('cert-validity').value, 10),
    };

    if (type === 'server') {
      const sanDnsRaw = document.getElementById('cert-san-dns').value.trim();
      const sanIpsRaw = document.getElementById('cert-san-ips').value.trim();

      if (sanDnsRaw) {
        data.sanDns = sanDnsRaw.split('\n').map(s => s.trim()).filter(Boolean);
      }
      if (sanIpsRaw) {
        data.sanIps = sanIpsRaw.split('\n').map(s => s.trim()).filter(Boolean);
      }
    }

    try {
      const endpoint = type === 'server' ? api.certs.createServer : api.certs.createClient;
      await endpoint(data);

      closeModal();
      showToast(`${type} certificate created successfully`, 'success');
      CertPage.renderList();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Issue Certificate';
    }
  },

  async revoke(id) {
    if (!confirm('Are you sure you want to revoke this certificate? This action cannot be undone.')) return;

    try {
      await api.certs.revoke(id);
      showToast('Certificate revoked', 'success');
      // Re-render current page
      const hash = window.location.hash;
      if (hash.includes('cert-detail')) {
        CertPage.renderDetail(id);
      } else {
        CertPage.renderList();
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  },

  async deleteCert(id) {
    if (!confirm('Are you sure you want to delete this certificate? This action cannot be undone.')) return;

    try {
      await api.certs.delete(id);
      showToast('Certificate deleted', 'success');
      app.navigate('certs');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  },

  downloadP12(id) {
    const password = document.getElementById('p12-password').value;
    if (!password || password.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    window.location.href = api.export.p12Url(id, password);
  },

  applyFilters() {
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;
    const rows = document.querySelectorAll('#certs-table tbody tr');

    rows.forEach(row => {
      const type = row.dataset.type;
      const status = row.dataset.status;
      const typeMatch = !typeFilter || type === typeFilter;
      const statusMatch = !statusFilter || status === statusFilter;
      row.style.display = (typeMatch && statusMatch) ? '' : 'none';
    });
  },
};
