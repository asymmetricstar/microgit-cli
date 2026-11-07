import { CliError } from '../error/index.js';
import { BIN } from '../config/settings.js';
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
export class ApiClient {
    baseUrl;
    token;
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }
    endpoint(pathname) {
        return `${this.baseUrl}${pathname}`;
    }
    repoPath(owner, name) {
        return `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    }
    async request(method, pathname, body) {
        const headers = { Accept: 'application/json' };
        if (this.token)
            headers.Authorization = `Bearer ${this.token}`;
        if (body !== undefined)
            headers['Content-Type'] = 'application/json';
        let response;
        try {
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
                abortController.abort('Network timeout or server unreachable');
            }, 10_000);
            response = await fetch(this.endpoint(pathname), {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: abortController.signal,
            });
            clearTimeout(timeoutId);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Cannot reach') || message.includes('fetch failed') || message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('timeout')) {
                throw new CliError(`Cannot reach ${this.baseUrl}. Please check your connection or server status.`);
            }
            throw new CliError(`Cannot reach ${this.baseUrl}: ${message}`);
        }
        const text = await response.text();
        const contentType = response.headers?.get?.('content-type') || '';
        const ct = contentType.trim().toLowerCase();
        const isNotJson = ct.length > 0 && !ct.includes('json');
        let data = null;
        if (text.trim() !== '' && !isNotJson) {
            try {
                data = JSON.parse(text);
            }
            catch {
                data = text;
            }
        }
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            if (data !== null &&
                typeof data === 'object' &&
                'error' in data &&
                typeof data.error === 'string') {
                message = data.error;
            }
            if (response.status === 401 && this.token) {
                message += `\nRun \`${BIN} login\` to start a new session.`;
            }
            throw new ApiError(response.status, message);
        }
        if (data === null || typeof data !== 'object') {
            throw new CliError(`${this.endpoint(pathname)} did not return JSON. Is ${this.baseUrl} a git-server?`);
        }
        return data;
    }
    login(username, password) {
        return this.request('POST', '/api/login', { username, password });
    }
    register(username, password) {
        return this.request('POST', '/api/register', { username, password });
    }
    logout() {
        return this.request('POST', '/api/logout');
    }
    me() {
        return this.request('GET', '/api/me');
    }
    listRepos(options = {}) {
        const query = new URLSearchParams();
        if (options.owner)
            query.set('owner', options.owner);
        if (options.name)
            query.set('name', options.name);
        if (options.private !== undefined && options.private !== null) {
            query.set('private', options.private ? 'true' : 'false');
        }
        if (options.page !== undefined)
            query.set('page', String(options.page));
        if (options.limit !== undefined)
            query.set('limit', String(options.limit));
        const suffix = query.toString() === '' ? '' : `?${query.toString()}`;
        return this.request('GET', `/api/repos${suffix}`);
    }
    repo(owner, name) {
        return this.request('GET', this.repoPath(owner, name));
    }
    newRepo(name, isPrivate = false) {
        return this.request('POST', '/api/new', { name, private: isPrivate });
    }
    deleteRepo(owner, name) {
        return this.request('DELETE', this.repoPath(owner, name));
    }
    listMembers(owner, name) {
        return this.request('GET', `${this.repoPath(owner, name)}/members`);
    }
    addMember(owner, name, username, role = 'read') {
        return this.request('POST', `${this.repoPath(owner, name)}/members`, {
            username,
            role,
        });
    }
    removeMember(owner, name, username) {
        return this.request('DELETE', `${this.repoPath(owner, name)}/members/${encodeURIComponent(username)}`);
    }
}
export async function apiClientFor(options) {
    if (options.token)
        return new ApiClient(options.url, options.token);
    const { username, password } = options.credentials ?? {};
    if (username && password) {
        const session = await new ApiClient(options.url).login(username, password);
        return new ApiClient(options.url, session.token);
    }
    return new ApiClient(options.url);
}
//# sourceMappingURL=index.js.map