#!/usr/bin/env node
import { main } from './cli/index.js';
import { CliError, errorMessage } from './error/index.js';
import { red } from './ui/index.js';
main(process.argv.slice(2)).catch((error) => {
    console.error(`${red('✗')} ${errorMessage(error)}`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
});
process.on('unhandledRejection', (reason) => {
    console.error(`${red('✗')} Unhandled promise rejection: ${errorMessage(reason)}`);
    process.exitCode = 1;
});
process.on('uncaughtException', (error) => {
    console.error(`${red('✗')} Uncaught exception: ${errorMessage(error)}`);
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map