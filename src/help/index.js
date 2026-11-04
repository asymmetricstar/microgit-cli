import { ENV } from '../config/index.js';
import { COMMANDS, GROUPS } from '../commands/registry.js';
import { BIN, SETTINGS } from '../config/settings.js';
import { logoTiny, logoBox } from '../theme/index.js';
import { bold, cyan, dim, faint } from '../ui/index.js';
/** `--version`: one line, no banner, safe for scripts. */
export function printVersion() {
    console.log(logoTiny());
}
/** `help`: boxed mark, commands by group, then options and examples. */
export function printHelp() {
    const nameWidth = Math.max(...COMMANDS.map((command) => command.name.length));
    const aliasLabels = COMMANDS.map((command) => command.aliases?.length ? `(${command.aliases.join(', ')})` : '');
    const aliasWidth = Math.max(...aliasLabels.map((label) => label.length));
    const out = [''];
    out.push(logoBox());
    out.push('');
    out.push(`  ${dim('usage')}  ${cyan(BIN)} ${dim('<command> [options]')}`);
    out.push(`         ${cyan(BIN)} ${dim('start the interactive shell')}`);
    for (const group of GROUPS) {
        out.push('');
        out.push(`  ${cyan('●')} ${bold(group)}`);
        COMMANDS.forEach((command, index) => {
            if (command.group !== group)
                return;
            const alias = aliasWidth === 0 ? '' : `${faint((aliasLabels[index] ?? '').padEnd(aliasWidth))}  `;
            out.push(`    ${cyan(command.name.padEnd(nameWidth))}  ${alias}${command.summary}`);
        });
    }
    const section = (title) => {
        out.push('');
        out.push(`  ${cyan('●')} ${bold(title)}`);
    };
    section('Options');
    out.push(`    ${dim('--url <url>')}    Server URL (also ${ENV.url})`);
    out.push(`    ${dim('--json')}         Machine-readable output where supported`);
    out.push(`    ${dim('-h, --help')}     Help for one command`);
    out.push(`    ${dim('-v, --version')}  Version without the banner`);
    section('Shell');
    out.push(`    ${dim('help · clear · exit')}   ${faint('↑↓ history · tab complete · Ctrl+C cancels')}`);
    section('Environment');
    out.push(`    ${dim(`${ENV.url} · ${ENV.token} · ${ENV.username} · ${ENV.password}`)}`);
    out.push(`    ${dim(ENV.config)}   Config file path (default ~/${SETTINGS.configDir}/config.json)`);
    section('Quick start');
    out.push(`    ${cyan(`${BIN} login --url http://{HOST_NAME}:{PORT}`)}`);
    out.push(`    ${cyan(`${BIN} new app --init`)}`);
    out.push(`    ${cyan('cd app')}`);
    out.push(`    ${cyan(`${BIN} commit -m "First change"`)}`);
    out.push(`    ${cyan(`${BIN} whoami`)}`);
    console.log(out.join('\n'));
}
//# sourceMappingURL=index.js.map