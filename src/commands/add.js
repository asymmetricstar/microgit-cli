/**
 * `add`: stage files for a future commit.
 *   - No arguments → stage every untracked file in the repo (`git add .`).
 *   - Arguments    → stage only the given paths, comma-separated
 *     (`git add <file1>,<file2>,<file3>...`).
 */
import { gitChecked, requireGitRepo } from '../git/index.js';
import { info } from '../ui/index.js';
export async function addCommand(argv) {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(helpText());
        return;
    }
    const raw = argv.filter((a) => a !== '--help' && a !== '-h');
    const paths = raw
        .flatMap((a) => a.split(',').map((p) => p.trim()).filter(Boolean));
    if (paths.length === 0)
        paths.push('.');
    await requireGitRepo();
    await gitChecked(['add', ...paths]);
    info(`Staged ${paths.length} dosya (add).`);
}
function helpText() {
    return `
Usage: microgit add [paths]

Stage files so they can be committed.

  (no args)      → stage every untracked file in the repository (git add .)
  a.txt,b.txt    → stage only the given files/folders (comma-separated)

Examples:
  microgit add
  microgit add a.txt,b.txt
  microgit add src/`;
}
//# sourceMappingURL=add.js.map