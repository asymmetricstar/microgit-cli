import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ENV, gitAuth } from '../config/index.js';
import { CliError } from '../error/index.js';
import { BIN } from '../config/settings.js';
import { info } from '../ui/index.js';
/**
 * Git talks HTTP Basic, not the API's Bearer token. Pass the credentials as an
 * `http.extraHeader` through the environment: unlike a URL or a remote entry it
 * is not written to `.git/config`, and unlike `-c` it is not in the process
 * arguments on most systems.
 */
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
/** Run git, optionally with Basic auth and with inherited stdout/stderr. */
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
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString('utf8');
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
/** Run a git command and fail the CLI if it exits non-zero. */
export async function gitChecked(args, options = {}) {
    const inherit = options.inherit ?? true;
    const result = await git(args, { ...options, inherit });
    if (result.code !== 0) {
        throw new CliError(`git ${args.join(' ')} failed with exit code ${result.code}.`);
    }
}
/** Run a git command and return its trimmed stdout. */
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
/** Give a new repository a local identity when git has none configured. */
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
/** Clone a repository, using saved credentials when there are any. */
export async function cloneRepo(repo, dir, config) {
    const target = path.resolve(dir);
    if (fs.existsSync(target)) {
        const entries = fs.readdirSync(target);
        if (entries.length > 0) {
            throw new CliError(`Directory is not empty: ${target}`);
        }
    }
    const auth = gitAuth(config);
    if (repo.private && !auth && !process.stdin.isTTY) {
        throw new CliError('This repository is private and no password is saved. ' +
            `Run \`${BIN} login --save-password\` or set ${ENV.password}.`);
    }
    await gitChecked(['clone', repo.cloneUrl, dir], { auth });
}
/** Create a local repository with a first commit and push it to the server. */
export async function initRepo(repo, dir, config) {
    const target = path.resolve(dir);
    if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
        throw new CliError(`Directory is not empty: ${target}`);
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
/** Push the current branch, setting an upstream on the first push. */
export async function pushRepo(config, extra = [], cwd = process.cwd()) {
    await requireGitRepo(cwd);
    if (!(await hasRemote('origin', cwd))) {
        throw new CliError(`This repository has no 'origin' remote. Use \`${BIN} clone <owner/name>\` or add one with git.`);
    }
    const auth = gitAuth(config);
    if (!auth && !process.stdin.isTTY) {
        throw new CliError(`No saved git password. Run \`${BIN} login --save-password\` or set ${ENV.password}.`);
    }
    const args = extra.length > 0
        ? ['push', ...extra]
        : (await hasUpstream(cwd))
            ? ['push']
            : ['push', '-u', 'origin', 'HEAD'];
    await gitChecked(args, { cwd, auth });
}
/** Pull from origin, using saved credentials when there are any. */
export async function pullRepo(config, extra = [], cwd = process.cwd()) {
    await requireGitRepo(cwd);
    if (!(await hasRemote('origin', cwd))) {
        throw new CliError(`This repository has no 'origin' remote. Use \`${BIN} clone <owner/name>\` or add one with git.`);
    }
    await gitChecked(['pull', ...extra], { cwd, auth: gitAuth(config) });
}
//# sourceMappingURL=index.js.map