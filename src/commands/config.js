import fs from 'node:fs';
import { clearStoredConfig, configFilePath, loadConfig, normalizeUrl, readStoredConfig, writeStoredConfig, } from '../config/index.js';
import { BIN } from '../config/settings.js';
import { fail, formatDate, info, ok, printJson } from '../ui/index.js';
function mask(value) {
    if (value.length <= 8)
        return 'saved';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
export async function configCommand(argv) {
    const json = argv.includes('--json');
    const args = argv.filter((arg) => arg !== '--json');
    const [action, key, ...rest] = args;
    if (!action || action === 'show' || action === '--help' || action === '-h') {
        showConfig(json);
        return;
    }
    if (action === 'path') {
        console.log(configFilePath());
        return;
    }
    if (action === 'edit') {
        const file = configFilePath();
        // Make sure the file exists.
        if (!fs.existsSync(file))
            writeStoredConfig(readStoredConfig());
        const editor = process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'vi');
        const { spawnSync } = await import('node:child_process');
        const result = spawnSync(editor, [file], { stdio: 'inherit', shell: true });
        if (result.status !== 0) {
            fail(`Editor exited with code ${result.status ?? 'unknown'}.`);
        }
        ok(`Edited ${file}.`);
        return;
    }
    if (action === 'clear') {
        clearStoredConfig();
        ok(`Removed ${configFilePath()}`);
        return;
    }
    if (action === 'set') {
        const name = key?.trim();
        const value = rest.join(' ').trim();
        if (!name || value === '') {
            fail(`Usage: ${BIN} config set <url|username|token|password> <value>`);
        }
        const stored = readStoredConfig();
        const next = { ...stored };
        if (name === 'url')
            next.url = normalizeUrl(value);
        else if (name === 'username')
            next.username = value;
        else if (name === 'token')
            next.token = value;
        else if (name === 'password')
            next.password = value;
        else
            fail(`Unknown config key '${name}'. Use url, username, token or password.`);
        writeStoredConfig(next);
        ok(`Set ${name}.`);
        if (name === 'password')
            info('The password is stored in plain text in the config file.');
        return;
    }
    if (action === 'unset') {
        const name = key?.trim();
        if (!name)
            fail(`Usage: ${BIN} config unset <token|password|username|expiresAt>`);
        const stored = readStoredConfig();
        const next = { ...stored };
        if (name === 'token' || name === 'password' || name === 'username' || name === 'expiresAt') {
            delete next[name];
        }
        else {
            fail(`Unknown config key '${name}'.`);
        }
        writeStoredConfig(next);
        ok(`Unset ${name}.`);
        return;
    }
    fail(`Unknown config action '${action}'. Try: ${BIN} config`);
}
function showConfig(json) {
    const config = loadConfig();
    const stored = readStoredConfig();
    const token = config.token;
    if (json) {
        printJson({
            configPath: config.configPath,
            url: config.url,
            username: config.username ?? null,
            token: token ? 'saved' : null,
            expiresAt: config.expiresAt ?? null,
            password: config.password ? 'saved' : null,
        });
        return;
    }
    const row = (label, value) => `  ${label.padEnd(12)} ${value}`;
    console.log(row('Config file', config.configPath));
    console.log(row('Server', config.url));
    console.log(row('Username', config.username ?? '-'));
    console.log(row('Token', token ? mask(token) : '-'));
    console.log(row('Expires', formatDate(config.expiresAt)));
    console.log(row('Password', stored.password ? 'saved (plain text)' : '-'));
}
//# sourceMappingURL=config.js.map