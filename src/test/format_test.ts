import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert"

import { FormatError, serialize } from "../format.ts"
import { checkScript } from "../script.ts"
import type { Renderable } from "../script.ts"

// The serializer recognizes replicad's shapes by the methods they carry, so
// these stand in for the real things without an OpenCascade instance.

const solid = {
    blobSTL: () => new Blob([new Uint8Array([1, 2, 3])]),
    blobSTEP: () => new Blob(["ISO-10303-21;"]),
} as unknown as Renderable

const drawing = {
    toSVG: () => "<svg/>",
} as unknown as Renderable

Deno.test("a solid is written as STL", async () => {
    const bytes = await serialize(solid, "stl")
    assertEquals(bytes, new Uint8Array([1, 2, 3]))
})

Deno.test("a solid is written as STEP", async () => {
    const bytes = await serialize(solid, "step")
    assertStringIncludes(new TextDecoder().decode(bytes), "ISO-10303-21")
})

Deno.test("a drawing cannot be written as STL", async () => {
    const error = await assertRejects(
        () => serialize(drawing, "stl"),
        FormatError,
    )
    assertStringIncludes(error.message, "extrude")
})

Deno.test("a drawing cannot be written as STEP either", async () => {
    const error = await assertRejects(
        () => serialize(drawing, "step"),
        FormatError,
    )
    assertStringIncludes(error.message, "2-D drawing")
})

Deno.test("something that is not a solid is refused", async () => {
    const error = await assertRejects(
        () => serialize({} as Renderable, "stl"),
        FormatError,
    )
    assertStringIncludes(error.message, "has to return a solid")
})

Deno.test("checkScript accepts a well formed script", () => {
    const script = { parser: { parse: () => {} }, render: () => {} }
    assertEquals(checkScript(script), undefined)
})

Deno.test("checkScript explains what is missing", () => {
    assertStringIncludes(checkScript(null) ?? "", "not an object")
    assertStringIncludes(checkScript({}) ?? "", "no `.parser`")
    assertStringIncludes(
        checkScript({ parser: {} }) ?? "",
        "not an Optique parser",
    )
    assertStringIncludes(
        checkScript({ parser: { parse: () => {} } }) ?? "",
        "no `.render()`",
    )
})
