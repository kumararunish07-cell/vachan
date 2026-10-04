class VachanAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = null;
  }

  async request(path, options = {}) {
    const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    let response = await fetch(`${this.baseUrl}${path}`, { credentials: 'include', ...options, headers });
    if (response.status === 401 && path !== '/api/auth/refresh') {
      const refreshed = await this.refresh();
      if (refreshed) {
        headers.authorization = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseUrl}${path}`, { credentials: 'include', ...options, headers });
      }
    }
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message || 'Vachan API request failed');
    return body;
  }

  async register(input) { const result = await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }); this.accessToken = result.accessToken; return result; }
  async login(input) { const result = await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }); this.accessToken = result.accessToken; return result; }
  async refresh() { try { const result = await this.request('/api/auth/refresh', { method: 'POST', body: '{}' }); this.accessToken = result.accessToken; return true; } catch { return false; } }
  async logout() { await this.request('/api/auth/logout', { method: 'POST', body: '{}' }); this.accessToken = null; }
  async me() { return this.request('/api/me'); }
  async listDeals() { return this.request('/api/deals'); }
  async createDeal(input) { return this.request('/api/deals', { method: 'POST', body: JSON.stringify(input) }); }
  async getDeal(id) { return this.request(`/api/deals/${encodeURIComponent(id)}`); }
  async appendEvent(id, type, payload = {}) { return this.request(`/api/deals/${encodeURIComponent(id)}/events`, { method: 'POST', body: JSON.stringify({ type, payload }) }); }
  async createDemoPaymentIntent(dealId) { return this.request('/api/payments/intents', { method: 'POST', body: JSON.stringify({ dealId }) }); }
}

window.VachanAPI = VachanAPI;
