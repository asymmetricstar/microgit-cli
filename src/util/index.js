import { CliError } from '../error/index.js';
export function text(value) {
    return typeof value === 'string' && value !== '' ? value : undefined;
}
export function trimmed(value) {
    const valueText = text(value)?.trim();
    return valueText === '' ? undefined : valueText;
}
/** Parse a positive integer option, or fail with a useful message. */
export function positiveInt(value, option, fallback) {
    const raw = trimmed(value);
    if (raw === undefined)
        return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new CliError(`${option} must be a positive integer.`);
    }
    return parsed;
}
/** `name`, `name.git`, `owner/name`, `owner/name.git` or `http://<ip>/<user>/<repo>.git` all work. */
export function parseTarget(raw) {
    const trimmedRaw = raw.trim();
    // Check if it's a URL format: http://<ip>/<user>/<repo>.git or https://<ip>/<user>/<repo>.git
    const urlMatch = trimmedRaw.match(/^(https?:\/\/[^/]+)\/(.+)\.git$/i);
    if (urlMatch) {
        const baseUrl = urlMatch[1];
        const pathPart = urlMatch[2];
        const pathParts = pathPart.split('/').filter((part) => part !== '');
        if (pathParts.length === 2) {
            return { owner: pathParts[0], name: pathParts[1], cloneUrl: `${baseUrl}/${pathParts[0]}/${pathParts[1]}.git` };
        }
        throw new CliError(`Expected http://<ip>/<user>/<repo>.git, got '${raw}'.`);
    }
    const cleaned = trimmedRaw.replace(/\.git$/i, '');
    const parts = cleaned.split('/').filter((part) => part !== '');
    if (parts.length === 1)
        return { name: parts[0] ?? '' };
    if (parts.length === 2)
        return { owner: parts[0], name: parts[1] ?? '' };
    throw new CliError(`Expected <name> or <owner/name>, got '${raw}'.`);
}
//# sourceMappingURL=index.js.map