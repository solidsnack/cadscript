// Renders a two dimensional drawing, which is not something that can be
// written as STL or STEP. It breaks the contract on purpose, to check that
// the interpreter says so rather than failing obscurely.

import { object } from "@optique/core"
import { drawCircle } from "replicad"
import type { AnyShape } from "replicad"

export default {
    parser: object({}),
    render(): Promise<AnyShape> {
        return Promise.resolve(drawCircle(5) as unknown as AnyShape)
    },
}
