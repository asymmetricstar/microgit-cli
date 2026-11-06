import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ENV, gitAuth, rememberPassword } from '../config/index.js';
import { CliError } from '../error/index.js';
import { BIN } from '../config/settings.js';
import { ask, askSecret, info } from '../ui/index.js';
function gitEnv(auth) {
    const env = { ...process.env };
    delete env.GIT_CONFIG_COUNT;
    delete env.GIT_CONFIG_KEY_0;
    delete env.GIT_CONFIG_VALUE_0;
    if (!process.stdin.isTTY)
        env.GIT_TERMINAL_PROMPT = '0';
    if (auth) {
        const basic = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
        env.GIT_CONFIG_COUNT = '1';
        env.GIT_CONFIG_KEY_0 = 'http.extraHeader';
        env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${basic}`;
    }
    return env;
}
export function git(args, options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const inherit = options.inherit ?? false;
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            env: gitEnv(options.auth ?? null),
            stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        if (!inherit) {
            child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString('utf8');
                if (options.forward)
                    process.stdout.write(chunk);
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString('utf8');
                if (options.forward)
                    process.stderr.write(chunk);
            });
        }
        child.on('error', (error) => {
            reject(new CliError(`Cannot run git: ${error.message}. Is git installed and in PATH?`));
        });
        child.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });
}
function isAuthRejection(result) {
    const output = `${result.stdout} ${result.stderr}`.toLowerCase();
    return (output.includes('401') ||
        output.includes('403') ||
        output.includes('authentication failed') ||
        output.includes('access denied') ||
        output.includes('invalid username or password') ||
        output.includes('could not read username') ||
        output.includes('could not read password') ||
        output.includes('remote: invalid') ||
        output.includes('terminal prompts disabled'));
}
function failureMessage(args, result) {
    let message = `git ${args.join(' ')} failed with exit code ${result.code}.`;
    const output = `${result.stdout} ${result.stderr}`.toLowerCase();
    const isAuthError = output.includes('401') ||
        output.includes('authentication failed') ||
        output.includes('access denied') ||
        output.includes('invalid username or password') ||
        output.includes('could not read username') ||
        output.includes('remote: invalid') ||
        output.includes('http:');
    if (isAuthError && args[0] === 'push') {
        message +=
            ' Authentication failed (possible 401). ' +
                `Run \`${BIN} login\`, pass credentials in the URL (\`${BIN} push --url http://user:pass@host:port\`), or set ${ENV.password}.`;
    }
    return message;
}
export async function gitChecked(args, options = {}) {
    const inherit = options.inherit ?? true;
    const result = await git(args, { ...options, inherit });
    if (result.code !== 0) {
        throw new CliError(failureMessage(args, result));
    }
}
export async function gitCapture(args, cwd = process.cwd()) {
    const result = await git(args, { cwd });
    if (result.code !== 0) {
        throw new CliError(result.stderr.trim() || `git ${args.join(' ')} failed.`);
    }
    return result.stdout.trim();
}
export async function isGitRepo(cwd = process.cwd()) {
    const result = await git(['rev-parse', '--is-inside-work-tree'], { cwd });
    return result.code === 0 && result.stdout.trim() === 'true';
}
export async function requireGitRepo(cwd = process.cwd()) {
    if (!(await isGitRepo(cwd))) {
        throw new CliError(`Not a git repository: ${cwd}`);
    }
}
async function hasRemote(name = 'origin', cwd = process.cwd()) {
    const result = await git(['remote', 'get-url', name], { cwd });
    return result.code === 0;
}
async function hasUpstream(cwd = process.cwd()) {
    const result = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd });
    return result.code === 0;
}
export async function ensureIdentity(cwd, username) {
    const name = await git(['config', '--get', 'user.name'], { cwd });
    const email = await git(['config', '--get', 'user.email'], { cwd });
    if (name.stdout.trim() === '') {
        await gitChecked(['config', 'user.name', username], { cwd, inherit: false });
        info(`Set local git user.name to ${username}`);
    }
    if (email.stdout.trim() === '') {
        await gitChecked(['config', 'user.email', `${username}@${BIN}.local`], { cwd, inherit: false });
        info(`Set local git user.email to ${username}@${BIN}.local`);
    }
}
export async function promptPassword(config, question = 'Password: ') {
    if (!process.stdin.isTTY)
        return null;
    let username = config.username ?? config.urlCredentials?.username;
    if (!username) {
        username = (await ask('Username: ')).trim();
        if (username === '')
            return null;
    }
    const password = await askSecret(question);
    if (password === '')
        return null;
    rememberPassword(config.url, username, password);
    return { username, password };
}
async function runWithCredentials(args, config, cwd, options = {}) {
    let auth = gitAuth(config);
    if (!auth && !options.optionalAuth) {
        auth = await promptPassword(config, 'Password (needed for git): ');
        if (!auth) {
            throw new CliError(`No git credentials (username/password). Run \`${BIN} login\` to sign in, ` +
                `pass them in the URL (\`${BIN} push --url http://user:pass@host:port\`), ` +
                `or set ${ENV.password}.`);
        }
    }
    const run = (credentials) => git(args, { cwd, auth: credentials, forward: true });
    let result = await run(auth);
    if (result.code !== 0 && isAuthRejection(result)) {
        const prompted = await promptPassword(config, 'Credentials rejected. Password: ');
        if (prompted)
            result = await run(prompted);
    }
    if (result.code !== 0)
        throw new CliError(failureMessage(args, result));
}
export async function cloneRepo(repo, dir, config) {
    const target = path.resolve(dir);
    if (fs.existsSync(target)) {
        let entries;
        try {
            entries = fs.readdirSync(target);
        }
        catch (error) {
            throw new CliError(`Directory is not empty or is not a directory: ${target}`);
        }
        if (entries.length > 0) {
            throw new CliError(`Directory is not empty: ${target}`);
        }
    }
    if (repo.private && !gitAuth(config) && !process.stdin.isTTY) {
        throw new CliError('This repository is private and you have no credentials: not signed in. ' +
            `Run \`${BIN} login\`, pass credentials in the URL, or set ${ENV.password}.`);
    }
    await runWithCredentials(['clone', repo.cloneUrl, dir], config, process.cwd(), {
        optionalAuth: !repo.private,
    });
}
export async function initRepo(repo, dir, config) {
    const target = path.resolve(dir);
    if (fs.existsSync(target)) {
        try {
            if (fs.readdirSync(target).length > 0) {
                throw new CliError(`Directory is not empty: ${target}`);
            }
        }
        catch (error) {
            throw new CliError(`Directory is not empty or is not a directory: ${target}`);
        }
    }
    fs.mkdirSync(target, { recursive: true });
    await gitChecked(['init', '-b', 'main'], { cwd: target, inherit: false });
    await ensureIdentity(target, config.username ?? BIN);
    const readme = path.join(target, 'README.md');
    if (!fs.existsSync(readme)) {
        fs.writeFileSync(readme, `# ${repo.name}\n`, 'utf8');
    }
    await gitChecked(['add', '-A'], { cwd: target, inherit: false });
    await gitChecked(['commit', '-m', 'Initial commit'], { cwd: target });
    await gitChecked(['remote', 'add', 'origin', repo.cloneUrl], { cwd: target, inherit: false });
    await pushRepo(config, [], target);
}
export async function pushRepo(config, extra = [], cwd = process.cwd()) {
    await requireGitRepo(cwd);
    if (!(await hasRemote('origin', cwd))) {
        throw new CliError(`This repository has no 'origin' remote. Use \`${BIN} clone <owner/name>\` or add one with git.`);
    }
    const args = extra.length > 0
        ? ['push', ...extra]
        : (await hasUpstream(cwd))
            ? ['push']
            : ['push', '-u', 'origin', 'HEAD'];
    await runWithCredentials(args, config, cwd);
}
export async function pullRepo(config, extra = [], cwd = process.cwd()) {
    await requireGitRepo(cwd);
    if (!(await hasRemote('origin', cwd))) {
        throw new CliError(`This repository has no 'origin' remote. Use \`${BIN} clone <owner/name>\` or add one with git.`);
    }
    await runWithCredentials(['pull', ...extra], config, cwd);
}
//# sourceMappingURL=index.js.map