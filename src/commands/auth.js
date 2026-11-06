import { parseArgs } from 'node:util';
import { ApiClient, ApiError, apiClientFor } from '../api/index.js';
import { DEFAULT_URL, ENV, forgetPassword, loadConfig, normalizeUrl, readStoredConfig, requireAuth, resolveUrl, splitCredentials, writeStoredConfig, } from '../config/index.js';
import { BIN } from '../config/settings.js';
import { ask, askSecret, bold, cyan, dim, fail, faint, formatDate, info, ok, printJson, warn } from '../ui/index.js';
const LOGIN_OPTIONS = {
    url: { type: 'string' },
    username: { type: 'string', short: 'u' },
    user: { type: 'string' },
    password: { type: 'string', short: 'p' },
    'save-password': { type: 'boolean' },
    'forget-password': { type: 'boolean' },
    force: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
};
function text(value) {
    return typeof value === 'string' && value !== '' ? value : undefined;
}
function trimmed(value) {
    const valueText = text(value)?.trim();
    return valueText === '' ? undefined : valueText;
}
function printLoginHelp() {
    console.log(`Usage: ${BIN} login [username] [options]

Sign in and store the API session token for later commands. A stored session
that is still valid is reused, so your username and password are not asked for
again; pass --force to sign in as another account.

Options:
  --url <url>        Server URL (default: stored, then http://{HOST_NAME}:{PORT})
  -u, --username     Account name (also ${ENV.username})
     --user           Alias for --username
  -p, --password     Password (also ${ENV.password})
  --forget-password  Remove any password saved by an earlier login
  --force            Sign in again even when a session is stored
  --json             Print the result as JSON
  -h, --help         Show this help

Examples:
  ${BIN} login
  ${BIN} login alice --url http://{HOST_NAME}:{PORT}`);
}
function printRegisterHelp() {
    console.log(`Usage: ${BIN} register [username] [options]

Create an account (when the server allows registration) and sign in.

Options:
  --url <url>        Server URL
  -u, --username     Account name (also ${ENV.username})
     --user           Alias for --username
  -p, --password     Password (also ${ENV.password})
  --forget-password  Remove any password saved by an earlier login
  --json             Print the result as JSON
  -h, --help         Show this help`);
}
function saveSession(url, username, token, expiresAt, password, forgetPassword) {
    const stored = readStoredConfig();
    const next = {
        ...stored,
        url,
        username,
        token,
        expiresAt,
    };
    if (password !== undefined)
        next.password = password;
    else if (forgetPassword)
        delete next.password;
    else if (stored.password && stored.username === username)
        next.password = stored.password;
    else
        delete next.password;
    writeStoredConfig(next);
}
function showMotd(motd) {
    const message = motd?.trim();
    if (!message)
        return;
    console.log('');
    console.log(`${faint('#')} ${dim('message from the server')}`);
    for (const line of message.split(/\r?\n/))
        console.log(`  ${line}`);
    console.log('');
}
async function reuseSession(flagUrl, stored, json) {
    if (!stored.token)
        return false;
    const url = resolveUrl(flagUrl);
    if (stored.url !== undefined && normalizeUrl(stored.url) !== url)
        return false;
    const expiresAt = stored.expiresAt;
    if (expiresAt !== undefined && new Date(expiresAt).getTime() <= Date.now())
        return false;
    let user;
    try {
        user = await new ApiClient(url, stored.token).me();
    }
    catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            info('The stored session is no longer valid; signing in again.');
            return false;
        }
        throw error;
    }
    if (json) {
        printJson({ url, user, expiresAt, motd: user.motd, alreadySignedIn: true });
        return true;
    }
    ok(`Already signed in as ${bold(user.username)}${user.admin ? bold(' (admin)') : ''}`);
    info(`Server: ${url}`);
    if (expiresAt)
        info(`Session expires: ${formatDate(expiresAt)}`);
    showMotd(user.motd);
    info(`Use --force to sign in again, or ${cyan(`${BIN} logout`)} first.`);
    return true;
}
export async function loginCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: LOGIN_OPTIONS,
    });
    if (values.help)
        return printLoginHelp();
    const stored = readStoredConfig();
    const positional = trimmed(positionals[0]);
    const positionalIsUrl = positional !== undefined && /^[a-z][a-z0-9+.-]*:\/\//i.test(positional);
    const urlCreds = splitCredentials(normalizeUrl(text(values.url) ||
        (positionalIsUrl ? positional : undefined) ||
        process.env[ENV.url] ||
        stored.url ||
        DEFAULT_URL));
    const url = urlCreds.url;
    const flagUser = trimmed(values.username) ?? trimmed(values.user) ?? (positionalIsUrl ? undefined : positional);
    const envUser = trimmed(process.env[ENV.username]);
    const flagPassword = text(values.password) ?? process.env[ENV.password];
    if (!values.force &&
        flagUser === undefined &&
        envUser === undefined &&
        flagPassword === undefined &&
        urlCreds.username === undefined &&
        urlCreds.password === undefined) {
        if (await reuseSession(text(values.url), stored, Boolean(values.json)))
            return;
    }
    let username = flagUser ?? urlCreds.username ?? envUser;
    let password = text(values.password) ?? urlCreds.password ?? process.env[ENV.password];
    const hasUrlArg = argv.includes('--url') || argv.some(a => a.startsWith('http://') || a.startsWith('https://'));
    if (!username) {
        if (!hasUrlArg) {
            username = await ask('Username: ');
        }
        else {
            fail('Username is required. Use --user/--username, or embed it in the URL (http://user@host).');
        }
    }
    if (!password) {
        if (!hasUrlArg && username) {
            password = await askSecret('Password: ');
        }
        else if (hasUrlArg) {
            fail('Password is required. Use --password, or embed it in the URL (http://user:pass@host).');
        }
    }
    if (!username)
        fail('Username is required.');
    if (!password)
        fail('Password is required.');
    const api = new ApiClient(url);
    const result = await api.login(username, password);
    saveSession(url, result.user.username, result.token, result.expiresAt, values['save-password'] ? password : undefined, Boolean(values['forget-password']));
    if (values.json) {
        printJson({
            url,
            user: result.user,
            expiresAt: result.expiresAt,
            motd: result.motd,
        });
        return;
    }
    ok(`Signed in as ${bold(result.user.username)}${result.user.admin ? bold(' (admin)') : ''}`);
    info(`Server: ${url}`);
    info(`Session expires: ${formatDate(result.expiresAt)}`);
    if (values['save-password'])
        info('Password saved for git commands.');
    showMotd(result.motd);
}
export async function registerCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: LOGIN_OPTIONS,
    });
    if (values.help)
        return printRegisterHelp();
    const stored = readStoredConfig();
    const positional = trimmed(positionals[0]);
    const positionalIsUrl = positional !== undefined && /^[a-z][a-z0-9+.-]*:\/\//i.test(positional);
    const urlCreds = splitCredentials(normalizeUrl(text(values.url) ||
        (positionalIsUrl ? positional : undefined) ||
        process.env[ENV.url] ||
        stored.url ||
        DEFAULT_URL));
    const url = urlCreds.url;
    let username = trimmed(values.username) ??
        trimmed(values.user) ??
        (positionalIsUrl ? undefined : positional) ??
        urlCreds.username ??
        trimmed(process.env[ENV.username]);
    let password = text(values.password) ?? urlCreds.password ?? process.env[ENV.password];
    const hasUrlArg = argv.includes('--url') || argv.some(a => a.startsWith('http://') || a.startsWith('https://'));
    if (!username) {
        if (!hasUrlArg) {
            username = await ask('Username: ');
        }
        else {
            fail('Username is required. Use --user/--username, or embed it in the URL (http://user@host).');
        }
    }
    if (!password) {
        if (!hasUrlArg && username) {
            password = await askSecret('Password: ');
        }
        else if (hasUrlArg) {
            fail('Password is required. Use --password, or embed it in the URL (http://user:pass@host).');
        }
    }
    if (!username)
        fail('Username is required.');
    if (!password)
        fail('Password is required.');
    const api = new ApiClient(url);
    const result = await api.register(username, password);
    saveSession(url, result.user.username, result.token, result.expiresAt, values['save-password'] ? password : undefined, Boolean(values['forget-password']));
    if (values.json) {
        printJson({
            url,
            user: result.user,
            expiresAt: result.expiresAt,
            motd: result.motd,
        });
        return;
    }
    ok(`Account created and signed in as ${bold(result.user.username)}`);
    info(`Server: ${url}`);
    info(`Session expires: ${formatDate(result.expiresAt)}`);
    if (values['save-password'])
        info('Password saved for git commands.');
    showMotd(result.motd);
}
export async function logoutCommand(argv) {
    const { values } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            url: { type: 'string' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} logout [--url <url>] [--json]`);
        return;
    }
    const config = loadConfig(text(values.url));
    let revoked = false;
    if (config.token) {
        try {
            const result = await new ApiClient(config.url, config.token).logout();
            revoked = result.loggedOut;
        }
        catch (error) {
            if (error instanceof ApiError && error.status === 401) {
            }
            else {
                warn(`Could not revoke the server session: ${error.message}`);
            }
        }
    }
    const stored = readStoredConfig();
    writeStoredConfig({
        url: stored.url ?? config.url,
    });
    forgetPassword();
    if (values.json) {
        printJson({ loggedOut: revoked, url: config.url });
        return;
    }
    if (config.token)
        ok('Signed out. Local session and saved password were removed.');
    else
        info('Already signed out. Local credentials were cleared.');
}
export async function whoamiCommand(argv) {
    const { values } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            url: { type: 'string' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} whoami [--url <url>] [--json]`);
        return;
    }
    const config = loadConfig(text(values.url));
    requireAuth(config);
    const api = await apiClientFor({
        url: config.url,
        token: config.token,
        credentials: config.urlCredentials,
    });
    const user = await api.me();
    if (values.json) {
        printJson({
            url: config.url,
            user,
            expiresAt: config.expiresAt,
        });
        return;
    }
    ok(`Signed in as ${bold(user.username)}${user.admin ? bold(' (admin)') : ''}`);
    info(`Server: ${config.url}`);
    if (config.expiresAt)
        info(`Session expires: ${formatDate(config.expiresAt)}`);
    showMotd(user.motd);
}
//# sourceMappingURL=auth.js.map