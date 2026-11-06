import readline from 'node:readline';
import { CliError } from '../error/index.js';
import { faint, dim, bold, red, green, yellow, cyan, visibleWidth, box, accentBlue, accentGreen } from '../theme/palette.js';
export { faint, dim, bold, red, green, yellow, cyan, visibleWidth, box, accentBlue, accentGreen };
export function ok(message) {
    console.log(`${green('✓')} ${message}`);
}
export function info(message) {
    console.log(`${cyan('→')} ${message}`);
}
export function warn(message) {
    console.error(`${yellow('!')} ${message}`);
}
export function fail(message) {
    throw new CliError(message);
}
export function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
let promptHandlers = null;
export function usePromptHandlers(handlers) {
    promptHandlers = handlers;
}
function askWith(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
        rl.once('close', () => resolve(''));
    });
}
export async function ask(question) {
    if (promptHandlers)
        return promptHandlers.ask(question);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await askWith(rl, question);
        return answer.trim();
    }
    finally {
        rl.close();
        await new Promise((resolve) => setImmediate(resolve));
    }
}
export async function askSecret(question) {
    if (promptHandlers)
        return promptHandlers.askSecret(question);
    if (!process.stdin.isTTY)
        return ask(question);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });
    return new Promise((resolve) => {
        process.stdout.write(`${question} `);
        rl.question('', (answer) => {
            process.stdout.write('\n');
            rl.close();
            setImmediate(() => resolve(answer));
        });
    });
}
export async function confirm(question, fallback = false) {
    if (!process.stdin.isTTY)
        return fallback;
    const answer = (await ask(`${question} ${fallback ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
    if (answer === '')
        return fallback;
    return answer === 'y' || answer === 'yes';
}
export function table(headers, rows) {
    const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)));
    const pad = (cells) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0));
    const line = (cells) => pad(cells).join('  ').trimEnd();
    return [
        pad(headers)
            .map((cell) => bold(cell))
            .join('  ')
            .trimEnd(),
        widths.map((width) => faint('─'.repeat(width))).join('  '),
        ...rows.map(line),
    ].join('\n');
}
export function formatDate(iso) {
    if (!iso)
        return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
//# sourceMappingURL=index.js.map