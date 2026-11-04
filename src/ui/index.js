import readline from 'node:readline';
import { CliError } from '../error/index.js';
import { faint, dim, bold, red, green, yellow, cyan, visibleWidth, box } from '../theme/palette.js';
export { faint, dim, bold, red, green, yellow, cyan, visibleWidth, box };
/** A successful step. */
export function ok(message) {
    console.log(`${green('✓')} ${message}`);
}
/** A neutral next step or piece of information. */
export function info(message) {
    console.log(`${cyan('→')} ${message}`);
}
/** A warning that does not stop the command. */
export function warn(message) {
    console.error(`${yellow('!')} ${message}`);
}
/** Stop the command with a readable error. */
export function fail(message) {
    throw new CliError(message);
}
export function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
let promptHandlers = null;
/** Install or remove the prompt handlers used by `ask`/`askSecret`. */
export function usePromptHandlers(handlers) {
    promptHandlers = handlers;
}
function askWith(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
        rl.once('close', () => resolve(''));
    });
}
/** Read one line from the terminal, trimmed. */
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
        // Give the interface time to release stdin before the next prompt.
        await new Promise((resolve) => setImmediate(resolve));
    }
}
/** Read a password without echoing it; falls back to a normal line off a TTY. */
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
            // Give the interface time to release stdin before the next prompt.
            setImmediate(() => resolve(answer));
        });
    });
}
/** Ask a yes/no question; non-interactive runs use the fallback. */
export async function confirm(question, fallback = false) {
    if (!process.stdin.isTTY)
        return fallback;
    const answer = (await ask(`${question} ${fallback ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
    if (answer === '')
        return fallback;
    return answer === 'y' || answer === 'yes';
}
/** A small aligned table with a dashed header underline. */
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
/** Short, local representation of an ISO timestamp. */
export function formatDate(iso) {
    if (!iso)
        return '-';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
//# sourceMappingURL=index.js.map