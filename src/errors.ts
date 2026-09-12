// Errors that are the script author's business rather than the
// interpreter's.

/**
 * An error whose message is meant to be read on its own, without a stack:
 * the script does not meet the contract, imports something that is not
 * there, or rendered something that cannot be written in the format asked
 * for.
 */
export class ScriptError extends Error {
    override readonly name: string = "ScriptError"
}
