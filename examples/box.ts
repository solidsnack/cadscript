// A rounded box, to show the shape of a CAD script.
//
//   cadscript examples/box.ts --width 40 -o box.stl
//   cadscript examples/box.ts --help

import { object, option } from "@optique/core"
import { float } from "@optique/core/valueparser"
import { message } from "@optique/core/message"
import { drawRoundedRectangle } from "replicad"

interface Options {
    width: number
    depth: number
    height: number
    radius: number
}

export default {
    parser: object({
        width: option("-w", "--width", float({ min: 1 }), {
            description: message`How wide the box is, in millimetres.`,
        }).withDefault(30),
        depth: option("-D", "--depth", float({ min: 1 }), {
            description: message`How deep the box is, in millimetres.`,
        }).withDefault(20),
        height: option("-H", "--height", float({ min: 1 }), {
            description: message`How tall the box is, in millimetres.`,
        }).withDefault(10),
        radius: option("-r", "--radius", float({ min: 0 }), {
            description: message`The radius of the rounded corners.`,
        }).withDefault(3),
    }),

    render({ width, depth, height, radius }: Options) {
        console.debug(`box ${width} x ${depth} x ${height}, r${radius}`)
        return Promise.resolve(
            drawRoundedRectangle(width, depth, radius)
                .sketchOnPlane("XY")
                .extrude(height),
        )
    },
}
