// The sandbox the script runs in.
//
// Everything a CAD script contributes -- module evaluation, parsing and
// rendering -- happens here, in a worker whose permissions are narrower than
// the interpreter's: it may read and write the working directory, and nothing
// else. In particular it cannot reach the network, spawn a process, or import
// anything that was not compiled into the interpreter.

import { getDocPage, parse } from "@optique/core/parser"
import { formatDocPage } from "@optique/core/doc"
import { formatMessage } from "@optique/core/message"
import initOpenCascade from "replicad-opencascadejs"
import { setOC } from "replicad"

import { serialize } from "./format.ts"
import { ScriptError } from "./errors.ts"
import { ALLOWED } from "./registry.ts"
import { checkScript } from "./script.ts"
import type { CadScript } from "./script.ts"
import type { HelpJob, Job, RenderJob, Reply } from "./protocol.ts"

const encoder = new TextEncoder()

/**
 * Sends the script's console output to standard error, so that standard
 * output carries only the model, and hides `console.debug()` unless the
 * interpreter was asked to show it.
 */
function routeConsole(debug: boolean): void {
    const write = (...values: unknown[]) => {
        const line = values
            .map((v) => typeof v === "string" ? v : Deno.inspect(v))
            .join(" ")
        Deno.stderr.writeSync(encoder.encode(line + "\n"))
    }
    const hush = () => {}
    console.log = write
    console.info = write
    console.warn = write
    console.error = write
    console.debug = debug ? write : hush
    console.trace = debug ? write : hush
}

function describe(error: unknown): string {
    if (error instanceof Error) {
        return error.stack && error.stack.includes(error.message)
            ? error.stack
            : `${error.name}: ${error.message}`
    }
    return String(error)
}

/**
 * Explains a module that could not be found in terms of the allow list, so
 * that a script importing something the interpreter does not carry gets an
 * answer rather than a resolver error.
 */
function explainMissing(error: unknown): string | undefined {
    const text = error instanceof Error ? error.message : String(error)
    const quoted = text.match(/["'`]([^"'`]+)["'`]/)
    const specifier = quoted?.[1]
    if (specifier == null) return undefined
    if (ALLOWED.includes(specifier)) return undefined
    const family = specifier.split("/").slice(0, 2).join("/")
    const near = ALLOWED.filter((a) => a.startsWith(family)).slice(0, 6)
    const hint = near.length > 0
        ? ` Did you mean one of: ${near.join(", ")}?`
        : ` The interpreter carries the Deno standard library (except` +
            ` @std/http and @std/net), Optique and replicad.`
    return `the script imports ${specifier}, which the interpreter does ` +
        `not provide.${hint}`
}

async function load(url: string): Promise<CadScript> {
    let module: { default?: unknown }
    try {
        module = await import(url)
    } catch (error) {
        const missing = explainMissing(error)
        if (missing != null) throw new ScriptError(missing)
        throw new Error(`cannot load the script: ${describe(error)}`)
    }
    const complaint = checkScript(module.default)
    if (complaint != null) {
        throw new ScriptError(
            `the script is not a CAD script: ${complaint}. A CAD script ` +
                `exports a default object with a \`.parser\` and an async ` +
                `\`.render()\`.`,
        )
    }
    return module.default as CadScript
}

async function help(job: HelpJob, script: CadScript): Promise<Reply> {
    const page = await getDocPage(script.parser, [...job.args])
    if (page == null) {
        return { ok: false, error: "the script's parser has no help to show" }
    }
    const text = formatDocPage(job.program, page, {
        colors: !Deno.noColor && Deno.stderr.isTerminal(),
        showDefault: true,
    })
    return { ok: true, kind: "help", text }
}

async function render(job: RenderJob, script: CadScript): Promise<Reply> {
    const result = await parse(script.parser, [...job.args])
    if (!result.success) {
        return { ok: false, error: formatMessage(result.error) }
    }

    console.debug("[cadscript] initializing OpenCascade")
    const instantiate = initOpenCascade as unknown as (
        options: {
            wasmBinary: Uint8Array
            print: (line: string) => void
            printErr: (line: string) => void
        },
    ) => Promise<unknown>
    // OpenCascade narrates every STEP export. That is the library talking,
    // not the script, so it goes to debug rather than to the script's own
    // output.
    const oc = await instantiate({
        wasmBinary: new Uint8Array(job.wasm),
        print: (line) => console.debug(line),
        printErr: (line) => console.debug(line),
    })
    // deno-lint-ignore no-explicit-any
    setOC(oc as any)

    console.debug("[cadscript] rendering")
    const shape = await script.render(result.value)
    if (shape == null) {
        return { ok: false, error: "the script's render() returned nothing" }
    }

    console.debug(`[cadscript] serializing as ${job.format}`)
    const bytes = await serialize(shape, job.format)
    return { ok: true, kind: "render", bytes }
}

self.onmessage = async (event: MessageEvent<Job>) => {
    const job = event.data
    routeConsole(job.debug)
    let reply: Reply
    try {
        const script = await load(job.script)
        reply = job.kind === "help"
            ? await help(job, script)
            : await render(job, script)
    } catch (error) {
        reply = {
            ok: false,
            error: error instanceof ScriptError
                ? error.message
                : describe(error),
        }
    }
    self.postMessage(reply)
    self.close()
}
