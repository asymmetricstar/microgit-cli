import { bold, faint, dim, green, cyan, accentRedSignedOut } from './palette.js';
import { DEFAULT_URL } from '../config/index.js';
import { logoCompact } from './logo.js';
import { BIN } from '../config/settings.js';
export function sessionLeft(expiresAt) {
    if (!expiresAt)
        return undefined;
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime()))
        return undefined;
    const ms = date.getTime() - Date.now();
    if (ms <= 0)
        return 'expired';
    const hours = ms / 3_600_000;
    if (hours < 1)
        return `${Math.max(1, Math.round(ms / 60_000))}m left`;
    if (hours < 48)
        return `${Math.round(hours)}h left`;
    return `${Math.round(hours / 24)}d left`;
}
export function shellBanner(config) {
    const rows = ['', logoCompact(), ''];
    const meta = (label, value) => `  ${faint('#')} ${dim(label.padEnd(8))} ${value}`;
    rows.push(meta('server', config?.url ?? DEFAULT_URL));
    const left = sessionLeft(config?.expiresAt);
    if (config?.token && config.username) {
        const suffix = left === undefined ? '' : ` ${faint('·')} ${dim(left)}`;
        rows.push(meta('account', `${bold(config.username)}${suffix}`));
    }
    else if (config?.username) {
        rows.push(meta('account', `${dim(config.username)} ${faint('·')} ${accentRedSignedOut('signed out')}`));
    }
    else {
        rows.push(meta('account', `${accentRedSignedOut('signed out')} ${faint('·')} ${cyan('login')} ${dim('to start a session')}`));
    }
    rows.push('');
    rows.push(`  ${green('✓')} ${dim('ready')} ${faint('·')} ${dim('type')} ${cyan('help')} ${dim('to list the commands')}`);
    rows.push(`  ${green('✓')} ${dim('ready')} ${faint('·')} ${dim('use')} ${cyan('config')} ${dim('to manage settings')}`);
    rows.push('');
    if (config?.token)
        rows.push(`  ${faint('#')} ${dim('one-shot')} ${dim(`${BIN} --help`)}`);
    return rows.join('\n');
}
//# sourceMappingURL=banner.js.map