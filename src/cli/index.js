import { CliError } from '../error/index.js';
import fs from 'node:fs';
import { printHelp, printVersion } from '../help/index.js';
import { dispatch } from '../commands/registry.js';
import { startShell } from './repl.js';
import { configFilePath, normalizeUrl, readStoredConfig, writeStoredConfig } from '../config/index.js';
export function isInteractive() {
    return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}
export async function main(argv) {
    const [command, ...rest] = argv;
    if (command === undefined) {
        if (isInteractive()) {
            const stored = readStoredConfig();
            const fileExists = (() => {
                try {
                    fs.accessSync(configFilePath());
                    return true;
                }
                catch {
                    return false;
                }
            })();
            if (!fileExists) {
                const readline = await import('node:readline');
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                const answer = await new Promise((resolve) => {
                    rl.question('Server URL (e.g. http://127.0.0.1:80): ', (a) => resolve(a.trim()));
                });
                rl.close();
                const url = normalizeUrl(answer || 'http://127.0.0.1:3000');
                writeStoredConfig({ ...stored, url });
                console.log(`Saved server URL: ${url}`);
                console.log('');
            }
            return startShell();
        }
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