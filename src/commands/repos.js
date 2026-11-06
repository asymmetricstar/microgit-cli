import { parseArgs } from 'node:util';
import { apiClientFor } from '../api/index.js';
import { loadConfig, requireAuth } from '../config/index.js';
import { cloneRepo, initRepo } from '../git/index.js';
import { BIN } from '../config/settings.js';
import { ask, confirm, cyan, dim, fail, faint, info, ok, printJson, table } from '../ui/index.js';
import { parseTarget, positiveInt, text, trimmed } from '../util/index.js';
async function askVisibility() {
    const answer = (await ask(`Visibility ${dim('[public/private]')} ${faint('(public)')}: `))
        .toLowerCase()
        .trim();
    if (answer === '')
        return false;
    if (answer === 'private' || answer === 'priv' || answer === 'p')
        return true;
    if (answer === 'public' || answer === 'pub')
        return false;
    fail(`Unknown visibility '${answer}'. Use public or private.`);
}
export async function listCommand(argv) {
    const { values } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            url: { type: 'string' },
            owner: { type: 'string' },
            name: { type: 'string' },
            private: { type: 'boolean' },
            public: { type: 'boolean' },
            page: { type: 'string' },
            limit: { type: 'string' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} list [options]

Options:
  --owner <name>     Only repositories owned by this account
  --name <name>      Filter by repository name
  --private          Only private repositories
  --public           Only public repositories
  --page <n>         Page number (default 1)
  --limit <n>        Page size (default 50, max 200)
  --json             Print the raw API response
  --url <url>        Server URL
  -h, --help         Show this help`);
        return;
    }
    if (values.private && values.public)
        fail('Use either --private or --public, not both.');
    const visibility = values.private ? true : values.public ? false : null;
    const config = loadConfig(text(values.url));
    const api = await apiClientFor({
        url: config.url,
        token: config.token,
        credentials: config.urlCredentials,
    });
    const result = await api.listRepos({
        owner: trimmed(values.owner),
        name: trimmed(values.name),
        private: visibility,
        page: positiveInt(values.page, '--page', 1),
        limit: positiveInt(values.limit, '--limit', 50),
    });
    if (values.json) {
        printJson(result);
        return;
    }
    if (result.repositories.length === 0) {
        info('No repositories found.');
        return;
    }
    const rows = result.repositories.map((repo) => [
        `${repo.owner}/${repo.name}`,
        repo.private ? 'private' : 'public',
        repo.cloneUrl,
    ]);
    console.log(table(['REPOSITORY', 'VISIBILITY', 'CLONE URL'], rows));
    info(`${result.total} ${result.total === 1 ? 'repository' : 'repositories'} · ` +
        `page ${result.page}/${Math.max(result.pages, 1)}`);
}
export async function newCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            url: { type: 'string' },
            private: { type: 'boolean' },
            public: { type: 'boolean' },
            clone: { type: 'boolean' },
            init: { type: 'boolean' },
            dir: { type: 'string' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} new <name> [options]

Create a repository for the signed-in account. Without --private or --public
the CLI asks for the visibility (Enter creates a public repository).

Options:
  --private          Create it private
  --public           Create it public
  --clone            Clone it into ./<name> (or --dir) afterwards
  --init             Create ./<name>, make a README, first commit and push
  --dir <path>       Directory for --clone/--init (default: repository name)
  --json             Print the API response as JSON
  --url <url>        Server URL
  -h, --help         Show this help

Examples:
  ${BIN} new app
  ${BIN} new secret --private
  ${BIN} new app --init`);
        return;
    }
    const name = trimmed(positionals[0]);
    if (!name)
        fail(`Repository name is required. Usage: ${BIN} new <name>`);
    if (values.clone && values.init)
        fail('Use either --clone or --init, not both.');
    if (values.private && values.public)
        fail('Use either --private or --public, not both.');
    if (values.json && (values.clone || values.init)) {
        fail('--json cannot be combined with --clone or --init.');
    }
    let isPrivate;
    if (values.private)
        isPrivate = true;
    else if (values.public)
        isPrivate = false;
    else if (values.json || !process.stdin.isTTY)
        isPrivate = false;
    else
        isPrivate = await askVisibility();
    const config = loadConfig(text(values.url));
    requireAuth(config);
    const api = await apiClientFor({
        url: config.url,
        token: config.token,
        credentials: config.urlCredentials,
    });
    const repo = await api.newRepo(name, isPrivate);
    if (values.json) {
        printJson({ ...repo, url: config.url });
        return;
    }
    if (repo.created)
        ok(`Created ${repo.owner}/${repo.name}${repo.private ? ' (private)' : ''}`);
    else
        info(`Already exists: ${repo.owner}/${repo.name}`);
    info(`Clone URL: ${repo.cloneUrl}`);
    const dir = trimmed(values.dir) ?? repo.name;
    if (values.clone) {
        await cloneRepo(repo, dir, config);
        ok(`Cloned into ${dir}`);
        info(`cd ${dir}`);
        return;
    }
    if (values.init) {
        await initRepo(repo, dir, config);
        ok(`Created ${dir}, made the first commit and pushed it`);
        info(`cd ${dir}`);
        return;
    }
    info(`Next: ${cyan(`${BIN} clone ${repo.owner}/${repo.name}`)}`);
}
export async function deleteCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            url: { type: 'string' },
            yes: { type: 'boolean', short: 'y' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} delete <name|owner/name> [options]

