export class ServiceError extends Error {
  constructor(message, { status = 0, code = 'unavailable', details = {} } = {}) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.uncertain = status === 0 || status >= 500;
  }
}

export class ContinuumApi {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) {
    this.fetcher = fetcher;
    this.csrf = null;
    this.authVersion = 0;
  }

  async request(path, { body, signal, csrf = this.csrf } = {}) {
    let response;
    try {
      response = await this.fetcher(`/api/v1${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new ServiceError('The service could not be reached. Your unsent work is kept.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || data === null) {
      throw new ServiceError(data?.error?.message || 'The service could not complete this request.', {
        status: response.ok ? 502 : response.status, code: data?.error?.code || 'unavailable', details: data?.error?.details,
      });
    }
    return data;
  }

  async session(signal) {
    const generation = ++this.authVersion;
    const data = await this.request('/auth/session', { signal });
    if (generation === this.authVersion) this.csrf = data.csrfToken;
    return data;
  }

  async signIn(login, password) {
    ++this.authVersion;
    const bootstrap = await this.request('/auth/bootstrap');
    await this.request('/auth/login', { csrf: bootstrap.csrfToken,
      body: { schemaVersion: '0.1.0', requestId: crypto.randomUUID(), login, password } });
    return this.session();
  }

  async signOut() {
    ++this.authVersion;
    try {
      await this.request('/auth/logout', { body: {} });
    } catch (error) {
      if (error.status !== 401) throw error;
      const pre = await this.request('/auth/bootstrap');
      await this.request('/auth/logout', { body: {}, csrf: pre.csrfToken });
    }
    this.csrf = null;
  }

  workspace(signal) { return this.request('/workspace', { signal }); }
  query(repositoryId, query, input, signal) {
    return this.request('/queries', { signal, body: {
      schemaVersion: '0.1.0', requestId: crypto.randomUUID(), repositoryId, query, input,
    } }).then(data => data.result);
  }
  command(envelope) { return this.request('/commands', { body: envelope }); }
  context(repositoryId, contextId, viewId, signal) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/contexts/${encodeURIComponent(contextId)}?viewId=${encodeURIComponent(viewId)}`, { signal });
  }
  version(repositoryId, versionId, signal) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/versions/${encodeURIComponent(versionId)}`, { signal });
  }
  evidence(repositoryId, evidenceId, signal) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/evidence/${encodeURIComponent(evidenceId)}`, { signal });
  }
  history(repositoryId, contextId, viewId, cursor = null, signal) {
    const params = new URLSearchParams({ viewId, pageSize: '50', ...(cursor ? { cursor } : {}) });
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/contexts/${encodeURIComponent(contextId)}/history?${params}`, { signal });
  }
}
