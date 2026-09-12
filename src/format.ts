// Output formats and the serialization of what a script renders.

import { ScriptError } from "./errors.ts"
import type { Renderable } from "./script.ts"

export const FORMATS = ["stl", "step", "svg"] as const

export type Format = (typeof FORMATS)[number]

export const EXTENSIONS: Readonly<Record<Format, string>> = {
    stl: ".stl",
    step: ".step",
    svg: ".svg",
}

/** Whether the format is binary, and so unfit for a terminal. */
export function isBinary(format: Format): boolean {
    return format === "stl"
}

interface Solid {
    blobSTL(options?: { binary?: boolean }): Blob
    blobSTEP(): Blob
}

interface Flat {
    toSVG(margin?: number): string
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

function asFlat(shape: Renderable): Flat | undefined {
    const candidate = shape as Partial<Flat>
    return typeof candidate.toSVG === "function" && asSolid(shape) == null
        ? candidate as Flat
        : undefined
}

/** Raised when a shape cannot be written in the format that was asked for. */
export class FormatError extends ScriptError {
    override readonly name = "FormatError"
}

/** Serializes what a script rendered into the bytes of an output file. */
export async function serialize(
    shape: Renderable,
    format: Format,
): Promise<Uint8Array> {
    const solid = asSolid(shape)
    const flat = asFlat(shape)

    if (format === "svg") {
        if (flat == null) {
            throw new FormatError(
                "the script rendered a 3-D shape, which cannot be written " +
                    "as SVG; use --stl or --step instead",
            )
        }
        return new TextEncoder().encode(flat.toSVG())
    }

    if (solid == null) {
        if (flat != null) {
            throw new FormatError(
                `the script rendered a 2-D drawing, which cannot be ` +
                    `written as ${format.toUpperCase()}; give it thickness ` +
                    `first -- say, \`.sketchOnPlane("XY").extrude(10)\` -- ` +
                    `or write it as SVG with --svg`,
            )
        }
        throw new FormatError(
            "the script rendered something that is neither a replicad " +
                "shape nor a drawing",
        )
    }

    const blob = format === "stl" ? solid.blobSTL() : solid.blobSTEP()
    return new Uint8Array(await blob.arrayBuffer())
}
