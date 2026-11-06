import { CliError } from '../error/index.js';
import { info, fail } from '../ui/index.js';
export async function cdCommand(argv) {
    const targetPath = argv.join(' ');
    if (!targetPath) {
        fail('Directory path is required. Usage: change <repo_directory>');
    }
    try {
        if (targetPath.trim() === '') {
            throw new CliError('Invalid directory path provided.');
        }
        process.chdir(targetPath);
        info(`Successfully changed directory to: ${process.cwd()}`);
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
            fail(`Error changing directory: ${err.message}`);
        }
    }
}
//# sourceMappingURL=cd.js.map