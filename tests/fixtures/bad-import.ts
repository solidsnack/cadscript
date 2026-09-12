import { serveFile } from "@std/http/file-server"
import { object } from "@optique/core"
import { drawCircle } from "replicad"

export default {
    parser: object({}),
    render() {
        console.log(typeof serveFile)
        return Promise.resolve(
            drawCircle(5).sketchOnPlane("XY").extrude(1),
        )
    },
}
