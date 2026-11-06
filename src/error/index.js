export class CliError extends Error {
    exitCode;
    constructor(message, exitCode = 1) {
        super(message);
        this.name = 'CliError';
        this.exitCode = exitCode;
    }
}
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=index.js.map