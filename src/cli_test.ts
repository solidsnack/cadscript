import { assertEquals } from "@std/assert"
import { parse } from "@optique/core/parser"

import { parser, split } from "./cli.ts"

Deno.test("split keeps the interpreter's options and the script path", () => {
    const { interpreter, script } = split([
        "--step",
        "model.ts",
        "-o",
        "out.step",
        "-w",
        "40",
    ])
    assertEquals(interpreter, ["--step", "model.ts", "-o", "out.step"])
    assertEquals(script, ["-w", "40"])
})

Deno.test("split reserves what it does not recognize for the script", () => {
    const { interpreter, script } = split([
        "model.ts",
        "--width=40",
        "--verbose",
        "extra",
    ])
    assertEquals(interpreter, ["model.ts"])
    assertEquals(script, ["--width=40", "--verbose", "extra"])
})

Deno.test("split gives everything after -- to the script", () => {
    const { interpreter, script } = split([
        "-d",
        "model.ts",
        "--",
        "-o",
        "inner",
        "--step",
    ])
    assertEquals(interpreter, ["-d", "model.ts"])
    assertEquals(script, ["-o", "inner", "--step"])
})

Deno.test("split takes --output=PATH as one token", () => {
    const { interpreter, script } = split(["model.ts", "--output=out.stl"])
    assertEquals(interpreter, ["model.ts", "--output=out.stl"])
    assertEquals(script, [])
})

Deno.test("split takes only the first bare word as the script", () => {
    const { interpreter, script } = split(["model.ts", "second", "third"])
    assertEquals(interpreter, ["model.ts"])
    assertEquals(script, ["second", "third"])
})

Deno.test("split leaves a valueless -o for the parser to reject", () => {
    const { interpreter } = split(["model.ts", "-o"])
    assertEquals(interpreter, ["model.ts", "-o"])
})

Deno.test("the format defaults to STL", () => {
    const result = parse(parser, ["model.ts"])
    assertEquals(result.success, true)
    if (result.success) {
        assertEquals(result.value.format, "stl")
        assertEquals(result.value.script, "model.ts")
        assertEquals(result.value.output, undefined)
    }
})

Deno.test("each format option is understood", () => {
    for (
        const [option, format] of [["--stl", "stl"], ["--step", "step"], [
            "--svg",
            "svg",
        ]]
    ) {
        const result = parse(parser, [option, "model.ts"])
        assertEquals(result.success, true)
        if (result.success) assertEquals(result.value.format, format)
    }
})

Deno.test("the format options exclude one another", () => {
    const result = parse(parser, ["--stl", "--step", "model.ts"])
    assertEquals(result.success, false)
})

Deno.test("help and version need no script", () => {
    for (const option of ["-h", "-?", "--help", "--version"]) {
        const result = parse(parser, [option])
        assertEquals(result.success, true, `${option} should parse`)
    }
})
