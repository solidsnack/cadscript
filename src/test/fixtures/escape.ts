// Tries to break out of the sandbox. Every one of these should be refused.

import { object } from "@optique/core"
import { drawCircle } from "replicad"

export default {
    parser: object({}),
    async render() {
        for (
            const [what, attempt] of [
                ["net", () => fetch("https://example.com")],
                [
                    "run",
                    () => new Deno.Command("echo", { args: ["hi"] }).output(),
                ],
                ["env", () => Promise.resolve(Deno.env.get("HOME"))],
                ["read /etc", () => Deno.readTextFile("/etc/hosts")],
                ["write /tmp", () => Deno.writeTextFile("/tmp/escaped", "x")],
            ] as [string, () => Promise<unknown>][]
        ) {
            try {
                await attempt()
                console.log(`ESCAPED: ${what}`)
            } catch (error) {
                const name = error instanceof Error ? error.name : "?"
                console.log(`refused: ${what} (${name})`)
            }
        }
        return drawCircle(5).sketchOnPlane("XY").extrude(1)
    },
}
