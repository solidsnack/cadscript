// The interpreter's own command line: how its arguments are told apart from
// the script's, and the Optique parser for the ones it keeps.

import { object, or } from "@optique/core/constructs"
import { argument, flag, option } from "@optique/core/primitives"
import { string } from "@optique/core/valueparser"
import { message } from "@optique/core/message"
import { defineProgram } from "@optique/core/program"

import { tidy } from "./message.ts"

export const VERSION = "0.1.0"

/** The interpreter's options that take a value of their own. */
const VALUED = new Set(["-o", "--output"])

/** The interpreter's options that stand alone. */
const FLAGS = new Set([
    "--stl",
    "--step",
    "-d",
    "--debug",
    "--version",
    "-h",
    "-?",
    "--help",
])

export interface Split {
    /** Arguments the interpreter parses for itself. */
    readonly interpreter: string[]
    /** Arguments reserved for the script. */
    readonly script: string[]
}

/**
 * Divides a command line between the interpreter and the script it runs.
 *
 * The interpreter claims the options it knows and the first bare word, which
 * is the path to the script; everything else is the script's. A `--` ends the
 * interpreter's share, so a script can be given options that would otherwise
 * be taken -- `cadscript model.ts -- -o inner` passes `-o inner` along.
 */
export function split(args: readonly string[]): Split {
    const interpreter: string[] = []
    const script: string[] = []
    let seenScript = false

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === "--") {
            script.push(...args.slice(i + 1))
            break
        }
        if (FLAGS.has(arg)) {
            interpreter.push(arg)
            continue
        }
        if (VALUED.has(arg)) {
            interpreter.push(arg)
            // A missing value is left to Optique to complain about.
            if (i + 1 < args.length) interpreter.push(args[++i])
            continue
        }
        const equals = arg.indexOf("=")
        if (equals > 0 && VALUED.has(arg.slice(0, equals))) {
            interpreter.push(arg)
            continue
        }
        if (!seenScript && !arg.startsWith("-")) {
            interpreter.push(arg)
            seenScript = true
            continue
        }
        script.push(arg)
    }

    return { interpreter, script }
}

export const parser = object({
    format: or(
        flag("--stl", {
            description: tidy(
                message`Write an STL file. This is the default.`,
            ),
        }).map(() => "stl" as const),
        flag("--step", {
            description: tidy(message`Write a STEP file.`),
        }).map(() => "step" as const),
    ).withDefault("stl" as const),
    output: option("-o", "--output", string({ metavar: "PATH" }), {
        description: tidy(
            message`Where to write the model. Defaults to standard
            output, which may also be named as \`-\`.`,
        ),
    }).optional(),
    debug: flag("-d", "--debug", {
        description: tidy(message`Log what the interpreter is doing, and show
            \`console.debug()\` from the script.`),
    }).optional(),
    version: flag("--version", {
        description: tidy(message`Show the interpreter's version.`),
    }).optional(),
    help: flag("-h", "-?", "--help", {
        description: tidy(message`Show this help, or the script's help when a
            script is named.`),
    }).optional(),
    script: argument(string({ metavar: "SCRIPT" }), {
        description: tidy(message`The CAD script to run.`),
    }).optional(),
})

export const program = defineProgram({
    parser,
    metadata: {
        name: "cadscript",
        version: VERSION,
        brief: tidy(message`Run a CAD script and write the model it renders.`),
        description: tidy(message`A CAD script exports a default object with an
            Optique parser and an async render function that returns a
            replicad shape. Options the interpreter does not claim are passed
            to the script's parser.`),
    },
})
