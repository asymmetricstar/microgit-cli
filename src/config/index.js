import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliError } from '../error/index.js';
import { BIN, SETTINGS } from './settings.js';
export const ENV = {
    url: `${SETTINGS.envPrefix}_URL`,
    token: `${SETTINGS.envPrefix}_TOKEN`,
    username: `${SETTINGS.envPrefix}_USERNAME`,
    password: `${SETTINGS.envPrefix}_PASSWORD`,
    config: `${SETTINGS.envPrefix}_CONFIG`,
};
export const DEFAULT_URL = 'http://127.0.0.1:3000';
export function configFilePath() {
    const override = process.env[ENV.config]?.trim();
    return override
        ? path.resolve(override)
        : path.join(os.homedir(), SETTINGS.configDir, 'config.json');
}
export function readStoredConfig() {
    const file = configFilePath();
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return {};
        throw new CliError(`Cannot read the config file ${file}: ${error.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        throw new CliError(`Config file ${file} is not valid JSON: ${error.message}\n` +
            `Fix it or run \`${BIN} config clear\`.`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new CliError(`Config file ${file} must contain a JSON object.`);
    }
    const value = parsed;
    const text = (key) => typeof value[key] === 'string' && value[key] !== '' ? value[key] : undefined;
    return {
        url: text('url'),
        username: text('username'),
        token: text('token'),
        expiresAt: text('expiresAt'),
        password: text('password'),
    };
}
export function writeStoredConfig(config) {
    const file = configFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const clean = {};
    if (config.url)
        clean.url = config.url;
    if (config.username)
        clean.username = config.username;
    if (config.token)
        clean.token = config.token;
    if (config.expiresAt)
        clean.expiresAt = config.expiresAt;
    if (config.password)
        clean.password = config.password;
    fs.writeFileSync(file, `${JSON.stringify(clean, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
    });
    try {
        fs.chmodSync(file, 0o600);
    }
    catch {
    }
}
export function clearStoredConfig() {
    try {
        fs.rmSync(configFilePath(), { force: true });
    }
    catch (error) {
        throw new CliError(`Cannot remove the config file: ${error.message}`);
    }
}
export function normalizeUrl(raw) {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (trimmed === '')
        return DEFAULT_URL;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
export function splitCredentials(raw) {
    const url = normalizeUrl(raw);
    const schemeEnd = url.indexOf('://');
    if (schemeEnd === -1)
        return { url };
    const authorityStart = schemeEnd + 3;
    const rest = url.slice(authorityStart);
    const authorityEnd = rest.search(/[/?#]/);
    const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
    const suffix = authorityEnd === -1 ? '' : rest.slice(authorityEnd);
    const at = authority.lastIndexOf('@');
    if (at === -1)
        return { url };
    const userinfo = authority.slice(0, at);
    const host = authority.slice(at + 1);
    if (userinfo === '' || host === '')
        return { url };
    const decode = (value) => {
        try {
            return decodeURIComponent(value);
        }
        catch {
            return value;
        }
    };
    const colon = userinfo.indexOf(':');
    const username = decode(colon === -1 ? userinfo : userinfo.slice(0, colon));
    const password = colon === -1 ? '' : decode(userinfo.slice(colon + 1));
    const result = { url: `${url.slice(0, authorityStart)}${host}${suffix}` };
    if (username !== '')
        result.username = username;
    if (password !== '')
        result.password = password;
    return result;
}
export function resolveUrl(flagUrl) {
    const stored = readStoredConfig();
    return splitCredentials(normalizeUrl(flagUrl?.trim() || process.env[ENV.url]?.trim() || stored.url || DEFAULT_URL)).url;
}
export function loadConfig(flagUrl) {
    const stored = readStoredConfig();
    const fromUrl = splitCredentials(normalizeUrl(flagUrl?.trim() || process.env[ENV.url]?.trim() || stored.url || DEFAULT_URL));
    return {
        ...stored,
        url: fromUrl.url,
        urlCredentials: fromUrl.username !== undefined || fromUrl.password !== undefined
            ? { username: fromUrl.username, password: fromUrl.password }
            : undefined,
        token: process.env[ENV.token]?.trim() || stored.token,
        username: fromUrl.username || process.env[ENV.username]?.trim() || stored.username,
        password: fromUrl.password || process.env[ENV.password] || stored.password,
        configPath: configFilePath(),
    };
}
export function requireAuth(config) {
    if (config.token)
        return;
    if (config.urlCredentials?.username && config.urlCredentials.password)
        return;
    throw new CliError(`You are not signed in. Run \`${BIN} login\` first.`);
}
export function sessionValid(config) {
    if (!config.token)
        return false;
    if (config.expiresAt === undefined)
        return true;
    const expires = Date.parse(config.expiresAt);
    return Number.isNaN(expires) || expires > Date.now();
}
let runtimePassword;
export function rememberPassword(url, username, password) {
    if (password === '')
        return;
    runtimePassword = { url, username, password };
}
export function forgetPassword() {
    runtimePassword = undefined;
}
function runtimeCredentialFor(config) {
    if (!runtimePassword || runtimePassword.url !== config.url)
        return undefined;
    return runtimePassword;
}
export function gitAuth(config) {
    const typed = runtimeCredentialFor(config);
    const username = config.urlCredentials?.username ?? config.username ?? typed?.username;
    if (!username)
        return null;
    const password = config.urlCredentials?.password ??
        typed?.password ??
        config.password ??
        (sessionValid(config) ? config.token : undefined);
    return password ? { username, password } : null;
}
//# sourceMappingURL=index.js.map