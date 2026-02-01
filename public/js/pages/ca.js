const CAPage = {
  async renderList() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading">Loading CAs...</div>';

    try {
      const cas = await api.ca.list();
      const rootCAs = cas.filter(ca => ca.type === 'root');

      container.innerHTML = `
        <div class="page-header">
          <h2>Certificate Authorities</h2>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="CAPage.showCreateRootForm()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Create Root CA
            </button>
          </div>
        </div>

        ${cas.length === 0 ? `
          <div class="empty-state-large">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <h3>No Certificate Authorities</h3>
            <p>Create a Root CA to get started with certificate management.</p>
            <button class="btn btn-primary" onclick="CAPage.showCreateRootForm()">Create Root CA</button>
          </div>
        ` : `
          <div class="ca-tree">
            ${rootCAs.map(root => renderCATree(root, cas)).join('')}
          </div>
        `}
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(err.message)}</div>`;
    }
  },

  async renderDetail(id) {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading">Loading CA details...</div>';

    try {
      const [ca, chain] = await Promise.all([
        api.ca.getById(id),
        api.ca.getChain(id),
      ]);

      let certs = [];
      try {
        certs = await api.certs.list({ caId: id });
      } catch (e) { /* no certs */ }

      container.innerHTML = `
        <div class="page-header">
          <div class="breadcrumb">
            <a href="#" onclick="app.navigate('ca'); return false;">CAs</a> &gt; ${escapeHtml(ca.name)}
          </div>
          <div class="header-actions">
            ${ca.status === 'active' ? `
              <button class="btn btn-secondary" onclick="CAPage.showCreateIntermediateForm('${ca.id}')">Create Intermediate CA</button>
              <button class="btn btn-secondary" onclick="app.navigate('create-cert', '${ca.id}')">Issue Certificate</button>
            ` : ''}
            <button class="btn btn-danger" onclick="CAPage.deleteCA('${ca.id}')">Delete</button>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-card">
            <h3>CA Information</h3>
            <dl class="detail-list">
              <dt>Name</dt><dd>${escapeHtml(ca.name)}</dd>
              <dt>Type</dt><dd><span class="badge badge-${ca.type}">${ca.type}</span></dd>
              <dt>Common Name</dt><dd>${escapeHtml(ca.common_name)}</dd>
              <dt>Organization</dt><dd>${escapeHtml(ca.organization || '-')}</dd>
              <dt>Country</dt><dd>${escapeHtml(ca.country || '-')}</dd>
              <dt>Key Algorithm</dt><dd>${ca.key_algorithm}</dd>
              <dt>Serial Number</dt><dd class="monospace">${ca.serial_number}</dd>
              <dt>Status</dt><dd><span class="status-dot status-${ca.status}"></span>${ca.status}</dd>
              <dt>Not Before</dt><dd>${formatDate(ca.not_before)}</dd>
              <dt>Not After</dt><dd>${formatDate(ca.not_after)}</dd>
              <dt>Fingerprint (SHA-256)</dt><dd class="monospace fingerprint">${ca.fingerprint}</dd>
              <dt>Created</dt><dd>${formatDate(ca.created_at)}</dd>
            </dl>
          </div>

          <div class="detail-card">
            <h3>Certificate Chain</h3>
            <div class="chain-view">
              ${chain.map((item, i) => `
                <div class="chain-item ${i === 0 ? 'current' : ''}">
                  <div class="chain-connector">${i === 0 ? '' : '<div class="chain-line"></div>'}</div>
                  <div class="chain-content">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="badge badge-${item.type}">${item.type}</span>
                    <div class="chain-cn">${escapeHtml(item.commonName)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="detail-card">
            <h3>Export</h3>
            <div class="export-buttons">
              <a href="${api.export.pemUrl(ca.id, 'cert')}" class="btn btn-outline" download>Download Certificate (PEM)</a>
              <a href="${api.export.pemUrl(ca.id, 'key')}" class="btn btn-outline" download>Download Private Key (PEM)</a>
              <a href="${api.export.derUrl(ca.id)}" class="btn btn-outline" download>Download Certificate (DER)</a>
              <a href="${api.export.chainUrl(ca.id)}" class="btn btn-outline" download>Download Chain (PEM)</a>
              <div class="p12-export">
                <input type="password" id="p12-password" placeholder="PKCS12 Password (min 8 chars)" class="input" minlength="8">
                <button class="btn btn-outline" onclick="CAPage.downloadP12('${ca.id}')">Download PKCS12</button>
              </div>
            </div>
          </div>
        </div>

        ${certs.length > 0 ? `
          <div class="section">
            <h3>Issued Certificates (${certs.length})</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Common Name</th>
                  <th>Type</th>
                  <th>Algorithm</th>
                  <th>Status</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                ${certs.map(cert => `
                  <tr class="clickable" onclick="app.navigate('cert-detail', '${cert.id}')">
                    <td><strong>${escapeHtml(cert.common_name)}</strong></td>
                    <td><span class="badge badge-${cert.type}">${cert.type}</span></td>
                    <td>${cert.key_algorithm}</td>
                    <td><span class="status-dot status-${cert.status}"></span>${cert.status}</td>
                    <td>${formatDate(cert.not_after)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(err.message)}</div>`;
    }
  },

  showCreateRootForm() {
    showModal('Create Root CA', `
      <form id="create-root-form" onsubmit="CAPage.createRoot(event)">
        <div class="form-group">
          <label for="ca-name">Name *</label>
          <input type="text" id="ca-name" class="input" required placeholder="My Root CA">
        </div>
        <div class="form-group">
          <label for="ca-cn">Common Name (CN) *</label>
          <input type="text" id="ca-cn" class="input" required placeholder="My Root CA">
        </div>
        <div class="form-group">
          <label for="ca-org">Organization</label>
          <input type="text" id="ca-org" class="input" placeholder="My Company">
        </div>
        <div class="form-group">
          <label for="ca-country">Country (2 letter code)</label>
          <input type="text" id="ca-country" class="input" maxlength="2" placeholder="US">
        </div>
        <div class="form-group">
          <label for="ca-algorithm">Key Algorithm</label>
          <select id="ca-algorithm" class="input">
            <option value="RSA-2048">RSA-2048</option>
            <option value="RSA-4096">RSA-4096</option>
            <option value="EC-P256">EC P-256</option>
            <option value="EC-P384">EC P-384</option>
            <option value="EC-P521">EC P-521</option>
          </select>
        </div>
        <div class="form-group">
          <label for="ca-validity">Validity (days)</label>
          <input type="number" id="ca-validity" class="input" value="3650" min="1" max="36500">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="create-root-btn">Create Root CA</button>
        </div>
      </form>
    `);
  },

  showCreateIntermediateForm(parentId) {
    showModal('Create Intermediate CA', `
      <form id="create-intermediate-form" onsubmit="CAPage.createIntermediate(event, '${parentId}')">
        <div class="form-group">
          <label for="ica-name">Name *</label>
          <input type="text" id="ica-name" class="input" required placeholder="My Intermediate CA">
        </div>
        <div class="form-group">
          <label for="ica-cn">Common Name (CN) *</label>
          <input type="text" id="ica-cn" class="input" required placeholder="My Intermediate CA">
        </div>
        <div class="form-group">
          <label for="ica-org">Organization</label>
          <input type="text" id="ica-org" class="input" placeholder="My Company">
        </div>
        <div class="form-group">
          <label for="ica-country">Country (2 letter code)</label>
          <input type="text" id="ica-country" class="input" maxlength="2" placeholder="US">
        </div>
        <div class="form-group">
          <label for="ica-algorithm">Key Algorithm</label>
          <select id="ica-algorithm" class="input">
            <option value="RSA-2048">RSA-2048</option>
            <option value="RSA-4096">RSA-4096</option>
            <option value="EC-P256">EC P-256</option>
            <option value="EC-P384">EC P-384</option>
            <option value="EC-P521">EC P-521</option>
          </select>
        </div>
        <div class="form-group">
          <label for="ica-validity">Validity (days)</label>
          <input type="number" id="ica-validity" class="input" value="1825" min="1" max="36500">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="create-intermediate-btn">Create Intermediate CA</button>
        </div>
      </form>
    `);
  },

  async createRoot(event) {
    event.preventDefault();
    const btn = document.getElementById('create-root-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await api.ca.createRoot({
        name: document.getElementById('ca-name').value,
        commonName: document.getElementById('ca-cn').value,
        organization: document.getElementById('ca-org').value || undefined,
        country: document.getElementById('ca-country').value || undefined,
        keyAlgorithm: document.getElementById('ca-algorithm').value,
        validityDays: parseInt(document.getElementById('ca-validity').value, 10),
      });

      closeModal();
      showToast('Root CA created successfully', 'success');
      CAPage.renderList();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Root CA';
    }
  },

  async createIntermediate(event, parentId) {
    event.preventDefault();
    const btn = document.getElementById('create-intermediate-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await api.ca.createIntermediate({
        name: document.getElementById('ica-name').value,
        parentId,
        commonName: document.getElementById('ica-cn').value,
        organization: document.getElementById('ica-org').value || undefined,
        country: document.getElementById('ica-country').value || undefined,
        keyAlgorithm: document.getElementById('ica-algorithm').value,
        validityDays: parseInt(document.getElementById('ica-validity').value, 10),
      });

      closeModal();
      showToast('Intermediate CA created successfully', 'success');
      app.navigate('ca');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Intermediate CA';
    }
  },

  async deleteCA(id) {
    if (!confirm('Are you sure you want to delete this CA? This action cannot be undone.')) return;

    try {
      await api.ca.delete(id);
      showToast('CA deleted successfully', 'success');
      app.navigate('ca');
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
};

function renderCATree(root, allCAs) {
  const children = allCAs.filter(ca => ca.parent_id === root.id);

  return `
    <div class="ca-tree-item">
      <div class="ca-tree-node clickable" onclick="app.navigate('ca-detail', '${root.id}')">
        <div class="ca-tree-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="ca-tree-info">
          <strong>${escapeHtml(root.name)}</strong>
          <span class="badge badge-${root.type}">${root.type}</span>
          <span class="ca-tree-cn">${escapeHtml(root.common_name)}</span>
          <span class="ca-tree-meta">${root.key_algorithm} | Expires ${formatDate(root.not_after)}</span>
        </div>
        <div class="ca-tree-status">
          <span class="status-dot status-${root.status}"></span>
        </div>
      </div>
      ${children.length > 0 ? `
        <div class="ca-tree-children">
          ${children.map(child => renderCATree(child, allCAs)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
