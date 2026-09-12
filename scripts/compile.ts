// Builds the `cadscript` binary.
//
// The interpreter needs to read scripts and write models, and it needs the
// unstable worker options in order to give the script a narrower sandbox than
// its own. It deliberately does not take --allow-import: everything a script
// is allowed to import is compiled in, so nothing has to be fetched at run
// time, and nothing outside the allow list can be reached.
//
// Usage: deno run -A scripts/compile.ts [-o OUTPUT]

const output = (() => {
    const i = Deno.args.indexOf("-o")
    return i >= 0 && i + 1 < Deno.args.length ? Deno.args[i + 1] : "cadscript"
})()

const args = [
    "compile",
    "--allow-read",
    "--allow-write",
    "--unstable-worker-options",
    // The worker is reached through `new Worker(import.meta.resolve(...))`,
    // which is not part of the statically analysed module graph.
    "--include",
    "src/worker.ts",
    "--output",
    output,
    "src/mod.ts",
]

console.error(`deno ${args.join(" ")}`)
const command = new Deno.Command(Deno.execPath(), {
    args,
    stdout: "inherit",
    stderr: "inherit",
})
const { code } = await command.output()
Deno.exit(code)
