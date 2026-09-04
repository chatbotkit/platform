# @chatbotkit-dev/sandbox

The community default implementation of `@chatbotkit-dev/sandbox-spec`. Runs an
agent's shell commands and code in [AgentOS](https://github.com/rivet-dev/agentos):
a userspace Linux - virtual filesystem, process table, PTYs and a virtual
network stack - owned by a native sidecar process that brokers every guest
syscall. Nothing the guest does touches the host filesystem, host sockets or
host processes.

There is nothing to configure. `shell/exec` works on a laptop with no container
runtime, no daemon and no credentials, and it works the same way in the
community image.

## What an agent gets

- **A shell and coreutils**, as WebAssembly: `sh`, `bash`, the GNU coreutils,
  `sed`, `grep`, `awk`, `find`, `diff`, `tar`, `gzip`.
- **Node.js**, on V8 with a Node surface, and a working `npm`. `npm install`
  in `/workspace` installs real packages that `node` and `import` resolve.
- **Network**, open by default. The sidecar refuses loopback, private and
  link-local destinations by resolved address whatever policy says, so the
  application, its database, cache and object store are unreachable from
  inside a sandbox, and so is a cloud metadata endpoint.
- **A workspace that lasts.** `/workspace` is the working directory of every
  command and a real directory on the host, mounted read-write, so what an
  agent writes or installs there survives the VM being reaped and the
  application restarting.
- **The platform's stores, live.** When the platform asks for a space at
  `/space` or a conversation's files at `/conversation`, a host-side driver
  serves that path straight from the object store through the storage
  contract: an object is a file, a prefix is a directory, an empty directory
  is the marker the space browser writes. What the agent writes is what the
  platform reads back, at once, and no store credential ever enters the VM.
  `mountedPaths` reports exactly these paths.
- **`runCode` sessions that carry state.** A `runCode` session names a live
  interpreter context, so a binding made by one call is there on the next.
  Shell `exec` does not: each command runs in a fresh process (see below).

## What it does not have

- **Python.** AgentOS documents CPython through Pyodide, but the published
  sidecar builds at the pinned version ship without it. The package probes
  once and reports Python as `UNSUPPORTED_OPERATION` with a message saying so,
  rather than shelling out to something approximate, and removes the
  runtime's empty `python`/`python3` placeholder stubs from each VM so a
  `python3` in a shell command fails with `command not found` instead of
  running nothing and exiting 0. Bumping the runtime the day it ships turns
  Python on with no change here.
- **`git`, `curl` and the other registry command packages.** They resolve and
  project into the VM, but their binaries arrive without the executable bit at
  this version and refuse to run. Node's `fetch` and `npx` cover most of what
  agents reached for them for.
- **Storage mounts with the store's own semantics.** See below: they are
  served by a driver in this process, so they are as slow as the store and as
  plain as an object store is - no symlinks, no partial writes, a rename is a
  copy and a delete.
- **Fast pipelines.** A pipe between two commands can stall for the
  runtime's ten-second blocking-read limit at end of stream, once per stage.
  Upstream defect, tracked in
  [rivet-dev/agentos#1959](https://github.com/rivet-dev/agentos/issues/1959).
  @todo check the ticket when bumping the runtime and drop this entry once
  a release fixes it.
- **A clean `ls -la` of `/workspace`.** The listing prints, then the command
  exits 1 with `Invalid argument` from the mount's directory entries at this
  version. `ls -l` is unaffected.
- **Kernel isolation.** The boundary is the sidecar, a Rust process, not the
  kernel. That removes the kernel-escape class of bug and adds the sidecar's
  own. CPU is shared with the application, and limits are per-VM budgets
  rather than cgroups.

## Persistence, precisely

| | persists |
| --- | --- |
| files under `/workspace` | across calls, VM reaping and restarts |
| files elsewhere (`/tmp`, `$HOME`) | across calls, until the VM is reaped |
| `cd` and shell variables between `exec` calls | no - each command is a fresh process |
| interpreter bindings in a `runCode` session | until the VM is reaped |
| `/space` and `/conversation` | in the object store, shared with the platform |

A VM is reaped after fifteen minutes without a call. A workspace nobody has
used for thirty days is removed from disk.

Shell `exec` runs each command in its own process rather than a live shell, so
a `cd` or a variable ends with the command that made it - the same divergence
from a real machine the previous in-process default had. It is not only
faithful to what a fresh process can offer: a lingering shell is the one thing
a published sidecar at this version hangs on, so every operation on a VM is run
one at a time and none is left running between calls.

## Configuration

Documented here because the package owns it; the platform does not need it to
run.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SANDBOX_DATA_DIR` | `<tmpdir>/chatbotkit-sandbox` | Where workspaces live, one directory per `sandboxId`. Point it at a volume in a deployment; the compose files use `/data/sandbox` |

## Requirements

The sidecar is a native binary the package resolves for the current platform:
Linux x64 and arm64 with glibc, and macOS. Alpine images cannot load it; the
platform image builds on Debian for this reason. `assertConfigured` starts a VM
and runs a command, so a host that cannot run the sidecar fails the
configuration suite rather than the first agent turn.

The package imports AgentOS lazily, so the sidecar and its command packages are
not touched by merely importing the platform.

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
