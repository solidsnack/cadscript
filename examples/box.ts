// A rounded box, to show the shape of a CAD script.
//
//   cadscript examples/box.ts --width 40 -o box.stl
//   cadscript examples/box.ts --help

import { object, option } from "@optique/core"
import { float } from "@optique/core/valueparser"
import { message } from "@optique/core/message"
import type { FluentParser } from "@optique/core/fluent"
import { drawRoundedRectangle } from "replicad"
import type { AnyShape } from "replicad"

interface Options {
    width: number
    depth: number
    height: number
    radius: number
}

// Naming the parser's type ties it to `Options`, so that the parser and
// `render` cannot drift apart without the compiler saying so. The state
// parameter is the parser's own bookkeeping, which nothing here needs.
const parser: FluentParser<"sync", Options, unknown> = object({
    width: option("--width", float({ min: 1 }), {
        description: message`How wide the box is, in millimetres.`,
    }).withDefault(30),
    depth: option("--depth", float({ min: 1 }), {
        description: message`How deep the box is, in millimetres.`,
    }).withDefault(20),
    height: option("--height", float({ min: 1 }), {
        description: message`How tall the box is, in millimetres.`,
    }).withDefault(10),
    radius: option("--radius", float({ min: 0 }), {
        description: message`The radius of the rounded corners.`,
    }).withDefault(5),
})

export default {
    parser,

    render({ width, depth, height, radius }: Options): Promise<AnyShape> {
        console.debug(`box ${width} x ${depth} x ${height}, r${radius}`)
        return Promise.resolve(
            drawRoundedRectangle(width, depth, radius)
                .sketchOnPlane("XY")
                .extrude(height),
        )
    },
}
