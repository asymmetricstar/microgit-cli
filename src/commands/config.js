import fs from 'node:fs';
import { clearStoredConfig, configFilePath, loadConfig, normalizeUrl, readStoredConfig, writeStoredConfig, } from '../config/index.js';
import { BIN } from '../config/settings.js';
import { ask, fail, info, ok } from '../ui/index.js';
function mask(value) {
    if (value.length <= 8)
        return 'saved';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
async function editConfigFile(file) {
    if (!fs.existsSync(file))
        writeStoredConfig(readStoredConfig());
    const editor = process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad.exe' : 'vi');
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(editor, [file], { stdio: 'inherit' });
    if (result.status !== 0) {
        fail(`Editor exited with code ${result.status ?? 'unknown'}.`);
    }
    ok(`Edited ${file}.`);
}
async function showConfigMenu() {
    const stored = readStoredConfig();
    const config = loadConfig();
    console.log('');
    console.log('  [1] Server URL');
    console.log('  [2] Username');
    console.log('  [3] Token');
    console.log('  [4] Password');
    console.log('  [5] Edit config file');
    console.log('  [6] Clear config');
    console.log('  [7] Exit');
    console.log('');
    const choice = await ask('Select an option [1-7]: ');
    if (choice === '1') {
        const url = await promptValue('Server URL (e.g. http://127.0.0.1:3000)', stored.url || 'http://127.0.0.1:3000');
        const next = { ...stored, url: normalizeUrl(url) };
        writeStoredConfig(next);
        ok(`Updated Server URL to ${url}`);
    }
    else if (choice === '2') {
        const username = await promptValue('Username', stored.username || '');
        const next = { ...stored, username: username || undefined };
        writeStoredConfig(next);
        ok(`Updated Username to ${username || '(none)'}`);
    }
    else if (choice === '3') {
        const token = await promptValue('Token', stored.token || '');
        const next = { ...stored, token: token || undefined };
        writeStoredConfig(next);
        ok(`Updated Token`);
    }
    else if (choice === '4') {
        const password = await promptValue('Password', stored.password || '');
        const next = { ...stored, password: password || undefined };
        writeStoredConfig(next);
        if (password)
            info('The password is stored in plain text in the config file.');
        ok(`Updated Password`);
    }
    else if (choice === '5') {
        await editConfigFile(configFilePath());
    }
    else if (choice === '6') {
        clearStoredConfig();
        ok(`Removed ${configFilePath()}`);
    }
    else if (choice === '7') {
    }
    else {
        console.log('Invalid option. Please select 1-7.');
        await showConfigMenu();
    }
}
async function promptValue(question, defaultVal) {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    return ask(prompt);
}
export async function configCommand(argv) {
    const json = argv.includes('--json');
    const args = argv.filter((arg) => arg !== '--json');
    const [action, key, ...rest] = args;
    if (!action || action === 'show' || action === '--help' || action === '-h') {
        await showConfigMenu();
        return;
    }
    if (action === 'path') {
        console.log(configFilePath());
        return;
    }
    if (action === 'edit') {
        await editConfigFile(configFilePath());
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
//# sourceMappingURL=config.js.map