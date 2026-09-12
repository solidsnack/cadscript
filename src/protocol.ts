// What the interpreter and its sandboxed worker say to one another.

import type { Format } from "./format.ts"

export interface HelpJob {
    readonly kind: "help"
    /** A `file:` URL for the script. */
    readonly script: string
    readonly args: readonly string[]
    /** The name to print in the script's usage line. */
    readonly program: string
    readonly debug: boolean
}

export interface RenderJob {
    readonly kind: "render"
    readonly script: string
    readonly args: readonly string[]
    readonly format: Format
    /**
     * The OpenCascade WASM module, read by the interpreter and handed over
     * here so that the worker needs no read access outside the working
     * directory.
     */
    readonly wasm: ArrayBuffer
    readonly debug: boolean
}

export type Job = HelpJob | RenderJob

export type Reply =
    | { readonly ok: true; readonly kind: "help"; readonly text: string }
    | {
        readonly ok: true
        readonly kind: "render"
        readonly bytes: Uint8Array
    }
    | { readonly ok: false; readonly error: string }
