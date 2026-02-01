const API_BASE = '/api/v1';

const api = {
  async request(method, path, body = null) {
    const options = {
      method,
      headers: {},
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, options);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }
    return data;
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

  // Export endpoints
  export: {
    pemUrl: (id, type) => `${API_BASE}/export/${id}/pem${type ? '?type=' + type : ''}`,
    derUrl: (id) => `${API_BASE}/export/${id}/der`,
    p12Url: (id, password) => `${API_BASE}/export/${id}/p12?password=${encodeURIComponent(password)}`,
    chainUrl: (id) => `${API_BASE}/export/${id}/chain`,
  },
};
