import { assertEquals, assertStringIncludes } from "@std/assert"

import { chooseFormat, extensionOf, STDOUT } from "../format.ts"

Deno.test("extensionOf reads the extension off a path", () => {
    assertEquals(extensionOf("out.stl"), "stl")
    assertEquals(extensionOf("/tmp/out.STEP"), "step")
    assertEquals(extensionOf("./a.b/out.stp"), "stp")
    assertEquals(extensionOf("archive.tar.gz"), "gz")
})

Deno.test("extensionOf finds no extension where there is none", () => {
    assertEquals(extensionOf("out"), undefined)
    assertEquals(extensionOf("/tmp/out"), undefined)
    // A directory may have a dot in it without lending one to the file.
    assertEquals(extensionOf("/a.b/out"), undefined)
    // A leading dot makes a hidden file, not an extension.
    assertEquals(extensionOf(".stl"), undefined)
    assertEquals(extensionOf("/tmp/.stl"), undefined)
    // A trailing dot names no extension either.
    assertEquals(extensionOf("out."), undefined)
})

Deno.test("a known extension picks the format", () => {
    for (
        const [path, format] of [
            ["out.stl", "stl"],
            ["out.step", "step"],
            ["out.stp", "step"],
            ["OUT.STL", "stl"],
        ] as const
    ) {
        const choice = chooseFormat(undefined, path)
        assertEquals(choice.ok, true, path)
        if (choice.ok) {
            assertEquals(choice.format, format)
            assertEquals(choice.warning, undefined)
        }
    }
})

Deno.test("no extension means STL", () => {
    for (const path of ["out", "/tmp/out", undefined, STDOUT]) {
        const choice = chooseFormat(undefined, path)
        assertEquals(choice.ok, true)
        if (choice.ok) assertEquals(choice.format, "stl")
    }
})

Deno.test("an extension that means nothing here is asked about", () => {
    const choice = chooseFormat(undefined, "out.dat")
    assertEquals(choice.ok, false)
    if (!choice.ok) {
        assertStringIncludes(choice.error, ".dat")
        assertStringIncludes(choice.error, "--stl")
    }
})

Deno.test("the option decides, whatever the file is called", () => {
    for (
        const [explicit, path] of [
            ["step", "out.dat"],
            ["stl", "out.dat"],
            ["stl", "out"],
            ["step", undefined],
        ] as const
    ) {
        const choice = chooseFormat(explicit, path)
        assertEquals(choice.ok, true)
        if (choice.ok) {
            assertEquals(choice.format, explicit)
            assertEquals(choice.warning, undefined)
        }
    }
})

Deno.test("the option and the extension disagreeing is warned about", () => {
    const choice = chooseFormat("stl", "out.step")
    assertEquals(choice.ok, true)
    if (choice.ok) {
        assertEquals(choice.format, "stl")
        assertStringIncludes(choice.warning ?? "", "--stl")
        assertStringIncludes(choice.warning ?? "", ".step")
    }
})

Deno.test("an option agreeing with the extension says nothing", () => {
    const choice = chooseFormat("step", "out.stp")
    assertEquals(choice.ok, true)
    if (choice.ok) assertEquals(choice.warning, undefined)
})

Deno.test("a plain - is standard output, but ./- is a file", () => {
    const out = chooseFormat(undefined, STDOUT)
    assertEquals(out.ok && out.format, "stl")
    // `./-` has no extension, so it falls to the default rather than being
    // mistaken for standard output.
    const file = chooseFormat(undefined, "./-")
    assertEquals(file.ok && file.format, "stl")
    const named = chooseFormat(undefined, "./-.step")
    assertEquals(named.ok && named.format, "step")
})
