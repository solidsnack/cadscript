// End to end tests against the compiled interpreter.
//
// The sandbox only behaves as intended once everything a script may import
// has been compiled in, so these tests need the binary. They are skipped
// when it has not been built; `deno task compile` builds it.

import { assertEquals, assertStringIncludes } from "@std/assert"

const BINARY = new URL("../tmp/dist/cadscript", import.meta.url).pathname

async function built(): Promise<boolean> {
    try {
        return (await Deno.stat(BINARY)).isFile
    } catch {
        return false
    }
}

const ignore = !(await built())

interface Run {
    code: number
    stdout: Uint8Array
    stderr: string
}

async function cadscript(...args: string[]): Promise<Run> {
    const command = new Deno.Command(BINARY, { args })
    const { code, stdout, stderr } = await command.output()
    return { code, stdout, stderr: new TextDecoder().decode(stderr) }
}

function text(run: Run): string {
    return new TextDecoder().decode(run.stdout)
}

Deno.test({
    name: "e2e: renders a solid as STL",
    ignore,
    async fn() {
        const run = await cadscript("examples/box.ts", "--width", "12")
        assertEquals(run.code, 0)
        // A binary STL is an 80 byte header, then a triangle count.
        assertEquals(run.stdout.length > 84, true)
    },
})

Deno.test({
    name: "e2e: renders a solid as STEP, leaving standard output clean",
    ignore,
    async fn() {
        const run = await cadscript("examples/box.ts", "--step")
        assertEquals(run.code, 0)
        assertStringIncludes(text(run), "ISO-10303-21")
        // OpenCascade chatters while writing STEP; it must not land in the
        // model.
        assertEquals(text(run).includes("Step File Name"), false)
    },
})

Deno.test({
    name: "e2e: renders the flange as STEP",
    ignore,
    async fn() {
        const run = await cadscript(
            "examples/flange.ts",
            "--bolts",
            "8",
            "--step",
        )
        assertEquals(run.code, 0)
        assertStringIncludes(text(run), "ISO-10303-21")
    },
})

Deno.test({
    name: "e2e: shows the script's help, not the interpreter's",
    ignore,
    async fn() {
        const run = await cadscript("examples/box.ts", "--help")
        assertEquals(run.code, 0)
        assertStringIncludes(text(run), "--width")
        assertEquals(text(run).includes("--step"), false)
    },
})

Deno.test({
    name: "e2e: shows its own help when no script is named",
    ignore,
    async fn() {
        const run = await cadscript("--help")
        assertEquals(run.code, 0)
        assertStringIncludes(text(run), "--step")
    },
})

Deno.test({
    name: "e2e: refuses an import that is not compiled in",
    ignore,
    async fn() {
        const run = await cadscript("tests/fixtures/bad-import.ts")
        assertEquals(run.code, 1)
        assertStringIncludes(run.stderr, "does not provide")
    },
})

Deno.test({
    name: "e2e: reports a parse failure from the script's own parser",
    ignore,
    async fn() {
        const run = await cadscript("examples/box.ts", "--width", "nope")
        assertEquals(run.code, 1)
        assertStringIncludes(run.stderr, "valid number")
    },
})

Deno.test({
    name: "e2e: refuses to write a drawing as STL",
    ignore,
    async fn() {
        const run = await cadscript("tests/fixtures/flat.ts")
        assertEquals(run.code, 1)
        assertStringIncludes(run.stderr, "2-D drawing")
    },
})

Deno.test({
    name: "e2e: hides console.debug unless asked",
    ignore,
    async fn() {
        const quiet = await cadscript("examples/box.ts")
        assertEquals(quiet.stderr.includes("box 30 x 20"), false)
        const loud = await cadscript("examples/box.ts", "-d")
        assertStringIncludes(loud.stderr, "box 30 x 20")
    },
})

Deno.test({
    name: "e2e: the sandbox refuses network, subprocesses and the wider disk",
    ignore,
    async fn() {
        const run = await cadscript("tests/fixtures/escape.ts")
        assertEquals(run.code, 0)
        assertEquals(run.stderr.includes("ESCAPED"), false)
        for (const what of ["net", "run", "env", "read /etc", "write /tmp"]) {
            assertStringIncludes(run.stderr, `refused: ${what}`)
        }
    },
})

Deno.test({
    name: "e2e: infers STEP from a .step output name",
    ignore,
    async fn() {
        const out = await Deno.makeTempFile({ suffix: ".step" })
        try {
            const run = await cadscript("examples/box.ts", "-o", out)
            assertEquals(run.code, 0)
            const written = await Deno.readTextFile(out)
            assertStringIncludes(written, "ISO-10303-21")
        } finally {
            await Deno.remove(out)
        }
    },
})

Deno.test({
    name: "e2e: infers STL from a .stl output name",
    ignore,
    async fn() {
        const out = await Deno.makeTempFile({ suffix: ".stl" })
        try {
            const run = await cadscript("examples/box.ts", "-o", out)
            assertEquals(run.code, 0)
            const written = await Deno.readFile(out)
            assertEquals(written.length > 84, true)
            const head = new TextDecoder().decode(written.slice(0, 20))
            assertEquals(head.includes("ISO-10303"), false)
        } finally {
            await Deno.remove(out)
        }
    },
})

Deno.test({
    name: "e2e: asks about an output name it cannot read a format from",
    ignore,
    async fn() {
        const run = await cadscript("examples/box.ts", "-o", "/tmp/x.dat")
        assertEquals(run.code, 2)
        assertStringIncludes(run.stderr, ".dat")
        assertStringIncludes(run.stderr, "--stl")
    },
})

Deno.test({
    name: "e2e: warns when the option and the output name disagree",
    ignore,
    async fn() {
        const out = await Deno.makeTempFile({ suffix: ".step" })
        try {
            const run = await cadscript("examples/box.ts", "--stl", "-o", out)
            assertEquals(run.code, 0)
            assertStringIncludes(run.stderr, "warning")
            // The option wins: an STL, despite the name.
            const head = new TextDecoder().decode(
                (await Deno.readFile(out)).slice(0, 20),
            )
            assertEquals(head.includes("ISO-10303"), false)
        } finally {
            await Deno.remove(out)
        }
    },
})

Deno.test({
    name: "e2e: a plain - is standard output",
    ignore,
    async fn() {
        const run = await cadscript("examples/box.ts", "--step", "-o", "-")
        assertEquals(run.code, 0)
        assertStringIncludes(text(run), "ISO-10303-21")
    },
})
