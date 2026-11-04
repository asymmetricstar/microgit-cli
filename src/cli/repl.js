import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { configFilePath, loadConfig } from '../config/index.js';
import { errorMessage } from '../error/index.js';
import { printHelp, printVersion } from '../help/index.js';
import { commandNames, dispatch, findCommand } from '../commands/registry.js';
import { BIN } from '../config/settings.js';
import { shellBanner } from '../theme/index.js';
import { cyan, dim, faint, red, usePromptHandlers } from '../ui/index.js';
const HISTORY_LIMIT = 500;
const CONFIG_ACTIONS = ['show', 'path', 'set', 'unset', 'clear'];
const EXIT_WORDS = ['exit', 'quit', 'q', ':q'];
/** Split a line into arguments, keeping quoted phrases in one argument. */
export function tokenize(line) {
    const tokens = [];
    let current = '';
    let quote = null;
    let started = false;
    for (const char of line) {
        if (quote !== null) {
            if (char === quote)
                quote = null;
            else
                current += char;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            started = true;
            continue;
        }
        if (char === ' ' || char === '\t') {
            if (started || current !== '') {
                tokens.push(current);
                current = '';
                started = false;
            }
            continue;
        }
        current += char;
        started = true;
    }
    if (started || current !== '')
        tokens.push(current);
    return tokens;
}
function historyFile() {
    return path.join(path.dirname(configFilePath()), 'history');
}
/** Previous lines, oldest first; the history file is a convenience only. */
function readHistory() {
    try {
        return fs
            .readFileSync(historyFile(), 'utf8')
            .split(/\r?\n/)
            .filter((line) => line.trim() !== '')
            .slice(-HISTORY_LIMIT);
    }
    catch {
        return [];
    }
}
function writeHistory(entries) {
    const oldestFirst = [...entries].reverse().slice(-HISTORY_LIMIT);
    if (oldestFirst.length === 0)
        return;
    try {
        fs.mkdirSync(path.dirname(historyFile()), { recursive: true });
        fs.writeFileSync(historyFile(), `${oldestFirst.join('\n')}\n`, 'utf8');
    }
    catch {
        // Losing the history file must never break the shell.
    }
}
/** `~/repos` instead of the full path, shortened when it gets long. */
function shortPath(cwd) {
    const normal = cwd.replace(/\\/g, '/');
    const home = os.homedir().replace(/\\/g, '/');
    let shown = normal;
    if (normal === home)
        shown = '~';
    else if (normal.toLowerCase().startsWith(`${home.toLowerCase()}/`)) {
        shown = `~${normal.slice(home.length)}`;
    }
    if (shown.length > 34)
        shown = `…/${shown.split('/').slice(-2).join('/')}`;
    return shown;
}
function promptText() {
    let user = 'guest';
    try {
        user = loadConfig().username ?? 'guest';
    }
    catch {
        // A broken config file is reported by the command that needs it, not here.
    }
    return `${cyan(`${user}@${BIN}`)}${dim(`:${shortPath(process.cwd())}`)} ${faint('$')} `;
}
/** Commands and, after one is typed, its options. */
function complete(line) {
    const tokens = line.split(/\s+/);
    const current = tokens[tokens.length - 1] ?? '';
    const first = tokens[0] ?? '';
    let pool;
    if (tokens.length <= 1) {
        pool = [...commandNames(), 'clear', 'exit', 'help'];
    }
    else if (first === 'config' && tokens.length === 2) {
        pool = CONFIG_ACTIONS;
    }
    else if (current.startsWith('-')) {
        pool = [...(findCommand(first)?.flags ?? [])];
    }
    else {
        pool = [];
    }
    const hits = [...new Set(pool)].filter((candidate) => candidate.startsWith(current)).sort();
    if (hits.length === 0)
        return [[], current];
    // A single match is completed with a trailing space, ready for its arguments.
    return [hits.length === 1 ? [`${hits[0]} `] : hits, current];
}
function printHeader(terminal) {
    let config;
    try {
        config = loadConfig();
    }
    catch {
        config = undefined;
    }
    console.log(shellBanner(config));
    console.log('');
    if (terminal)
        console.log(`  ${faint('↑↓ history   tab complete   clear to reset')}`);
}
/** Wipe the screen and the scrollback, so the shell opens on a clean page. */
function clearScreen() {
    process.stdout.write('\u001b[2J\u001b[3J\u001b[H');
}
/**
 * Interactive shell: the same commands as the one-shot CLI, with history, tab
 * completion and a prompt. Runs until `exit`, Ctrl+C on an empty line or EOF.
 */
