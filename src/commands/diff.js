import { requireGitRepo, git } from '../git/index.js';
import { BIN } from '../config/settings.js';
import { fail, info } from '../ui/index.js';
import { green, red } from '../theme/palette.js';
export async function diffCommand(argv) {
    const quiet = argv.includes('--quiet') || argv.includes('-q');
    const stat = argv.includes('--stat') || argv.includes('-s');
    const staged = argv.includes('--staged') || argv.includes('-c');
    const help = argv.includes('--help') || argv.includes('-h');
    if (help) {
        console.log(helpText());
        return;
    }
    await requireGitRepo();
    const cwd = process.cwd();
    const base = staged ? ['diff', '--cached'] : ['diff'];
    if (quiet) {
        const result = await git([...base, '--quiet'], { cwd });
        if (result.code === 0)
            info('No changes.');
        else if (result.code === 1)
            info('Changes present.');
        else
            fail(result.stderr.trim() || `git diff --quiet failed with exit code ${result.code}.`);
        return;
    }
    const args = [...base, '--no-color'];
    if (stat)
        args.push('--stat');
    const result = await git(args, { cwd });
    if (result.code !== 0) {
        fail(result.stderr.trim() || `git ${args.join(' ')} failed with exit code ${result.code}.`);
    }
    if (stat) {
        console.log(result.stdout);
        return;
    }
    const lines = result.stdout.split('\n').map((line) => line.replace(/\r$/, ''));
    if (lines.length === 0) {
        info('No changes.');
        return;
    }
    console.log(lines
        .map((raw) => {
        if (raw.startsWith('@@'))
            return raw;
        if (raw.startsWith('+') && !raw.startsWith('+++'))
            return `${green('+')} ${raw.slice(1)}`;
        if (raw.startsWith('-') && !raw.startsWith('---'))
            return `${red('-')} ${raw.slice(1)}`;
        return raw;
    })
        .join('\n'));
}
function helpText() {
    return `Usage: ${BIN} diff [options]

Show changes in the current repository.

Options:
  --quiet, -q        Report "No changes." or "Changes present." instead of printing
  --stat, -s         Show a per-file summary of changes
  --staged, -c       Show only staged changes
  --no-renames       Do not treat renames as renames
  --help, -h         Show this help

Examples:
  ${BIN} diff
  ${BIN} diff --stat
  ${BIN} diff --staged`;
}
//# sourceMappingURL=diff.js.map