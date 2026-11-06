import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config/index.js';
import { ensureIdentity, git, gitChecked, pullRepo, pushRepo, requireGitRepo } from '../git/index.js';
import { BIN } from '../config/settings.js';
import { ask, fail, info, ok } from '../ui/index.js';
import { text, trimmed } from '../util/index.js';
export async function initCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            dir: { type: 'string' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} init [directory] [options]

Create a project folder, run 'git init' in it and add an empty README.md.
Nothing is committed or pushed, and no server repository is created.

Options:
  --dir <path>   Directory to use (default: the given name, else this folder)
  -h, --help     Show this help

Examples:
  ${BIN} init app
  ${BIN} init                  # initialise the current folder
  ${BIN} init --dir ./projects/app`);
        return;
    }
    const name = trimmed(positionals[0]);
    const target = path.resolve(trimmed(values.dir) ?? name ?? '.');
    const label = path.basename(target) === '' ? target : path.basename(target);
    if (fs.existsSync(path.join(target, '.git'))) {
        fail(`Already a git repository: ${target}`);
    }
    fs.mkdirSync(target, { recursive: true });
    await gitChecked(['init', '-b', 'main'], { cwd: target, inherit: false });
    let username;
    try {
        username = loadConfig().username;
    }
    catch {
        username = undefined;
    }
    if (username)
        await ensureIdentity(target, username);
    const readme = path.join(target, 'README.md');
    if (!fs.existsSync(readme))
        fs.writeFileSync(readme, '', 'utf8');
    ok(`Initialised ${label} with git and an empty README.md`);
    info(`Next: cd ${label} · ${BIN} status`);
}
export async function statusCommand(argv) {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(`Usage: ${BIN} status`);
        return;
    }
    await requireGitRepo();
    await gitChecked(['status', '--short', '--branch']);
}
export async function commitCommand(argv) {
    const { values } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            message: { type: 'string', short: 'm' },
            'no-add': { type: 'boolean' },
            'no-push': { type: 'boolean' },
            'allow-empty': { type: 'boolean' },
            url: { type: 'string' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} commit -m "message" [options]

Stage every change, commit it and push the current branch.

Options:
  -m, --message <text>  Commit message (asked interactively when omitted)
  --no-add              Do not run 'git add -A' first
  --no-push             Commit only, do not push
  --allow-empty         Allow a commit without staged changes
  --url <url>           Server URL (for credentials)
  -h, --help            Show this help

Example:
  ${BIN} commit -m "Add login page"
  ${BIN} commit -m "WIP" --no-push`);
        return;
    }
    await requireGitRepo();
    const cwd = process.cwd();
    let message = text(values.message)?.trim();
    if (!message) {
        if (!process.stdin.isTTY)
            fail('Commit message is required. Use -m "message".');
        message = await ask('Commit message: ');
    }
    if (!message)
        fail('Commit message cannot be empty.');
    const config = loadConfig(text(values.url));
    if (!values['no-add']) {
        await gitChecked(['add', '-A'], { cwd, inherit: false });
    }
    const diff = await git(['diff', '--cached', '--quiet'], { cwd });
    if (diff.code > 1) {
        fail(diff.stderr.trim() || 'Could not inspect the staged changes.');
    }
    let committed = false;
    if (diff.code === 0 && !values['allow-empty']) {
        info('Nothing to commit.');
    }
    else {
        const commitArgs = ['commit', '-m', message];
        if (values['allow-empty'])
            commitArgs.push('--allow-empty');
        await gitChecked(commitArgs, { cwd });
        committed = true;
    }
    if (values['no-push']) {
        if (committed)
            ok('Committed.');
        return;
    }
    await pushRepo(config, [], cwd);
    if (committed)
        ok('Committed and pushed.');
    else
        ok('Pushed.');
}
function extractUrl(argv) {
    const rest = [];
    let url;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--url') {
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('-')) {
                url = next;
                i += 1;
            }
        }
        else if (arg.startsWith('--url=')) {
            url = arg.slice('--url='.length);
        }
        else {
            rest.push(arg);
        }
    }
    return { url, rest };
}
export async function pushCommand(argv) {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(`Usage: ${BIN} push [git push arguments] [--url <url>]

Push the current branch with the saved credentials. Extra arguments are passed
to git, for example: ${BIN} push --force-with-lease

Options:
  --url <url>   Server URL, credentials allowed: http://user:pass@host:port
  -h, --help    Show this help`);
        return;
    }
    const { url, rest } = extractUrl(argv);
    const config = loadConfig(url);
    await pushRepo(config, rest);
    ok('Pushed.');
}
export async function pullCommand(argv) {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(`Usage: ${BIN} pull [git pull arguments] [--url <url>]

Pull from origin with the saved credentials. Extra arguments are passed to git.

Options:
  --url <url>   Server URL, credentials allowed: http://user:pass@host:port
  -h, --help    Show this help`);
        return;
    }
    const { url, rest } = extractUrl(argv);
    const config = loadConfig(url);
    await pullRepo(config, rest);
    ok('Pulled.');
}
//# sourceMappingURL=git.js.map