export async function startShell() {
    const terminal = Boolean(process.stdin.isTTY);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal,
        history: readHistory(),
        historySize: HISTORY_LIMIT,
        removeHistoryDuplicates: true,
        completer: complete,
    });
    const originalWriteToOutput = rl._writeToOutput;
    let closed = false;
    let draining = false;
    const queue = [];
    /** Set while a running command is waiting for an answer. */
    let pending = null;
    const finishPending = (answer) => {
        const current = pending;
        pending = null;
        if (current === null)
            return;
        current.cleanup();
        current.resolve(answer);
    };
    const askLine = (question) => new Promise((resolve) => {
        process.stdout.write(question);
        pending = { resolve, cleanup: () => { } };
    });
    const askSecretLine = (question) => new Promise((resolve) => {
        process.stdout.write(question);
        const internal = rl;
        // Use the real echo function captured at startup, in case a previous
        // call left _writeToOutput overridden.
        const echo = typeof originalWriteToOutput === 'function' ? originalWriteToOutput : internal._writeToOutput;
        internal._writeToOutput = () => { };
        pending = {
            resolve,
            cleanup: () => {
                internal._writeToOutput = echo;
                process.stdout.write('\n');
            },
        };
    });
    const prompt = () => {
        rl.setPrompt(promptText());
        rl.prompt();
    };
    const runBuiltin = (word) => {
        switch (word) {
            case 'help':
                printHelp();
                return true;
            case 'clear':
                if (terminal) {
                    clearScreen();
                    printHeader(terminal);
                }
                else {
                    process.stdout.write('\n');
                }
                return true;
            case 'version':
                printVersion();
                return true;
            default:
                return false;
        }
    };
    /** Returns true when the shell should stop. */
    const handleLine = async (raw) => {
        const input = raw.trim();
        if (input === '') {
            prompt();
            return false;
        }
        const [word, ...args] = tokenize(input);
        if (word === undefined) {
            prompt();
            return false;
        }
        if (EXIT_WORDS.includes(word)) {
            rl.close();
            return true;
        }
        if (runBuiltin(word)) {
            prompt();
            return false;
        }
        // Commands keep printing on their own; only their questions come back here.
        if (terminal)
            usePromptHandlers({ ask: askLine, askSecret: askSecretLine });
        try {
            await dispatch([word, ...args]);
        }
        catch (error) {
            console.log(`${red('✗')} ${errorMessage(error)}`);
        }
        finally {
            usePromptHandlers(null);
            if (!closed)
                prompt();
        }
        return false;
    };
    const drain = async () => {
        if (draining)
            return;
        draining = true;
        try {
            while (!closed && queue.length > 0) {
                const line = queue.shift();
                if (line === undefined)
                    break;
                if (await handleLine(line))
                    break;
            }
        }
        finally {
            draining = false;
        }
    };
    /** Answers typed at a command's prompt are not worth keeping, and a password
     * must never reach the history file. */
    const dropFromHistory = (answer) => {
        const history = rl.history;
        if (history !== undefined && history[0] === answer)
            history.shift();
    };
    rl.on('line', (line) => {
        if (pending !== null) {
            finishPending(line);
            dropFromHistory(line);
            return;
        }
        queue.push(line);
        void drain();
    });
    rl.on('SIGINT', () => {
        if (pending !== null) {
            // Cancel the question; the command reports the empty answer itself.
            finishPending('');
            return;
        }
        if (draining)
            return;
        if (rl.line.trim() !== '') {
            rl.write(null, { ctrl: true, name: 'u' });
            process.stdout.write('\n');
            prompt();
            return;
        }
        process.stdout.write('\n');
        rl.close();
    });
    rl.on('close', () => {
        closed = true;
        // `history` exists at runtime but is missing from @types/node, newest first.
        writeHistory(rl.history);
        if (terminal)
            process.stdout.write('\n');
    });
    // Clear whatever was on screen before the shell took over.
    if (terminal)
        clearScreen();
    printHeader(terminal);
    prompt();
    await new Promise((resolve) => rl.once('close', resolve));
}
//# sourceMappingURL=repl.js.map