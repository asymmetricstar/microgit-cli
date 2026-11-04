/**
 * Every static, user-facing name in one place. Change these and the banners,
 * prompt, help page, messages, environment variables and config folder follow.
 *
 * Alternative taglines you can drop in:
 *   'self-hosted git over ssh & http, in one command'
 *   'host, clone and push — no cloud in the middle'
 * Alternative labels: 'gitserver', 'githost', 'git service'.
 */
export const SETTINGS = {
    /** npm package name (`name` in package.json). */
    packageName: 'microgit-cli',
    /** Command installed on PATH (`bin` in package.json). */
    bin: 'microgit',
    /** Product name shown in banners and help. */
    name: 'microgit-cli',
    /** Wordmark at the start of the ASCII logo: `μgit ━━━ ●`. */
    mark: 'μgit',
    version: '0.1.0',
    /** Short label printed next to the name: `microgit-cli • <label>`. */
    label: 'git client',
    tagline: 'manage your own git server — clone, push, host',
    /** One-line description for package.json and README. */
    description: 'Command line client for a self-hosted git server',
    /** Footer line in the boxed logo and the one-line version. */
    footer: 'zero deps · Node 21+',
    /** Prefix for environment variables (MICROGIT_URL, MICROGIT_TOKEN, ...). */
    envPrefix: 'MICROGIT',
    /** Folder under the home directory holding config.json and history. */
    configDir: '.microgit',
};
/** The command users type. */
export const BIN = SETTINGS.bin;
//# sourceMappingURL=settings.js.map