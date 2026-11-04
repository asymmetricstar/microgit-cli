import { CliError } from '../error/index.js';
import { printHelp, printVersion } from '../help/index.js';
import { dispatch } from '../commands/registry.js';
import { startShell } from './repl.js';
/** Only start the shell when a person is actually looking at the terminal. */
export function isInteractive() {
    return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}
export async function main(argv) {
    const [command, ...rest] = argv;
    if (command === undefined) {
        // Bare `microgit` opens the shell; piped runs still get the help output.
        if (isInteractive())
            return startShell();
        printHelp();
        return;
    }
    if (command === 'help' || command === '--help' || command === '-h' || command === '?') {
        return printHelp();
    }
    if (command === '--version' || command === '-v' || command === 'version') {
        return printVersion();
    }
    if (command === 'shell' || command === 'repl') {
        return startShell();
    }
    if (command === '--') {
        throw new CliError('Expected a command after `--`. Type `help` to list the commands.');
    }
    await dispatch([command, ...rest]);
}
//# sourceMappingURL=index.js.map