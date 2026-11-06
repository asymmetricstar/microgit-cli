import fs from 'node:fs';
import path from 'node:path';
import { info, fail } from '../ui/index.js';
export async function lsdirCommand(argv) {
    const targetPath = argv.length > 0 ? argv.join(' ') : '.';
    try {
        if (targetPath.trim() === '') {
            throw new Error('Invalid path provided.');
        }
        const resolvedPath = path.resolve(targetPath);
        const dirName = path.basename(resolvedPath);
        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
        if (entries.length === 0) {
            info(`No entries found in '${dirName}' folder.`);
            return;
        }
        info(`Contents of '${dirName}' folder:`);
        entries.forEach((entry) => {
            const isDir = entry.isDirectory();
            const prefix = isDir ? '📁 ' : '📄 ';
            console.log(`${prefix}${entry.name}${isDir ? '/' : ''}`);
        });
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOENT') {
            fail(`Error: Directory not found at '${targetPath}'`);
        }
        else if (err.code === 'EACCES') {
            fail(`Error: Permission denied to access '${targetPath}'`);
        }
        else {
            fail(`Error listing directory: ${err.message}`);
        }
    }
}
//# sourceMappingURL=lsdir.js.map