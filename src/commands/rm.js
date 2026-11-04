import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../error/index.js';
import { info, fail } from '../ui/index.js';
/**
 * Removes a file or directory.
 */
export async function rmCommand(argv) {
    const targetPath = argv.join(' ');
    if (!targetPath) {
        fail('Path is required. Usage: rm <path>');
        return;
    }
    try {
        if (targetPath.trim() === '') {
            throw new CliError('Invalid path provided.');
        }
        const resolvedPath = path.resolve(targetPath);
        // Check if exists
        if (!fs.existsSync(resolvedPath)) {
            fail(`Error: Path not found at '${targetPath}'`);
            return;
        }
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
            // Remove directory recursively
            fs.rmSync(resolvedPath, { recursive: true, force: true });
            info(`Successfully removed directory: ${resolvedPath}`);
        }
        else {
            // Remove file
            fs.rmSync(resolvedPath, { force: true });
            info(`Successfully removed file: ${resolvedPath}`);
        }
    }
    catch (error) {
        const err = error;
        if (err.code === 'EACCES') {
            fail(`Error: Permission denied to access '${targetPath}'`);
        }
        else if (err.code === 'ENOTDIR') {
            fail(`Error: Path is not a directory: '${targetPath}'`);
        }
        else {
            fail(`Error removing path: ${err.message}`);
        }
    }
}
//# sourceMappingURL=rm.js.map