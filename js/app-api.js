(function initApiGlobal() {
  const API_BASE = window.TERRASOCIAL_API_BASE || localStorage.getItem('ts_api_base') || 'http://localhost:4000';

  function getToken() {
    return localStorage.getItem('ts_token');
  }

  function setSession(payload) {
    localStorage.setItem('ts_token', payload.token);
    localStorage.setItem('ts_user', JSON.stringify(payload.user));
  }

  function clearSession() {
    localStorage.removeItem('ts_token');
    localStorage.removeItem('ts_user');
  }

  async function request(path, options) {
    const headers = Object.assign({}, options?.headers || {});
    if (!(options?.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return data;
  }

  window.TSApi = {
    API_BASE,
    getToken,
    setSession,
    clearSession,
    request
  };
})();