Options:
  -y, --yes         Do not ask for confirmation
  --json            Print the API response as JSON
  --url <url>       Server URL
  -h, --help        Show this help`);
        return;
    }
    const target = trimmed(positionals[0]);
    if (!target)
        fail(`Repository name is required. Usage: ${BIN} delete <name|owner/name>`);
    const parsed = parseTarget(target);
    const config = loadConfig(text(values.url));
    requireAuth(config);
    const owner = parsed.owner ?? config.username;
    if (!owner)
        fail('No owner given and no username stored. Use <owner/name> or log in first.');
    if (!values.yes) {
        const approved = await confirm(`Delete ${owner}/${parsed.name}? This cannot be undone.`, false);
        if (!approved) {
            info('Cancelled.');
            return;
        }
    }
    const api = await apiClientFor({
        url: config.url,
        token: config.token,
        credentials: config.urlCredentials,
    });
    const result = await api.deleteRepo(owner, parsed.name);
    if (values.json) {
        printJson(result);
        return;
    }
    ok(`Deleted ${result.owner}/${result.name}`);
}
export async function cloneCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            url: { type: 'string' },
            dir: { type: 'string' },
            json: { type: 'boolean' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Usage: ${BIN} clone <name|owner/name|url> [directory] [options]

Clone a repository using the URL returned by the server.

Options:
  --dir <path>      Target directory (default: repository name)
  --json            Print repository details as JSON after cloning
  --url <url>       Server URL
  -h, --help        Show this help

Examples:
  ${BIN} clone app
  ${BIN} clone alice/app ./checkout
  ${BIN} clone http://127.0.0.1/alice/app.git ./checkout`);
        return;
    }
    const target = trimmed(positionals[0]);
    if (!target)
        fail(`Repository is required. Usage: ${BIN} clone <name|owner/name|url>`);
    const parsed = parseTarget(target);
    const config = loadConfig(text(values.url));
    let repo;
    const api = await apiClientFor({
        url: config.url,
        token: config.token,
        credentials: config.urlCredentials,
    });
    if (parsed.cloneUrl) {
        const owner = parsed.owner;
        const name = parsed.name;
        if (!owner)
            fail('No owner given in URL. Use http://<ip>/<user>/<repo>.git or <owner/name>.');
        repo = await api.repo(owner, name);
    }
    else {
        const owner = parsed.owner ?? config.username;
        if (!owner)
            fail('No owner given and no username stored. Use <owner/name> or log in first.');
        repo = await api.repo(owner, parsed.name);
    }
    const dir = trimmed(values.dir) ?? trimmed(positionals[1]) ?? repo.name;
    await cloneRepo(repo, dir, config);
    if (values.json) {
        printJson({ ...repo, directory: dir });
        return;
    }
    ok(`Cloned ${repo.owner}/${repo.name} into ${dir}`);
    info(`cd ${dir}`);
}
//# sourceMappingURL=repos.js.map