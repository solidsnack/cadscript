// A bolt flange, to show a script drawing in two dimensions before giving
// the drawing thickness, and using a Deno standard library along the way.
//
//   cadscript examples/flange.ts --bolts 8 --step -o flange.step

import { object, option } from "@optique/core"
import { float, integer } from "@optique/core/valueparser"
import { message } from "@optique/core/message"
import type { FluentParser } from "@optique/core/fluent"
import { sumOf } from "@std/collections/sum-of"
import { drawCircle } from "replicad"
import type { AnyShape, Drawing } from "replicad"

interface Options {
    radius: number
    bore: number
    bolts: number
    boltRadius: number
    thickness: number
}

const parser: FluentParser<"sync", Options, unknown> = object({
    radius: option("--radius", float({ min: 1 }), {
        description: message`The outer radius of the flange.`,
    }).withDefault(40),
    bore: option("--bore", float({ min: 1 }), {
        description: message`The radius of the central bore.`,
    }).withDefault(20),
    bolts: option("--bolts", integer({ min: 0 }), {
        description: message`How many bolt holes to space around it.`,
    }).withDefault(5),
    boltRadius: option("--bolt-radius", float({ min: 0.5 }), {
        description: message`The radius of each bolt hole.`,
    }).withDefault(2),
    thickness: option("--thickness", float({ min: 0.1 }), {
        description: message`How thick the flange is.`,
    }).withDefault(5),
})

export default {
    parser,

    render(options: Options): Promise<AnyShape> {
        const { radius, bore, bolts, boltRadius, thickness } = options

        let drawing: Drawing = drawCircle(radius).cut(drawCircle(bore))
        const angles: number[] = []
        for (let i = 0; i < bolts; i++) {
            const angle = (2 * Math.PI * i) / bolts
            angles.push(angle)
            const centre = (radius + bore) / 2
            drawing = drawing.cut(
                drawCircle(boltRadius).translate(
                    centre * Math.cos(angle),
                    centre * Math.sin(angle),
                ),
            )
        }

        // A standard library import, purely to show that it works.
        console.debug(
            `bolt angles sum to ${sumOf(angles, (a) => a).toFixed(3)} rad`,
        )

        return Promise.resolve(
            drawing.sketchOnPlane("XY").extrude(thickness),
        )
    },
}
