const API_BASE = '/api/v1';

const api = {
  getToken() {
    return localStorage.getItem('firessl_token');
  },

  async request(method, path, body = null) {
    const token = this.getToken();
    const options = {
      method,
      headers: {
        'X-Auth-Token': token || '',
      },
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, options);

    // Handle unauthorized
    if (res.status === 401) {
      localStorage.removeItem('firessl_token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }
    return data;
  },

  // Auth
  auth: {
    async check() {
      const token = localStorage.getItem('firessl_token');
      if (!token) return false;
      try {
        const res = await fetch(`${API_BASE}/auth/check`, {
          headers: { 'X-Auth-Token': token }
        });
        const data = await res.json();
        return data.authenticated;
      } catch {
        return false;
      }
    },
    logout() {
      const token = localStorage.getItem('firessl_token');
      localStorage.removeItem('firessl_token');
      if (token) {
        fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'X-Auth-Token': token }
        });
      }
      window.location.href = '/login';
    }
  },

  // CA endpoints
  ca: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return api.request('GET', `/ca${qs ? '?' + qs : ''}`);
    },
    getById: (id) => api.request('GET', `/ca/${id}`),
    getChain: (id) => api.request('GET', `/ca/${id}/chain`),
    createRoot: (data) => api.request('POST', '/ca/root', data),
    createIntermediate: (data) => api.request('POST', '/ca/intermediate', data),
    delete: (id) => api.request('DELETE', `/ca/${id}`),
  },

  // Certificate endpoints
  certs: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return api.request('GET', `/certs${qs ? '?' + qs : ''}`);
    },
    getById: (id) => api.request('GET', `/certs/${id}`),
    createServer: (data) => api.request('POST', '/certs/server', data),
    createClient: (data) => api.request('POST', '/certs/client', data),
    revoke: (id) => api.request('POST', `/certs/${id}/revoke`),
    delete: (id) => api.request('DELETE', `/certs/${id}`),
  },

  // Export endpoints (need token in URL for downloads)
  export: {
    pemUrl: (id, type) => {
      const token = api.getToken();
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      params.set('token', token);
      return `${API_BASE}/export/${id}/pem?${params}`;
    },
    derUrl: (id) => {
      const token = api.getToken();
      return `${API_BASE}/export/${id}/der?token=${token}`;
    },
    p12Url: (id, password) => {
      const token = api.getToken();
      return `${API_BASE}/export/${id}/p12?password=${encodeURIComponent(password)}&token=${token}`;
    },
    chainUrl: (id) => {
      const token = api.getToken();
      return `${API_BASE}/export/${id}/chain?token=${token}`;
    },
  },
};
