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
import { dim, faint, red, accentBlue, accentGreen, usePromptHandlers } from '../ui/index.js';
/** Get directory and file completions for a given path prefix. */
function getDirAndFileCompletions(prefix) {
    try {
        let dirToList;
        let namePrefix;
        // Split by the last path separator
        const lastSlash = Math.max(prefix.lastIndexOf('/'), prefix.lastIndexOf('\\'));
        if (lastSlash !== -1) {
            dirToList = prefix.slice(0, lastSlash + 1);
            namePrefix = prefix.slice(lastSlash + 1);
        }
        else {
            dirToList = '.';
            namePrefix = prefix;
        }
        // Resolve the directory to list
        let resolveBase = dirToList === '.' ? process.cwd() : dirToList;
        // Handle './' or '.\\'
        if (resolveBase === './' || resolveBase === '.\\') {
            resolveBase = process.cwd();
        }
        const resolvedDir = path.resolve(resolveBase);
        let entries = [];
        try {
            entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
        }
        catch {
            return [];
        }
        const hits = entries
            .filter((entry) => entry.name.startsWith(namePrefix))
            .map((entry) => {
            // Reconstruct the path with the prefix
            let correctPath;
            if (dirToList === '.' || dirToList === './' || dirToList === '.\\') {
                correctPath = dirToList === '.' ? entry.name : `${dirToList}${entry.name}`;
            }
            else {
                // Ensure the dirToList ends with a separator if it doesn't
                const dirEndsWithSep = dirToList.endsWith('/') || dirToList.endsWith('\\');
                correctPath = dirEndsWithSep ? `${dirToList}${entry.name}` : `${dirToList}/${entry.name}`;
            }
            if (entry.isDirectory()) {
                return `${correctPath}/`;
            }
            return correctPath;
        });
        return hits;
    }
    catch {
        return [];
    }
}
/** Temporary diagnostic sink, enabled with MICROGIT_DEBUG. */
function debugLog(message) {
    if (!process.env.MICROGIT_DEBUG)
        return;
    try {
        fs.appendFileSync(path.join(process.cwd(), 'debug.log'), `${message}\n`);
    }
    catch {
        // Diagnostics must never break the shell.
    }
}
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
    let token;
    try {
        const config = loadConfig();
        user = config.username ?? 'guest';
        token = config.token;
    }
    catch {
        // A broken config file is reported by the command that needs it, not here.
    }
    // Token olmadan oturum açılmış sayılmaz: misafir (mavi), oturumlu kullanıcı (yeşil).
    const isGuest = !token;
    const userColor = isGuest ? accentBlue : accentGreen;
    return `${userColor(user)}${faint('@')}${accentBlue(BIN)}${dim(`:${shortPath(process.cwd())}`)} ${faint('$')} `;
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
    else if (first.toLowerCase() === 'config' && tokens.length === 2) {
        pool = CONFIG_ACTIONS;
    }
    else {
        const cmd = findCommand(first);
        if (cmd?.dirCompletes && tokens.length === 2) {
            pool = getDirAndFileCompletions(current);
        }
        else if (current.startsWith('-')) {
            pool = [...(cmd?.flags ?? [])];
        }
        else {
            pool = [];
        }
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
    let closed = false;
    let draining = false;
    const queue = [];
    /** Set while a running command is waiting for an answer. */
    let pending = null;
    const finishPending = (answer) => {
        debugLog(`finishPending(${JSON.stringify(answer)}) pending=${pending !== null} line=${JSON.stringify(rl.line)}`);
        const current = pending;
        pending = null;
        if (current === null)
            return;
        current.cleanup();
        current.resolve(answer);
    };
    const askLine = (question) => new Promise((resolve) => {
        debugLog(`askLine(${JSON.stringify(question)})`);
        // Let readline own the question text so the screen stays in sync and
        // editing keys (backspace, delete, arrows) keep working instead of
        // garbling the interface or dropping out of the prompt.
        rl.setPrompt(question);
        rl.prompt();
        pending = { resolve, cleanup: () => { } };
    });
    const askSecretLine = (question) => new Promise((resolve) => {
        const internal = rl;
        // Capture the real echo function before we override it.
        const echo = internal._writeToOutput;
        // Draw the question as readline's prompt so the screen stays in sync,
        // then hide typed characters while the password is entered.
        internal._writeToOutput = echo;
        rl.setPrompt(question);
        rl.prompt();
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
        debugLog('prompt()');
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
        debugLog(`line(${JSON.stringify(line)}) pending=${pending !== null}`);
        if (pending !== null) {
            finishPending(line);
            dropFromHistory(line);
            return;
        }
        queue.push(line);
        void drain();
    });
    rl.on('SIGINT', () => {
        debugLog('SIGINT');
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