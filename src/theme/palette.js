const colour = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
const paint = (spec) => (text) => colour ? `\u001b[${spec}m${text}\u001b[0m` : text;
export const faint = paint('38;5;240');
export const dim = paint('38;5;246');
export const bold = paint('1');
export const red = paint('38;5;203');
export const green = paint('38;5;114');
export const yellow = paint('38;5;179');
export const cyan = paint('38;5;75');
const paintHex = (r, g, b) => paint(`38;2;${r};${g};${b}`);
export const accentGreen = paintHex(0x17, 0xb8, 0x8b);
export const accentBlue = paintHex(0x58, 0xa1, 0xff);
export const accentRedSignedOut = paintHex(0xdc, 0x5b, 0x5e);
const ANSI = /\u001b\[[0-9;]*m/g;
export function visibleWidth(value) {
    return value.replace(ANSI, '').length;
}
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