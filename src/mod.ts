// cadscript -- a shell interpreter for CAD scripts.
//
// The interpreter parses the options it knows, hands the rest to the script,
// and runs the script in a worker that is allowed to touch only the working
// directory. What the script renders comes back as bytes, which the
// interpreter writes where it was told to.

import { parse } from "@optique/core/parser"
import { getDocPage } from "@optique/core/parser"
import { formatDocPage } from "@optique/core/doc"
import { formatMessage } from "@optique/core/message"

import { parser, program, split, VERSION } from "./cli.ts"
import { isBinary } from "./format.ts"
import type { Format } from "./format.ts"
import type { Job, Reply } from "./protocol.ts"

function fail(message: string, code = 1): never {
    console.error(`cadscript: ${message}`)
    Deno.exit(code)
}

function makeLog(debug: boolean): (...values: unknown[]) => void {
    return debug
        ? (...values) => console.error("[cadscript]", ...values)
        : () => {}
}

/** Shows the interpreter's own help, as opposed to a script's. */
function ownHelp(): string {
    const page = getDocPage(parser, [])
    if (page == null) return "cadscript [OPTIONS] SCRIPT [SCRIPT OPTIONS]"
    const described = {
        ...page,
        brief: program.metadata.brief,
        description: program.metadata.description,
    }
    return formatDocPage(program.metadata.name, described, {
        colors: !Deno.noColor && Deno.stdout.isTerminal(),
        showDefault: true,
    })
}

/**
 * The directories the worker may read. The working directory is always in
 * reach; a script kept somewhere else needs its own directory too, or it
 * could not be loaded at all.
 */
function readable(script: URL): string[] {
    const directory = new URL(".", script).pathname
    const cwd = Deno.cwd().endsWith("/") ? Deno.cwd() : `${Deno.cwd()}/`
    return directory.startsWith(cwd) ? ["./"] : ["./", directory]
}

/** Runs one job in a sandboxed worker and waits for its answer. */
function runSandboxed(job: Job, read: string[]): Promise<Reply> {
    const worker = new Worker(import.meta.resolve("./worker.ts"), {
        type: "module",
        deno: {
            permissions: {
                read,
                write: ["./"],
                net: false,
                run: false,
                env: false,
                ffi: false,
                import: false,
                sys: false,
            },
        },
    })
    return new Promise<Reply>((resolve) => {
        worker.onmessage = (event: MessageEvent<Reply>) => {
            resolve(event.data)
            worker.terminate()
        }
        worker.onerror = (event) => {
            event.preventDefault()
            resolve({ ok: false, error: event.message })
            worker.terminate()
        }
        worker.postMessage(job, job.kind === "render" ? [job.wasm] : [])
    })
}

/** Reads the OpenCascade WASM that the worker is not allowed to reach. */
async function openCascade(): Promise<ArrayBuffer> {
    const url = import.meta.resolve("replicad-opencascadejs/wasm")
    const bytes = await Deno.readFile(new URL(url))
    return bytes.buffer as ArrayBuffer
}

async function write(
    bytes: Uint8Array,
    output: string | undefined,
    format: Format,
): Promise<void> {
    if (output == null || output === "-") {
        if (Deno.stdout.isTerminal() && isBinary(format)) {
            fail(
                `refusing to write ${format.toUpperCase()} to the terminal; ` +
                    `name a file with --output`,
            )
        }
        await Deno.stdout.write(bytes)
        return
    }
    await Deno.writeFile(output, bytes)
}

async function main(argv: readonly string[]): Promise<void> {
    const parts = split(argv)
    const parsed = parse(parser, parts.interpreter)
    if (!parsed.success) {
        console.error(`cadscript: ${formatMessage(parsed.error)}`)
        console.error(ownHelp())
        Deno.exit(2)
    }
    const options = parsed.value
    const log = makeLog(options.debug === true)
    log("interpreter arguments:", parts.interpreter)
    log("script arguments:", parts.script)

    if (options.version === true) {
        console.log(`cadscript ${VERSION}`)
        return
    }

    if (options.script == null) {
        if (options.help === true) {
            console.log(ownHelp())
            return
        }
        console.error("cadscript: no script was named")
        console.error(ownHelp())
        Deno.exit(2)
    }

    const script = new URL(options.script, `file://${Deno.cwd()}/`)
    try {
        const info = await Deno.stat(script)
        if (!info.isFile) fail(`${options.script} is not a file`)
    } catch {
        fail(`cannot read ${options.script}`)
    }

    const read = readable(script)
    log("sandbox may read:", read)

    const common = {
        script: script.href,
        args: parts.script,
        debug: options.debug === true,
    }
    const job: Job = options.help === true
        ? { kind: "help", program: `cadscript ${options.script}`, ...common }
        : {
            kind: "render",
            format: options.format,
            wasm: await openCascade(),
            ...common,
        }
    log(`running the script to ${
        job.kind === "help" ? "show help" : "render"
    }`)

    const reply = await runSandboxed(job, read)
    if (!reply.ok) fail(reply.error)

    if (reply.kind === "help") {
        console.log(reply.text)
        return
    }

    log(`writing ${reply.bytes.length} bytes`)
    await write(reply.bytes, options.output, options.format)
}

if (import.meta.main) {
    await main(Deno.args)
}
