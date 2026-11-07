import { parseArgs } from 'node:util';
import { apiClientFor } from '../api/index.js';
import { loadConfig, requireAuth } from '../config/index.js';
import { BIN } from '../config/settings.js';
import { ask, fail, info, ok, printJson, table } from '../ui/index.js';
import { parseTarget, text, trimmed } from '../util/index.js';
const ACCESS_OPTIONS = {
    url: { type: 'string' },
    role: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
};
function printHelp() {
    console.log(`Usage: ${BIN} access [list|grant|revoke] <repo> [username] [options]

Manage who may open a repository. Only the owner (or an administrator) can
grant or revoke access. A member's role is cumulative: 'read' opens the pages
and allows cloning and fetching; 'write' does all of that AND allows pushing.
So granting 'write' never takes read away.

Run with no arguments to open the interactive menu: it asks for the repository
first, then offers list / grant / revoke.

Subcommands:
  list <repo>                 List the members of a repository
  grant <repo> <username>     Grant access (--role read|write, default read)
  revoke <repo> <username>    Revoke access

Repository is <name>, <owner/name>, or an owner/name URL.

Options:
  --role <read|write|all>   Role to grant (default: read). 'write' and 'all'
                            both grant read + push; the roles are cumulative.
  --json                Print the raw API response
  --url <url>           Server URL
  -h, --help            Show this help

Examples:
  ${BIN} access
  ${BIN} access levent/my-private-repo
  ${BIN} access grant levent/my-private-repo ayse
  ${BIN} access grant levent/my-private-repo ayse --role write
  ${BIN} access revoke levent/my-private-repo ayse`);
}
function roleFrom(value) {
    const raw = trimmed(value)?.toLowerCase();
    if (raw === undefined)
        return 'read';
    if (raw === 'read')
        return 'read';
    if (raw === 'write' || raw === 'all')
        return 'write';
    fail(`Role must be 'read', 'write' or 'all', got '${raw}'.`);
}
async function listMembers(ctx) {
    const result = await ctx.api.listMembers(ctx.owner, ctx.name);
    if (ctx.json) {
        printJson(result);
        return;
    }
    if (result.members.length === 0) {
        info(`No members on ${ctx.owner}/${ctx.name}.`);
        return;
    }
    const rows = result.members.map((member) => [member.username, member.role, member.addedAt]);
    console.log(table(['USERNAME', 'ROLE', 'ADDED'], rows));
    info(`${result.total} ${result.total === 1 ? 'member' : 'members'} on ${ctx.owner}/${ctx.name}.`);
}
async function grantMember(ctx, username, role) {
    const result = await ctx.api.addMember(ctx.owner, ctx.name, username, role);
    if (ctx.json) {
        printJson(result);
        return;
    }
    if (result.created)
        ok(`Granted ${result.role} access to ${result.username} on ${ctx.owner}/${ctx.name}.`);
    else
        ok(`Updated ${result.username} to ${result.role} on ${ctx.owner}/${ctx.name}.`);
}
async function revokeMember(ctx, username) {
    const result = await ctx.api.removeMember(ctx.owner, ctx.name, username);
    if (ctx.json) {
        printJson(result);
        return;
    }
    ok(`Revoked access for ${result.username} on ${ctx.owner}/${ctx.name}.`);
}
export async function accessCommand(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: ACCESS_OPTIONS,
    });
    if (values.help)
        return printHelp();
    const config = loadConfig(text(values.url));
    requireAuth(config);
    const api = await apiClientFor({
        url: config.url,
        token: config.token,
        credentials: config.urlCredentials,
    });
    const first = positionals[0]?.toLowerCase();
    const hasVerb = first === 'list' || first === 'grant' || first === 'revoke';
    if (hasVerb) {
        const action = first;
        const repoArg = trimmed(positionals[1]);
        if (!repoArg)
            fail(`Repository is required. Usage: access ${action} <repo> [username]`);
        const parsed = parseTarget(repoArg);
        const owner = parsed.owner ?? config.username;
        if (!owner)
            fail('No owner given and no username stored. Use <owner/name> or log in first.');
        const name = parsed.name;
        const ctx = { api, owner, name, json: Boolean(values.json) };
        if (action === 'list')
            return listMembers(ctx);
        if (action === 'grant') {
            const username = trimmed(positionals[2]);
            if (!username)
                fail('Username is required. Usage: access grant <repo> <username> [--role read|write]');
            return grantMember(ctx, username, roleFrom(values.role));
        }
        const username = trimmed(positionals[2]);
        if (!username)
            fail('Username is required. Usage: access revoke <repo> <username>');
        return revokeMember(ctx, username);
    }
    const repoArg = trimmed(positionals[0]);
    if (repoArg) {
        const parsed = parseTarget(repoArg);
        const owner = parsed.owner ?? config.username;
        if (!owner)
            fail('No owner given and no username stored. Use <owner/name> or log in first.');
        const name = parsed.name;
        const ctx = { api, owner, name, json: Boolean(values.json) };
        return listMembers(ctx);
    }
    const repoInput = await ask('Repository (owner/name): ');
    if (repoInput === '') {
        info('Cancelled.');
        return;
    }
    const parsed = parseTarget(repoInput.trim());
    const owner = parsed.owner ?? config.username;
    if (!owner)
        fail('No owner given and no username stored. Use <owner/name> or log in first.');
    const name = parsed.name;
    const ctx = { api, owner, name, json: Boolean(values.json) };
    while (true) {
        console.log('');
        console.log('  [1] List members');
        console.log('  [2] Grant access');
        console.log('  [3] Revoke access');
        console.log('  [4] Exit');
        console.log('');
        const choice = await ask('Select an option [1-4]: ');
        if (choice === '1') {
            await listMembers(ctx);
        }
        else if (choice === '2') {
            const username = await ask('Username: ');
            if (username === '') {
                info('Cancelled.');
                continue;
            }
            console.log('');
            console.log('  [1] read   - open pages, clone, fetch');
            console.log('  [2] write  - read + push  (full access)');
            console.log('  [3] all    - alias for write');
            console.log('');
            const roleChoice = await ask('Select role [1-3] (1): ');
            const role = roleChoice === '2' || roleChoice === '3' ? 'write' : 'read';
            await grantMember(ctx, username.trim(), role);
        }
        else if (choice === '3') {
            const username = await ask('Username: ');
            if (username === '') {
                info('Cancelled.');
                continue;
            }
            await revokeMember(ctx, username.trim());
        }
        else if (choice === '4' || choice === '') {
            break;
        }
        else {
            console.log('Invalid option. Please select 1-4.');
        }
    }
}
//# sourceMappingURL=access.js.map