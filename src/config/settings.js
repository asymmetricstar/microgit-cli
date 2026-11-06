import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;
export const SETTINGS = {
    packageName: "microgit-cli",
    bin: "microgit",
    name: "microgit-cli",
    mark: "μgit",
    version: VERSION,
    label: "MIT",
    tagline: "manage your own git server — clone, push, host",
    description: "Command line client for a self-hosted git server",
    footer: "Free and Open Source",
    envPrefix: "MICROGIT",
    configDir: ".microgit",
};
export const BIN = SETTINGS.bin;
//# sourceMappingURL=settings.js.map