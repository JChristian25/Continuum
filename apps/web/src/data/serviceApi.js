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

function importErrorMessage(error) {
  const details = error?.details;
  if (error?.code === 'limit_exceeded' && details?.limitName === 'maximumUniqueBlobBytes' && Number.isSafeInteger(details.maximum)) {
    return `The selected file content exceeds the ${details.maximum / 1048576} MiB import limit. Select fewer commits or specific paths and try again.`;
  }
  if (details?.gitInventory?.capturedPaths === 0) {
    const exclusions = details.gitInventory.excluded || [];
    const examples = exclusions.slice(0, 3).map(({path, reason}) => `${path} (${reason})`);
    const rest = exclusions.length - examples.length;
    return [details.reason, examples.join(', '), rest > 0 && `and ${rest} more excluded`].filter(Boolean).join(' ');
  }
  return error?.message;
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
      const isImport = path === '/workspaces' || path.endsWith('/revisions');
      const message = isImport ? importErrorMessage(data?.error) : data?.error?.message;
      throw new ServiceError(message || 'The service could not complete this request.', {
        status: response.ok ? 502 : response.status, code: data?.error?.code || 'unavailable', details: data?.error?.details,
      });
    }
    return data;
  }

  async session(signal = AbortSignal.timeout(12000)) {
    const generation = ++this.authVersion;
    let data;
    try {
      data = await this.request('/auth/session', { signal });
    } catch (error) {
      if (signal?.reason?.name === 'TimeoutError') {
        throw new ServiceError('The session check timed out. Check that the Continuum API and database are running, then reload.');
      }
      throw error;
    }
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
  createWorkspace(payload) { return this.request('/workspaces', { body: payload }); }
  addRevision(repositoryId, payload) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/revisions`, { body: payload });
  }
  inspectGit(payload, signal) {
    return this.request('/git/inspect', {
      signal,
      body: { schemaVersion: '0.1.0', requestId: crypto.randomUUID(), ...payload },
    }).then(data => data.result);
  }
  query(repositoryId, query, input, signal) {
    return this.request('/queries', { signal, body: {
      schemaVersion: '0.1.0', requestId: crypto.randomUUID(), repositoryId, query, input,
    } }).then(data => data.result);
  }
  command(envelope) { return this.request('/commands', { body: envelope }); }
  context(repositoryId, contextId, viewId, signal, { includeExcerpts = false } = {}) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/contexts/${encodeURIComponent(contextId)}?viewId=${encodeURIComponent(viewId)}${includeExcerpts ? '&includeExcerpts=true' : ''}`, { signal });
  }
  version(repositoryId, versionId, signal) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/versions/${encodeURIComponent(versionId)}`, { signal });
  }
  blame(repositoryId, versionId, signal) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/versions/${encodeURIComponent(versionId)}/blame`, { signal });
  }
  gitCommits(repositoryId, { ref = 'HEAD', limit = 40, path = null } = {}, signal) {
    const params = new URLSearchParams({ ref, limit: String(limit), ...(path ? { path } : {}) });
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/git/commits?${params}`, { signal });
  }
  gitCommitDetail(repositoryId, commitId, path = null, signal) {
    const params = path ? `?${new URLSearchParams({ path })}` : '';
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/git/commits/${encodeURIComponent(commitId)}${params}`, { signal });
  }
  evidence(repositoryId, evidenceId, signal) {
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/evidence/${encodeURIComponent(evidenceId)}`, { signal });
  }
  history(repositoryId, contextId, viewId, cursor = null, signal) {
    const params = new URLSearchParams({ viewId, pageSize: '50', ...(cursor ? { cursor } : {}) });
    return this.request(`/repositories/${encodeURIComponent(repositoryId)}/contexts/${encodeURIComponent(contextId)}/history?${params}`, { signal });
  }
}
