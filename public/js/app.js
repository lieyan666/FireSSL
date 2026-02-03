// Utility functions
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Modal management
function showModal(title, content) {
  const existing = document.getElementById('modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Application router
const app = {
  navigate(page, param) {
    window.location.hash = param ? `${page}/${param}` : page;
  },

  async checkAuth() {
    const authenticated = await api.auth.check();
    if (!authenticated) {
      window.location.href = '/login';
      return false;
    }
    return true;
  },

  async route() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const [page, param] = hash.split('/');

    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page || link.dataset.page === page.split('-')[0]);
    });

    switch (page) {
      case 'dashboard':
        await DashboardPage.render();
        break;
      case 'ca':
        await CAPage.renderList();
        break;
      case 'ca-detail':
        await CAPage.renderDetail(param);
        break;
      case 'certs':
        await CertPage.renderList();
        break;
      case 'cert-detail':
        await CertPage.renderDetail(param);
        break;
      case 'create-cert':
        await CertPage.renderList();
        CertPage.showCreateForm(param);
        break;
      default:
        await DashboardPage.render();
    }
  },

  logout() {
    api.auth.logout();
  },
};

// Initialize
window.addEventListener('hashchange', () => app.route());
window.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  if (await app.checkAuth()) {
    app.route();
  }
});
