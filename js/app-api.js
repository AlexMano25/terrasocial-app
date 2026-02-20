(function initApiGlobal() {
  const LEGACY_API_HOSTS = ['api.social.manoverde.com', 'api.social.manovende.com'];

  function isLegacyApiBase(value) {
    if (!value) return false;
    try {
      const url = new URL(value, window.location.origin);
      return LEGACY_API_HOSTS.includes(url.hostname);
    } catch (error) {
      return false;
    }
  }

  function resolveApiBase() {
    const runtimeBase = window.TERRASOCIAL_API_BASE;
    if (runtimeBase && !isLegacyApiBase(runtimeBase)) {
      return runtimeBase.replace(/\/+$/, '');
    }

    const localBase = localStorage.getItem('ts_api_base');
    if (localBase && !isLegacyApiBase(localBase)) {
      return localBase.replace(/\/+$/, '');
    }

    if (localBase && isLegacyApiBase(localBase)) {
      localStorage.removeItem('ts_api_base');
    }

    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) return 'http://localhost:4000';

    // In production, default to same-origin to avoid mixed-content/network errors.
    return window.location.origin;
  }

  const API_BASE = resolveApiBase();

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

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
    } catch (error) {
      throw new Error(`Backend injoignable (${API_BASE}). Configure ts_api_base vers ton API publique.`);
    }
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
