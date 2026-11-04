import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CliError } from '../error/index.js';
import { BIN, SETTINGS } from './settings.js';
/** Environment variables, named from the settings prefix. */
export const ENV = {
    url: `${SETTINGS.envPrefix}_URL`,
    token: `${SETTINGS.envPrefix}_TOKEN`,
    username: `${SETTINGS.envPrefix}_USERNAME`,
    password: `${SETTINGS.envPrefix}_PASSWORD`,
    config: `${SETTINGS.envPrefix}_CONFIG`,
};
export const DEFAULT_URL = 'http://127.0.0.1:3000';
/** `MICROGIT_CONFIG` (or the settings prefix) can point at a different file. */
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
    // Windows ignores the mode; everywhere else keep the file private.
    try {
        fs.chmodSync(file, 0o600);
    }
    catch {
        // Best effort only.
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
/** Accept `host`, `host:3000`, `https://host`; strip trailing slashes. */
export function normalizeUrl(raw) {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (trimmed === '')
        return DEFAULT_URL;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
/** `--url` first, then the URL env var, then the stored value, then localhost. */
export function resolveUrl(flagUrl) {
    const stored = readStoredConfig();
    return normalizeUrl(flagUrl?.trim() || process.env[ENV.url]?.trim() || stored.url || DEFAULT_URL);
}
/** Everything a command needs: URL, token and optional git credentials. */
export function loadConfig(flagUrl) {
    const stored = readStoredConfig();
    return {
        ...stored,
        url: resolveUrl(flagUrl),
        token: process.env[ENV.token]?.trim() || stored.token,
        username: process.env[ENV.username]?.trim() || stored.username,
        password: process.env[ENV.password] || stored.password,
        configPath: configFilePath(),
    };
}
export function requireAuth(config) {
    if (!config.token) {
        throw new CliError(`You are not signed in. Run \`${BIN} login\` first.`);
    }
}
/** Basic credentials for git, or `null` when only the API session is stored. */
export function gitAuth(config) {
    if (config.username && config.password) {
        return { username: config.username, password: config.password };
    }
    return null;
}
//# sourceMappingURL=index.js.map