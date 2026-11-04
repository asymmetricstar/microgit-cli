/** Colours follow the terminal design: a GitHub-dark 256-colour palette, so the
 * shell reads the same in Windows Terminal, iTerm and VS Code. Anything piped
 * through a file or a non-TTY prints without escape codes.
 */
const colour = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
const paint = (spec) => (text) => colour ? `\u001b[${spec}m${text}\u001b[0m` : text;
/** Structural lines and separators. */
export const faint = paint('38;5;240');
/** Secondary text, metadata and hints. */
export const dim = paint('38;5;246');
export const bold = paint('1');
export const red = paint('38;5;203');
export const green = paint('38;5;114');
export const yellow = paint('38;5;179');
/** The single accent colour: nodes, command names, links. */
export const cyan = paint('38;5;75');
const ANSI = /\u001b\[[0-9;]*m/g;
/** Length of a styled string as it appears on screen. */
export function visibleWidth(value) {
    return value.replace(ANSI, '').length;
}
/** Draw a rounded box around already-styled rows. */
export function box(rows) {
    const width = Math.max(0, ...rows.map(visibleWidth));
    const pad = (row) => ' '.repeat(width - visibleWidth(row));
    return [
        faint(`┌${'─'.repeat(width + 2)}┐`),
        ...rows.map((row) => `${faint('│')} ${row}${pad(row)} ${faint('│')}`),
        faint(`└${'─'.repeat(width + 2)}┘`),
    ].join('\n');
}
//# sourceMappingURL=palette.js.map