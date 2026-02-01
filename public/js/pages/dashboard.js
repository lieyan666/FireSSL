const DashboardPage = {
  async render() {
    const container = document.getElementById('page-content');
    container.innerHTML = '<div class="loading">Loading dashboard...</div>';

    try {
      const [cas, certs] = await Promise.all([
        api.ca.list(),
        api.certs.list(),
      ]);

      const rootCAs = cas.filter(ca => ca.type === 'root');
      const intermediateCAs = cas.filter(ca => ca.type === 'intermediate');
      const activeCerts = certs.filter(c => c.status === 'active');
      const revokedCerts = certs.filter(c => c.status === 'revoked');

      const expiringSoon = certs.filter(c => {
        if (c.status !== 'active') return false;
        const expiry = new Date(c.not_after);
        const daysLeft = (expiry - Date.now()) / (1000 * 60 * 60 * 24);
        return daysLeft <= 30 && daysLeft > 0;
      });

      container.innerHTML = `
        <div class="dashboard">
          <h2>Dashboard</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon root-ca-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-value">${rootCAs.length}</span>
                <span class="stat-label">Root CAs</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon intermediate-ca-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-value">${intermediateCAs.length}</span>
                <span class="stat-label">Intermediate CAs</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon cert-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h6"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-value">${activeCerts.length}</span>
                <span class="stat-label">Active Certificates</span>
              </div>
            </div>
            <div class="stat-card ${revokedCerts.length > 0 ? 'warning' : ''}">
              <div class="stat-icon revoked-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>
              </div>
              <div class="stat-info">
                <span class="stat-value">${revokedCerts.length}</span>
                <span class="stat-label">Revoked</span>
              </div>
            </div>
          </div>

          ${expiringSoon.length > 0 ? `
            <div class="alert alert-warning">
              <strong>Expiring Soon:</strong> ${expiringSoon.length} certificate(s) will expire within 30 days.
            </div>
          ` : ''}

          <div class="section">
            <h3>Recent Certificates</h3>
            ${certs.length === 0 ? '<p class="empty-state">No certificates yet. Create a CA first, then issue certificates.</p>' : `
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
                  ${certs.slice(0, 10).map(cert => `
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
            `}
          </div>

          <div class="section">
            <h3>Certificate Authorities</h3>
            ${cas.length === 0 ? '<p class="empty-state">No CAs created yet. Start by creating a Root CA.</p>' : `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Common Name</th>
                    <th>Algorithm</th>
                    <th>Status</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  ${cas.map(ca => `
                    <tr class="clickable" onclick="app.navigate('ca-detail', '${ca.id}')">
                      <td><strong>${escapeHtml(ca.name)}</strong></td>
                      <td><span class="badge badge-${ca.type}">${ca.type}</span></td>
                      <td>${escapeHtml(ca.common_name)}</td>
                      <td>${ca.key_algorithm}</td>
                      <td><span class="status-dot status-${ca.status}"></span>${ca.status}</td>
                      <td>${formatDate(ca.not_after)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error loading dashboard: ${escapeHtml(err.message)}</div>`;
    }
  },
};
