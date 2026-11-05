import { loginCommand, logoutCommand, registerCommand, whoamiCommand } from './auth.js';
import { configCommand } from './config.js';
import { addCommand } from './add.js';
import { commitCommand, initCommand, pullCommand, pushCommand, statusCommand } from './git.js';
import { diffCommand } from './diff.js';
import { cloneCommand, deleteCommand, listCommand, newCommand } from './repos.js';
import { cdCommand } from './cd.js';
import { mkdirCommand } from './mkdir.js';
import { lsdirCommand } from './lsdir.js';
import { rmCommand } from './rm.js';
import { CliError } from '../error/index.js';
/**
 * One table drives the entry point, `help` and the shell's tab completion, so a
 * new command only has to be added here.
 */
export const COMMANDS = [
    {
        name: "change",
        aliases: ["cd", "chdir"],
        group: "System",
        summary: "Change the current working directory within the CLI session",
        flags: [],
        dirCompletes: true,
        run: cdCommand,
    },
    {
        name: "mkdir",
        group: "System",
        summary: "Create a new directory",
        flags: [],
        run: mkdirCommand,
    },
    {
        name: "lsdir",
        aliases: ["ls"],
        group: "System",
        summary: "List the contents of a directory",
        flags: [],
        run: lsdirCommand,
    },
    {
        name: "rm",
        aliases: ["delete", "del"],
        group: "System",
        summary: "Remove a file or directory",
        flags: [],
        dirCompletes: true,
        run: rmCommand,
    },
    {
        name: "login",
        group: "Account",
        summary: "Sign in and store the API session",
        flags: [
            "--url",
            "--username",
            "--password",
            "--save-password",
            "--forget-password",
            "--json",
            "--help",
        ],
        run: loginCommand,
    },
    {
        name: "register",
        group: "Account",
        summary: "Create an account and sign in",
        flags: [
            "--url",
            "--username",
            "--password",
            "--save-password",
            "--forget-password",
            "--json",
            "--help",
        ],
        run: registerCommand,
    },
    {
        name: "logout",
        group: "Account",
        summary: "Revoke the session and clear local credentials",
        flags: ["--url", "--json", "--help"],
        run: logoutCommand,
    },
    {
        name: "whoami",
        aliases: ["me"],
        group: "Account",
        summary: "Show the signed-in account",
        flags: ["--url", "--json", "--help"],
        run: whoamiCommand,
    },
    {
        name: "new",
        aliases: ["create"],
        group: "Repositories",
        summary: "Create a repository (--private, --clone, --init)",
        flags: [
            "--url",
            "--private",
            "--public",
            "--clone",
            "--init",
            "--dir",
            "--json",
            "--help",
        ],
        run: newCommand,
    },
    {
        name: "list",
        aliases: ["ls"],
        group: "Repositories",
        summary: "List repositories (--owner, --public, --private)",
        flags: [
            "--url",
            "--owner",
            "--name",
            "--private",
            "--public",
            "--page",
            "--limit",
            "--json",
            "--help",
        ],
        run: listCommand,
    },
    {
        name: "delete",
        aliases: ["rm"],
        group: "Repositories",
        summary: "Delete a repository (owner/name for another account)",
        flags: ["--url", "--yes", "--json", "--help"],
        run: deleteCommand,
    },
    {
        name: "clone",
        group: "Repositories",
        summary: "Clone a repository and use the server’s clone URL",
        flags: ["--url", "--dir", "--json", "--help"],
        run: cloneCommand,
    },
    {
        name: "init",
        group: "Git",
        summary: "Start a local repository: folder, .git and an empty README",
        flags: ["--dir", "--help"],
        run: initCommand,
    },
    {
        name: "status",
        group: "Git",
        summary: "Short git status of the current repository",
        flags: ["--help"],
        run: statusCommand,
    },
    {
        name: "add",
        group: "Git",
        summary: "Stage files for commit (no args → all untracked, else the given paths)",
        flags: ["--help"],
        run: addCommand,
    },
    {
        name: "diff",
        group: "Git",
        summary: "Show changes in the current repository (--stat, --staged, --quiet)",
        flags: ["--stat", "--staged", "--quiet", "--no-renames", "--help"],
        run: diffCommand,
    },
    {
        name: "commit",
        group: "Git",
        summary: "Stage everything, commit and push",
        flags: [
            "--url",
            "--message",
            "--no-add",
            "--no-push",
            "--allow-empty",
            "--help",
        ],
        run: commitCommand,
    },
    {
        name: "push",
        group: "Git",
        summary: "Push with the saved credentials",
        flags: ["--help"],
        run: pushCommand,
    },
    {
        name: "pull",
        group: "Git",
        summary: "Pull with the saved credentials",
        flags: ["--help"],
        run: pullCommand,
    },
    {
        name: "config",
        group: "Config",
        summary: "Show or edit the config file and session",
        flags: ["--json", "--help"],
        run: configCommand,
    },
];
export const GROUPS = ['Account', 'Repositories', 'Git', 'Config', 'System'];
/** Commands the interactive shell handles itself. */
export const SHELL_BUILTINS = ['clear', 'exit', 'help'];
/** Look a command up by name or alias, case-insensitively. */
export function findCommand(name) {
    const needle = name.trim().toLowerCase();
    if (needle === '')
        return undefined;
    return COMMANDS.find((command) => command.name === needle || command.aliases?.includes(needle) === true);
}
/** Every accepted command word, sorted, for completion. */
export function commandNames() {
    const names = COMMANDS.flatMap((command) => [command.name, ...(command.aliases ?? [])]);
    return [...new Set(names)].sort();
}
/** Run one command line; unknown names fail like the one-shot CLI does. */
export async function dispatch(argv) {
    const [name, ...rest] = argv;
    const command = name === undefined ? undefined : findCommand(name);
    if (command === undefined) {
        const label = name === undefined ? '' : ` '${name}'`;
        throw new CliError(`Unknown command${label}. Type \`help\` to list the commands.`);
    }
    await command.run(rest);
}
//# sourceMappingURL=registry.js.map