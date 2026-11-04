import { bold, cyan, dim, faint, box } from './palette.js';
import { SETTINGS } from '../config/settings.js';
const NODE = '●';
const RULE = '━━━';
export const MARK = cyan(SETTINGS.mark);
const NAME = `${bold(SETTINGS.name)} ${faint('•')} ${cyan(SETTINGS.label)}`;
const VERSION = `v${SETTINGS.version}`;
/** One line, for `--version` and the shell's `version` builtin. */
export function logoTiny() {
    return `${MARK}${faint('──')}${cyan(NODE)}  ${NAME} ${faint('·')} ${dim(VERSION)}`;
}
/** Three lines, for the interactive shell banner. */
export function logoCompact() {
    const stem = ' '.repeat(SETTINGS.mark.length + 3);
    return [
        `  ${MARK} ${faint('━━━━')} ${cyan(NODE)}`,
        `${stem}${faint(`┣${RULE}`)} ${cyan(NODE)}   ${NAME}  ${dim(VERSION)}`,
        `${stem}${faint(`┗${RULE}`)} ${cyan(NODE)}   ${dim(SETTINGS.tagline)}`,
    ].join('\n');
}
/** Boxed mark, for `help`. */
export function logoBox() {
    const lead = '   ';
    const stem = ' '.repeat(lead.length + SETTINGS.mark.length + 3);
    return box([
        '',
        `${lead}${MARK} ${faint('──┬─')}${cyan(NODE)}`,
        `${stem}${faint('├─')}${cyan(NODE)}   ${NAME}  ${dim(VERSION)}`,
        `${stem}${faint('└─')}${cyan(NODE)}   ${dim(SETTINGS.tagline)}`,
        '',
        `${lead}${dim(SETTINGS.footer)} ${faint('·')} ${dim(SETTINGS.label)}`,
        `${lead}${dim(SETTINGS.description)}`,
        '',
    ]);
}
//# sourceMappingURL=logo.js.map