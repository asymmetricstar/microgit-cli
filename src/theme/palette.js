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
/**
 * Brand accent colours, painted with truecolour (24-bit) so the exact hex
 * values survive on any terminal that supports 24-bit colour. Kept separate
 * from the 8/256-colour palette so the design green/red never drifts.
 *
 *   accentGreen   #17b88b  — logged-in user in the prompt
 *   accentRed     #ff6c37  — brand red accent (reserved)
 *   accentRedSignedOut  #dc5b5e  — "signed out" in the banner
 */
const paintHex = (r, g, b) => paint(`38;2;${r};${g};${b}`);
export const accentGreen = paintHex(0x17, 0xb8, 0x8b);
export const accentBlue = paintHex(0x58, 0xa1, 0xff);
export const accentRedSignedOut = paintHex(0xdc, 0x5b, 0x5e);
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