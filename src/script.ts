// The contract a CAD script has to satisfy.

import type { Mode, Parser } from "@optique/core/parser"
import type { AnyShape, Drawing } from "replicad"

/**
 * What a script's `render` may hand back.
 *
 * Replicad's `Drawing` is two dimensional, so it can only be written as
 * SVG.  The solid modelling formats -- STL and STEP -- need a three
 * dimensional shape, which a drawing becomes once it is given thickness:
 *
 * ```ts
 * drawing.sketchOnPlane("XY").extrude(10)
 * ```
 */
export type Renderable = Drawing | AnyShape

/**
 * A CAD script's default export.
 *
 * The parser is an Optique parser -- usually a `FluentParser`, which is what
 * `object({...})` and friends return -- and its result is handed straight to
 * `render`.
 *
 * ```ts
 * import { object, option } from "@optique/core"
 * import { float } from "@optique/core/valueparser"
 * import { drawCircle } from "replicad"
 *
 * export default {
 *     parser: object({
 *         radius: option("-r", "--radius", float()).withDefault(10),
 *     }),
 *     async render({ radius }) {
 *         return drawCircle(radius).sketchOnPlane("XY").extrude(2)
 *     },
 * } satisfies CadScript<{ radius: number }>
 * ```
 */
export interface CadScript<T = never> {
    readonly parser: Parser<Mode, T, unknown>
    render(options: T): Renderable | Promise<Renderable>
}

/**
 * Checks that a module's default export looks like a {@link CadScript},
 * returning the reason it does not when it does not.
 */
export function checkScript(value: unknown): string | undefined {
    if (value == null || typeof value !== "object") {
        return "its default export is not an object or class instance"
    }
    const script = value as Partial<CadScript>
    const parser = script.parser as { parse?: unknown } | undefined
    if (parser == null || typeof parser !== "object") {
        return "its default export has no `.parser` property"
    }
    if (typeof parser.parse !== "function") {
        return "its `.parser` is not an Optique parser"
    }
    if (typeof script.render !== "function") {
        return "its default export has no `.render()` method"
    }
    return undefined
}
