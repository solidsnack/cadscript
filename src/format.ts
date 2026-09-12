// Output formats and the serialization of what a script renders.

import { ScriptError } from "./errors.ts"
import type { Renderable } from "./script.ts"

export const FORMATS = ["stl", "step"] as const

export type Format = (typeof FORMATS)[number]

/**
 * The output path that means standard output. A file that really is named
 * `-` can be written by giving a path with a slash in it: `./-`.
 */
export const STDOUT = "-"

/** The file extensions the interpreter can read a format out of. */
const BY_EXTENSION: Readonly<Record<string, Format>> = {
    stl: "stl",
    step: "step",
    stp: "step",
}

/**
 * The extension of a path, lower cased and without the dot, or `undefined`
 * when there is none. A leading dot makes a hidden file rather than an
 * extension, so `.stl` is a file called `.stl`.
 */
export function extensionOf(path: string): string | undefined {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
    const name = path.slice(slash + 1)
    const dot = name.lastIndexOf(".")
    if (dot <= 0) return undefined
    const extension = name.slice(dot + 1).toLowerCase()
    return extension === "" ? undefined : extension
}

export type FormatChoice =
    | {
        readonly ok: true
        readonly format: Format
        /** Said when the option and the file extension disagree. */
        readonly warning?: string
    }
    | { readonly ok: false; readonly error: string }

/**
 * Settles on an output format.
 *
 * An explicit `--stl` or `--step` always decides it, and only disagrees out
 * loud when the output is named for the other format. Otherwise the name of
 * the output file decides: a known extension picks the format, no extension
 * at all means STL, and an extension that means nothing here is a question
 * worth asking rather than guessing at.
 */
export function chooseFormat(
    explicit: Format | undefined,
    output: string | undefined,
): FormatChoice {
    const extension = output == null || output === STDOUT
        ? undefined
        : extensionOf(output)
    const inferred = extension == null ? undefined : BY_EXTENSION[extension]

    if (explicit != null) {
        return inferred != null && inferred !== explicit
            ? {
                ok: true,
                format: explicit,
                warning: `--${explicit} overrides the \`.${extension}\` ` +
                    `output name; writing ${explicit.toUpperCase()}`,
            }
            : { ok: true, format: explicit }
    }

    if (extension == null) return { ok: true, format: "stl" }
    if (inferred != null) return { ok: true, format: inferred }
    return {
        ok: false,
        error: `cannot tell which format \`.${extension}\` means; ` +
            `name the output \`.${Object.keys(BY_EXTENSION).join("`, `.")}\`` +
            `, or pass --stl or --step`,
    }
}

interface Solid {
    blobSTL(options?: { binary?: boolean }): Blob
    blobSTEP(): Blob
}

// Replicad's shapes are duck typed here rather than matched with
// `instanceof`, so that a script which reaches replicad by some other route
// than the interpreter's own copy still works.

function asSolid(shape: Renderable): Solid | undefined {
    const candidate = shape as Partial<Solid>
    return typeof candidate.blobSTL === "function" &&
            typeof candidate.blobSTEP === "function"
        ? candidate as Solid
        : undefined
}

/** Raised when a shape cannot be written in the format that was asked for. */
export class FormatError extends ScriptError {
    override readonly name = "FormatError"
}

/**
 * Says why a shape cannot be written. Replicad's two dimensional drawings
 * are the likely mistake, and they are recognizable by the one thing they
 * can be turned into.
 */
function complaint(shape: Renderable, format: Format): string {
    const flat = shape as { toSVG?: unknown }
    if (typeof flat.toSVG === "function") {
        return `the script rendered a 2-D drawing, which cannot be written ` +
            `as ${format.toUpperCase()}; give it thickness first -- say, ` +
            `\`.sketchOnPlane("XY").extrude(10)\``
    }
    return `the script rendered something that cannot be written as ` +
        `${format.toUpperCase()}; render() has to return a solid`
}

/** Serializes what a script rendered into the bytes of an output file. */
export async function serialize(
    shape: Renderable,
    format: Format,
): Promise<Uint8Array> {
    const solid = asSolid(shape)
    if (solid == null) throw new FormatError(complaint(shape, format))
    const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP()
    return new Uint8Array(await blob.arrayBuffer())
}
