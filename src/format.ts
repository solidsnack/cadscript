// Output formats and the serialization of what a script renders.

import { ScriptError } from "./errors.ts"
import type { Renderable } from "./script.ts"

export const FORMATS = ["stl", "step"] as const

export type Format = (typeof FORMATS)[number]

/** Whether the format is binary, and so unfit for a terminal. */
export function isBinary(format: Format): boolean {
    return format === "stl"
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
