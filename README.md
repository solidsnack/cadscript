# cadscript

A shell interpreter for CAD scripts. A script says what options it takes and
how to turn them into a shape; `cadscript` parses the command line, runs the
script in a sandbox, and writes the model.

```console
$ deno task compile   # builds tmp/dist/cadscript
$ tmp/dist/cadscript examples/box.ts --width 40 --height 15 -o box.stl
$ tmp/dist/cadscript examples/flange.ts --bolts 8 --step -o flange.step
$ tmp/dist/cadscript examples/box.ts --help
```

## Writing a script

A script's default export has two properties: an Optique `parser`, and an async
`render` that takes what the parser produced and returns a replicad shape.

```ts
import { object, option } from "@optique/core"
import { float } from "@optique/core/valueparser"
import { message } from "@optique/core/message"
import { drawCircle } from "replicad"

export default {
    parser: object({
        radius: option("-r", "--radius", float({ min: 1 }), {
            description: message`The radius of the disc.`,
        }).withDefault(10),
    }),

    async render({ radius }: { radius: number }) {
        return drawCircle(radius).sketchOnPlane("XY").extrude(2)
    },
}
```

Run it, and the script's own options appear on the command line:

```console
$ cadscript disc.ts --radius 25 -o disc.stl
```

### What a script may import

Everything a script can import is compiled into the interpreter; nothing is
fetched when a script runs, and nothing outside the list below can be reached.

- **Optique** -- `@optique/core` and its submodules, and `@optique/temporal`.
- **replicad** -- the `replicad` module.
- **The Deno standard library** -- every `@std` package and submodule, except
  `@std/http` and `@std/net`, which are about network access; `@std/webgpu`,
  which needs a GPU the sandbox does not offer; and `@std/internal`, which is
  not a public library.

Importing anything else fails with a message saying so, rather than a resolver
error. `deno task registry` regenerates the list from JSR.

### What `render` returns

STL and STEP describe solids, so `render` returns replicad's `AnyShape`.
Replicad's `Drawing` is flat, and has to be given thickness first:

```ts
drawing.sketchOnPlane("XY").extrude(10) // now it can be written
```

Returning a drawing anyway is an error that says as much.

## The command line

The interpreter takes the options it knows, and reserves the rest for the
script.

- `--stl` -- write an STL file.
- `--step` -- write a STEP file.
- `-o`, `--output PATH` -- where to write the model. Standard output by
  default, which may also be named as `-`.
- `-d`, `--debug` -- log what the interpreter is doing, and show
  `console.debug()` from the script.
- `--version` -- show the interpreter's version.
- `-h`, `-?`, `--help` -- show help; the script's, when a script is named.

The first bare word is the script. Anything the interpreter does not recognize
goes to the script's parser, and a `--` sends everything after it to the script
regardless:

```console
$ cadscript model.ts -o out.stl -- -o inner-part
```

Here `-o out.stl` is the interpreter's and `-o inner-part` is the script's.

The model goes to standard output when no `-o` is given, so scripts compose:

```console
$ cadscript examples/flange.ts --step | grep -c CARTESIAN_POINT
```

`cadscript` will not write a model to a terminal: redirect it, or name a file.
Everything the script prints goes to standard error, so standard output carries
only the model.

### Choosing the format

`--stl` and `--step` settle the format outright. Without either, the name of
the output file decides:

- no extension, or writing to standard output -- STL;
- `.stl`, `.step` or `.stp` -- the format that extension names;
- any other extension -- `cadscript` will not guess, and asks for `--stl` or
  `--step`.

When an option and the file extension disagree, the option wins and `cadscript`
says so:

```console
$ cadscript model.ts --stl -o part.step
cadscript: warning: --stl overrides the `.step` output name; writing STL
```

A lone `-` means standard output. To write a file that really is called `-`,
give a path with a slash in it -- `./-`.

## The sandbox

The interpreter runs with `--allow-read` and `--allow-write`. The script -- its
module evaluation, its parser and its `render` -- runs in a worker with less
than that: it may read and write the working directory, and nothing else. No
network, no subprocesses, no environment, no FFI, and no imports beyond what
was compiled in.

The script's directory is added to the worker's read permission when the script
lives outside the working directory, since otherwise it could not be loaded at
all.

OpenCascade's WASM is read by the interpreter and handed to the worker over
`postMessage`, so the worker needs no read access to the module cache.

## Development

```console
$ deno task check      # type check
$ deno task test       # unit tests, plus end-to-end tests if built
$ deno task compile    # build tmp/dist/cadscript
$ deno task fmt        # format
```

The tests live in `src/test/`, and the scripts they run the interpreter against
in `src/test/fixtures/`. The end-to-end tests are skipped until the binary
exists, and the tests expect to be run from the project root.

`deno task check` reaches the sources and the tests but not the fixtures: one
of them imports `@std/http` on purpose, to check that the interpreter turns
that away, and so it cannot type check.

Running `src/mod.ts` directly with `deno run` will not execute a script: a
script's bare imports can only be resolved from the module graph compiled into
the binary, and the sandboxed worker is not allowed to fetch them. Build the
binary and run that.
