#!/usr/bin/env node
import { main } from './cli/index.js';
import { CliError, errorMessage } from './error/index.js';
import { red } from './ui/index.js';
main(process.argv.slice(2)).catch((error) => {
    console.error(`${red('✗')} ${errorMessage(error)}`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
});
// Async work that rejects without being awaited must never kill the CLI with a
// raw Node stack. Turn it into a clean message and mark a failure exit code.
process.on('unhandledRejection', (reason) => {
    console.error(`${red('✗')} Unhandled promise rejection: ${errorMessage(reason)}`);
    process.exitCode = 1;
});
// Last-resort guard: a synchronous throw outside main() is reported cleanly.
process.on('uncaughtException', (error) => {
    console.error(`${red('✗')} Uncaught exception: ${errorMessage(error)}`);
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map