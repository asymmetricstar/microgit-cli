import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../error/index.js';
import { BIN } from '../config/settings.js';
import { fail, ok } from '../ui/index.js';
export async function mkdirCommand(argv) {
    const dirPath = argv.join(' ');
    if (!dirPath) {
        fail(`Directory path is required. Usage: ${BIN} mkdir <path>`);
    }
    try {
        if (dirPath.trim() === '') {
            throw new CliError('Invalid directory path provided.');
        }
        const resolvedPath = path.resolve(dirPath);
        fs.mkdirSync(resolvedPath, { recursive: true });
        ok(`Created directory: ${resolvedPath}`);
    }
    catch (error) {
        const err = error;
        if (err.code === 'EACCES') {
            fail(`Error: Permission denied to create directory at '${dirPath}'`);
        }
        else if (err.code === 'ENOTDIR') {
            fail(`Error: A parent of the specified path is not a directory: '${dirPath}'`);
        }
        else {
            fail(`Error creating directory: ${err.message}`);
        }
    }
}
//# sourceMappingURL=mkdir.js.map