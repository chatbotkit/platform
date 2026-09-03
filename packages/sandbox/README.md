# @chatbotkit-dev/sandbox

The community default implementation of `@chatbotkit-dev/sandbox-spec`. Runs an
agent's shell commands and code in this process, against an in-memory
filesystem, using [`just-bash`](https://github.com/vercel-labs/just-bash).

There is nothing to configure and nothing to install. `shell/exec` works on a
laptop with no container runtime, no daemon and no credentials, which is the
reason the sandbox module was made swappable in the first place.

## This one actually works

The other community defaults in this repository are placeholders with a pulse:
`@chatbotkit-dev/email` logs to the console, `@chatbotkit-dev/respond`
refuses outright. This package is not one of those. `just-bash`
implements bash — parser, interpreter, 70-plus commands including `grep`, `sed`,
`awk` and `jq` — in TypeScript, and vendors CPython and QuickJS builds for
`runCode`. Agents run real commands and get real output.

It is still not a production sandbox, and the reasons are structural rather than
incidental:

- **Nothing is isolated from this process.** The interpreter's own boundaries are
  the only boundaries. Agent code cannot reach the host filesystem or the
  network, but it shares the heap and the event loop with the application.
- **Nothing survives a restart.** Every environment lives in a `Map`.
- **Nothing bounds the blast radius.** A runaway script consumes this process's
  CPU. `just-bash` execution limits cap command counts and output size, not wall
  clock across the whole process.

An implementation that puts each environment in its own VM is what those three
points are worth, and is what a hosted deployment should install.

The package enforces that itself. Under `NODE_ENV=production` every operation
throws `SANDBOX_UNAVAILABLE` before a shell is created, `assertConfigured`
fails with the same message, and the platform's configuration suite therefore
fails on a production install that still resolves to this package. There is no
switch: this package is for `pnpm dev`, and a deployment that wants agent code
execution overrides `@chatbotkit-dev/sandbox` with an isolated implementation.

## What differs from a real machine

Everything an agent does through this package is real, except that **nothing
survives a call except the filesystem**:

| | here | a VM-backed backend |
| --- | --- | --- |
| files written by a command | persist | persist |
| `cd` | ends with the command | persists in the session |
| shell variables | end with the command | persist in the session |
| `runCode` bindings | end with the call | persist in the session |
| storage mounts | none | `/space`, `/conversation` |

The first four are pinned by tests, so a future version of `just-bash` that
starts carrying shell state has to come and update this table.

The mount row matters more than it looks. This package reports `mountedPaths: []`
and never calls `resolve()` on a mount plan, so no scoped credentials are ever
issued for a mount that will not happen — and the platform, which builds the
model's view of reachable folders from what came back, does not offer the agent a
`/space` that is not there.

`sessionId` is accepted and changes nothing about where a command runs. That is
deliberate: the state a session exists to isolate is not carried between calls
under any arrangement, so a shell per session would have implied an isolation it
could not provide. Sessions of one sandbox share its filesystem, which is the one
thing they genuinely do share.

## Running the interpreters

Python and JavaScript are enabled. Two things are worth knowing:

- **They need the Node build.** `just-bash` selects a bundle from the resolver's
  export conditions, and its browser build ships a `python3` that reports
  `command not available in browser environments`. Anything running this under a
  jsdom-flavoured resolver gets that build.
- **Bundlers should leave it alone.** The CPython loader resolves its wasm
  relative to `import.meta.url`. Under a bundler that rewrites or inlines the
  module, that resolution fails with `TypeError: Invalid URL`. A deployment
  serving on this default should keep `just-bash` external — for Next.js, add it
  to `serverComponentsExternalPackages`.

The package itself imports `just-bash` lazily, so the vendored interpreters are
not loaded by merely importing the platform.

Both constraints are why the interpreter tests are not in the jest suite: jest's
experimental VM module loader hits exactly the second one. They live in
`scripts/verify-interpreters.js`:

```bash
pnpm script:verify-interpreters
```

The JavaScript interpreter runs on a QuickJS worker that keeps the event loop
alive after the command finishes, which is why that script exits explicitly. A
long-lived process calling `runCode` with `language: 'javascript'` should expect
the same.

## Installing something else

Replace it with a pnpm override in the root `pnpm-workspace.yaml`:

```yaml
overrides:
  '@chatbotkit-dev/sandbox': npm:your-sandbox-implementation@*
```

An implementation is any package whose default export satisfies
`SandboxProvider` from `@chatbotkit-dev/sandbox-spec`.

Remove the override and the platform falls back here and still runs. That is the
property this package exists to preserve.
