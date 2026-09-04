// @note the community default for code execution.
//
// Agent commands run inside AgentOS (`@rivet-dev/agentos-core`): a userspace
// Linux - virtual filesystem, process table, PTYs and a virtual network stack -
// owned by a native sidecar process that brokers every guest syscall. Nothing
// the guest does touches the host filesystem, host sockets or host processes.
// The shell and coreutils are WebAssembly, JavaScript runs on V8 behind a Node
// surface with a working `npm`, and outbound network is open, with loopback,
// private and link-local destinations refused at the socket by the sidecar.
//
// The decision worth explaining is what persists. The root filesystem is an
// ephemeral overlay per VM. The working directory, `/workspace`, is a real
// directory on the host under `SANDBOX_DATA_DIR`, mounted read-write, so what
// an agent writes or installs there survives the VM being reaped for idleness
// and the application restarting. Nothing else does: each command runs in a
// fresh process, so a `cd` or a shell variable ends with the command that made
// it, and a `runCode` binding ends with the call - the same shape the previous
// in-process default had, and pinned by the tests.
//
// Two things about the runtime shape the code more than the contract does, and
// both are here rather than discovered:
//
// Every operation on one VM is serialized through a queue. A published sidecar
// at this version wedges - permanently, for that VM - if a second guest process
// is spawned while an earlier one is still running, so two overlapping commands
// are a hang, not a race. One command at a time makes that impossible; a
// conversation issues them in order anyway.
//
// Python is the honest gap. AgentOS documents CPython through Pyodide, but the
// published sidecar builds at this version ship without it, so `python` is
// probed once and reported as `UNSUPPORTED_OPERATION` rather than shelled out to
// something approximate - see `assertPython`.
import type {
  SandboxErrorCode,
  SandboxErrorLike,
  SandboxExecOptions,
  SandboxExecResult,
  SandboxProvider,
  SandboxReadFileOptions,
  SandboxReadFileResult,
  SandboxResources,
  SandboxRunCodeOptions,
  SandboxRunCodeResult,
  SandboxWriteFileOptions,
  SandboxWriteFileResult,
} from '@chatbotkit-dev/sandbox-spec'

import type { AgentOs } from '@rivet-dev/agentos-core'
import type * as AgentOsNamespace from '@rivet-dev/agentos-core'

import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type AgentOsModule = typeof AgentOsNamespace

type AgentOsCreateOptions = NonNullable<
  Parameters<AgentOsModule['AgentOs']['create']>[0]
>

type ExecutionResult = Awaited<ReturnType<AgentOs['process']['exec']>>

export class SandboxError extends Error implements SandboxErrorLike {
  readonly sandbox = true as const

  readonly code: SandboxErrorCode

  readonly detail?: string

  constructor(
    code: SandboxErrorCode,
    message: string,
    options?: { detail?: string; cause?: unknown }
  ) {
    super(message)

    this.name = 'SandboxError'
    this.code = code
    this.detail = options?.detail

    // @note assigned rather than passed to `super`, because the two-argument
    // `Error` constructor is ES2022 and these packages compile against ES2021.

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/** Where every command starts, and the one path that outlives the VM. */
const WORKSPACE = '/workspace'

/** A VM nobody has used for this long is disposed; its workspace stays. */
const IDLE_TTL_MS = 15 * 60 * 1000

/** A workspace nobody has used for this long is removed from disk. */
const STALE_WORKSPACE_MS = 30 * 24 * 60 * 60 * 1000

const REAP_INTERVAL_MS = 60 * 60 * 1000

/** Applies when the platform states no `diskMb`; enough for an `npm install`. */
const DEFAULT_DISK_MB = 1024

const PYTHON_UNAVAILABLE_MESSAGE =
  'python is not available in this sandbox: the installed AgentOS sidecar ships without its Python runtime. Shell and JavaScript are available; for Python, override @chatbotkit-dev/sandbox with an implementation of @chatbotkit-dev/sandbox-spec that provides it'

/**
 * @note outbound network is open on purpose - `npm` and `git` are why agents
 * get a sandbox at all. The sidecar refuses loopback, private and link-local
 * destinations by resolved address regardless of policy, so the stack's own
 * services are unreachable whatever name they go by; the patterns here refuse
 * the names that resolve there before a lookup is made.
 */
const PERMISSIONS: NonNullable<AgentOsCreateOptions['permissions']> = {
  fs: 'allow',
  childProcess: 'allow',
  process: 'allow',
  env: 'allow',
  binding: 'allow',
  network: {
    default: 'allow',
    rules: [
      {
        mode: 'deny',
        operations: ['*'],
        patterns: ['localhost', '*.localhost', '*.local', '*.internal'],
      },
    ],
  },
}

// --- loading ---

/**
 * @note imported lazily and cached, because of what it weighs: the package
 * resolves a native sidecar binary and a directory of WebAssembly commands, and
 * a module-scope import would make every consumer that merely imports the
 * platform pay for that whether or not an agent ever runs a command.
 */
let loading: Promise<AgentOsModule> | undefined

function load(): Promise<AgentOsModule> {
  if (!loading) {
    loading = import('@rivet-dev/agentos-core')
  }

  return loading
}

// --- workspaces ---

function getDataDir(): string {
  return process.env.SANDBOX_DATA_DIR || join(tmpdir(), 'chatbotkit-sandbox')
}

/**
 * @note a caller's `sandboxId` becomes a directory name when it is already safe
 * as one, so an operator looking at the data directory sees the ids the
 * platform uses; anything else is hashed rather than escaped.
 */
function toWorkspacePath(sandboxId: string): string {
  const name = /^[A-Za-z0-9_-]{1,128}$/.test(sandboxId)
    ? sandboxId
    : createHash('sha256').update(sandboxId).digest('hex')

  return join(getDataDir(), name)
}

let lastReap = 0

/**
 * Removes workspaces nobody has touched in a month.
 *
 * @note every conversation that runs a command leaves a directory behind, and
 * nothing else ever deletes one. The directory's mtime is bumped on each use
 * (see `touch`), so it is a fair record of last activity.
 */
function reapStaleWorkspaces(dataDir: string): void {
  if (Date.now() - lastReap < REAP_INTERVAL_MS) {
    return
  }

  lastReap = Date.now()

  try {
    for (const name of readdirSync(dataDir)) {
      const workspace = join(dataDir, name)

      try {
        const stats = statSync(workspace)

        if (
          stats.isDirectory() &&
          Date.now() - stats.mtimeMs > STALE_WORKSPACE_MS
        ) {
          rmSync(workspace, { recursive: true, force: true })
        }
      } catch {
        // @note a workspace disappearing under us is the outcome wanted here
      }
    }
  } catch {
    // @note no data directory yet, nothing to reap
  }
}

// --- vms ---

interface Entry {
  vm: Promise<AgentOs>
  workspace: string
  contexts: Set<string>
  /** Serializes operations; see the module header on why overlap is a hang. */
  queue: Promise<unknown>
  timer?: ReturnType<typeof setTimeout>
}

const entries = new Map<string, Entry>()

async function createVm(
  workspace: string,
  resources: SandboxResources | undefined
): Promise<AgentOs> {
  const { AgentOs, createHostDirBackend } = await load()

  mkdirSync(workspace, { recursive: true })

  return await AgentOs.create({
    permissions: PERMISSIONS,

    // @note the guest runs as the same uid and gid as this process. The
    // workspace mount gives files the guest's identity on the host, and a
    // non-root process cannot hand a file to any uid but its own - so with
    // the runtime's default of 1000, every write from a container running as
    // another user is created empty and then refused
    ...(process.getuid && process.getgid
      ? { user: { uid: process.getuid(), gid: process.getgid() } }
      : {}),

    mounts: [
      {
        path: WORKSPACE,
        plugin: createHostDirBackend({ hostPath: workspace, readOnly: false }),
        readOnly: false,
      },
    ],

    // @note advisory in the contract, honoured where the runtime has a knob:
    // the filesystem cap applies to the ephemeral root, and the memory figure
    // to the guest JavaScript heap. Nothing here can cap the sidecar's CPU.
    limits: {
      resources: {
        maxFilesystemBytes:
          (resources?.diskMb ?? DEFAULT_DISK_MB) * 1024 * 1024,
      },

      ...(resources?.memoryMb
        ? { jsRuntime: { v8HeapLimitMb: resources.memoryMb } }
        : {}),
    },
  })
}

function touch(sandboxId: string, entry: Entry): void {
  if (entry.timer) {
    clearTimeout(entry.timer)
  }

  entry.timer = setTimeout(() => {
    void disposeEntry(sandboxId)
  }, IDLE_TTL_MS)

  entry.timer.unref?.()

  try {
    const now = new Date()

    utimesSync(entry.workspace, now, now)
  } catch {
    // @note the workspace is created by `createVm`, which may not have run yet
  }
}

function getEntry(
  sandboxId: string,
  resources: SandboxResources | undefined
): Entry {
  let entry = entries.get(sandboxId)

  if (!entry) {
    const dataDir = getDataDir()

    reapStaleWorkspaces(dataDir)

    const workspace = toWorkspacePath(sandboxId)

    entry = {
      vm: createVm(workspace, resources),
      workspace,
      contexts: new Set(),
      queue: Promise.resolve(),
    }

    entries.set(sandboxId, entry)

    // @note a VM that failed to start must not be cached as one that did; the
    // caller that asked gets the rejection, the next caller gets a fresh try

    const created = entry

    created.vm.catch(() => {
      if (entries.get(sandboxId) === created) {
        entries.delete(sandboxId)
      }
    })
  }

  touch(sandboxId, entry)

  return entry
}

async function disposeEntry(sandboxId: string): Promise<void> {
  const entry = entries.get(sandboxId)

  if (!entry) {
    return
  }

  entries.delete(sandboxId)

  if (entry.timer) {
    clearTimeout(entry.timer)
  }

  try {
    const vm = await entry.vm

    await vm.dispose()
  } catch {
    // @note a VM that never started, or a sidecar already gone, is disposed
  }
}

/**
 * Disposes every VM this process holds. Workspaces on disk are kept.
 *
 * @note exported for tests and for a long-lived process that wants the memory
 * back. Nothing in the platform calls it - the contract has no teardown, since
 * VMs are reaped for idleness anyway.
 */
export async function reset(): Promise<void> {
  await Promise.all(
    [...entries.keys()].map((sandboxId) => disposeEntry(sandboxId))
  )
}

// --- errors ---

function rejectionCode(error: unknown): string | undefined {
  return (error as { detail?: { code?: string } })?.detail?.code
}

function toSandboxError(
  error: unknown,
  fallback: SandboxErrorCode
): SandboxError {
  if (error instanceof SandboxError) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)

  const options = { detail: message, cause: error }

  if (/timed out|timeout/i.test(message)) {
    return new SandboxError('EXEC_TIMEOUT', message, options)
  }

  if (
    (fallback === 'FILE_READ_FAILED' || fallback === 'FILE_WRITE_FAILED') &&
    /ENOENT|no such file/i.test(message)
  ) {
    return new SandboxError('FILE_NOT_FOUND', message, options)
  }

  // @note a VM the sidecar no longer knows, or a sidecar that is gone: the
  // entry is dropped by the caller so the next call starts a fresh one

  if (
    rejectionCode(error) === 'invalid_state' ||
    /disposed|sidecar (process|exited|closed)/i.test(message)
  ) {
    return new SandboxError('SANDBOX_UNAVAILABLE', message, options)
  }

  return new SandboxError(fallback, message, options)
}

/**
 * Runs `fn` against the sandbox's VM, one operation at a time, translating
 * failures and forgetting a VM that turned out to be gone.
 *
 * @note the serialization is the point, not an incidental lock - see the
 * module header. `fn` is enqueued behind whatever is already running on this
 * VM, so two commands never have processes alive at once.
 */
function withVm<T>(
  options: { sandboxId: string; resources?: SandboxResources },
  fallback: SandboxErrorCode,
  fn: (vm: AgentOs, entry: Entry) => Promise<T>
): Promise<T> {
  const { sandboxId, resources } = options

  const entry = getEntry(sandboxId, resources)

  const run = async (): Promise<T> => {
    try {
      const vm = await entry.vm

      return await fn(vm, entry)
    } catch (raw) {
      const error = toSandboxError(raw, fallback)

      if (error.code === 'SANDBOX_UNAVAILABLE') {
        void disposeEntry(sandboxId)
      }

      throw error
    }
  }

  const result = entry.queue.then(run, run)

  entry.queue = result.catch(() => {})

  return result
}

// --- results ---

interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
  error?: string
}

/**
 * @note the runtime reports three things the contract folds into two. A
 * command that ran and failed carries an exit code and is an ordinary result; a
 * command that could not run at all - a name the shell cannot find, a spawn the
 * policy refused - carries none and becomes `exitCode` 127 with `error` set,
 * which is how the platform tells the model it was not the command's doing. A
 * timeout is thrown, as the contract's `EXEC_TIMEOUT`, so the model is told to
 * try something shorter rather than to debug a command that was fine.
 *
 * @throws EXEC_TIMEOUT when the command outran its timeout, EXEC_FAILED when it
 * was cancelled
 */
function toRunResult(
  result: ExecutionResult,
  timeout: number | undefined
): RunResult {
  if (result.outcome === 'timed_out') {
    throw new SandboxError(
      'EXEC_TIMEOUT',
      `command did not finish within ${timeout}ms`,
      { detail: result.error?.message }
    )
  }

  if (result.outcome === 'cancelled') {
    throw new SandboxError('EXEC_FAILED', 'command was cancelled', {
      detail: result.error?.message,
    })
  }

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''

  if (result.exitCode === undefined) {
    if (result.outcome === 'succeeded') {
      return { exitCode: 0, stdout, stderr }
    }

    const message = result.error.message

    return { exitCode: 127, stdout, stderr: stderr || message, error: message }
  }

  return { exitCode: result.exitCode, stdout, stderr }
}

// --- interpreters ---

let pythonAvailable: Promise<boolean> | undefined

/**
 * @note probed rather than assumed, and cached for the process, so that the
 * day the sidecar ships its Python runtime nothing here has to change. A probe
 * that fails for a reason other than the runtime being absent is not cached,
 * since that is the sidecar having a bad moment rather than a fact about it.
 *
 * @throws UNSUPPORTED_OPERATION when the sidecar has no Python runtime
 */
async function assertPython(vm: AgentOs): Promise<void> {
  if (!pythonAvailable) {
    pythonAvailable = vm.python
      .execute('print(1)', { output: { capture: 'all' }, timeoutMs: 60_000 })
      .then((result) => {
        if (result.outcome === 'succeeded') {
          return true
        }

        if (/command not found/i.test(result.error?.message ?? '')) {
          return false
        }

        throw new Error(result.error?.message ?? result.outcome)
      })

    pythonAvailable.catch(() => {
      pythonAvailable = undefined
    })
  }

  if (!(await pythonAvailable)) {
    throw new SandboxError('UNSUPPORTED_OPERATION', PYTHON_UNAVAILABLE_MESSAGE)
  }
}

async function ensureContext(
  vm: AgentOs,
  entry: Entry,
  contextId: string
): Promise<void> {
  if (entry.contexts.has(contextId)) {
    return
  }

  try {
    await vm.createContext(contextId)
  } catch (error) {
    if (!/exists/i.test(error instanceof Error ? error.message : '')) {
      throw error
    }
  }

  entry.contexts.add(contextId)
}

/**
 * Runs a code payload in a named interpreter context, so a name bound by one
 * call is still there on the next.
 *
 * @throws UNSUPPORTED_OPERATION for Python when the sidecar lacks it,
 * EXEC_TIMEOUT on a timeout
 */
async function interpret(
  vm: AgentOs,
  entry: Entry,
  options: {
    language: 'python' | 'javascript'
    code: string
    contextId: string
    env: Record<string, string> | undefined
    timeout: number | undefined
  }
): Promise<RunResult> {
  const { language, code, contextId, env, timeout } = options

  if (language === 'python') {
    await assertPython(vm)
  }

  await ensureContext(vm, entry, contextId)

  const executionOptions = {
    contextId,
    cwd: WORKSPACE,
    output: { capture: 'all' as const },
    ...(env ? { env } : {}),
    ...(timeout ? { timeoutMs: timeout } : {}),
  }

  const execute = () =>
    language === 'python'
      ? vm.python.execute(code, executionOptions)
      : vm.javascript.execute(code, executionOptions)

  let result: ExecutionResult

  try {
    result = await execute()
  } catch (error) {
    // @note a context whose last run died badly refuses further work until it
    // is reset; the reset loses its bindings, which is still better than the
    // session being dead for the rest of the conversation

    if (
      rejectionCode(error) === 'execution_failed' &&
      /must be reset/i.test(error instanceof Error ? error.message : '')
    ) {
      await vm.contexts.reset(contextId)

      result = await execute()
    } else {
      throw error
    }
  }

  return toRunResult(result, timeout)
}

// --- operations ---

async function exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
  const {
    sandboxId,
    sessionId,
    sessionType,
    cmd,
    timeout,
    env,
    files,
    resources,
  } = options

  // @note `options.mounts` is deliberately never read. Nothing is mounted and
  // nothing pretends to be: `mountedPaths` comes back empty, which is how the
  // platform knows not to tell the model about a `/space` that is not there,
  // and `resolve` is never called, so no credentials are minted for a mount
  // that will not happen.

  return await withVm(
    { sandboxId, resources },
    'EXEC_FAILED',
    async (vm, entry) => {
      if (files) {
        for (const file of files) {
          await vm.filesystem.writeFile(file.path, file.contents)
        }
      }

      // @note a typed session means the command *is* code in that language,
      // which is what the contract's `sessionType` says

      if (sessionType && sessionType !== 'bash') {
        const result = await interpret(vm, entry, {
          language: sessionType === 'python' ? 'python' : 'javascript',
          code: cmd,
          contextId: sessionId ?? `${sessionType}-default`,
          env,
          timeout,
        })

        return { ...result, mountedPaths: [] }
      }

      // @note `sessionId` shares the filesystem and nothing else: the command
      // runs in its own process, so a `cd` or a variable set here is gone on
      // the next call. A live shell per session would look like isolation
      // while providing none, and worse, a lingering shell is exactly the
      // process the sidecar hangs on - see the module header.

      const result = await vm.process.exec(cmd, {
        cwd: WORKSPACE,
        output: { capture: 'all' },
        ...(env ? { env } : {}),
        ...(timeout ? { timeoutMs: timeout } : {}),
      })

      return { ...toRunResult(result, timeout), mountedPaths: [] }
    }
  )
}

async function runCode(
  options: SandboxRunCodeOptions
): Promise<SandboxRunCodeResult> {
  const { sandboxId, sessionId, code, language, timeout, env, resources } =
    options

  return await withVm(
    { sandboxId, resources },
    'EXEC_FAILED',
    async (vm, entry) => {
      const result = await interpret(vm, entry, {
        language: language === 'python' ? 'python' : 'javascript',
        code,
        contextId: sessionId ?? `${language}-default`,
        env,
        timeout,
      })

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        mountedPaths: [],
      }
    }
  )
}

async function readFile(
  options: SandboxReadFileOptions
): Promise<SandboxReadFileResult> {
  const { sandboxId, path, resources } = options

  return await withVm(
    { sandboxId, resources },
    'FILE_READ_FAILED',
    async (vm) => {
      const contents = new TextDecoder().decode(
        await vm.filesystem.readFile(path)
      )

      return { contents, mountedPaths: [] }
    }
  )
}

async function writeFile(
  options: SandboxWriteFileOptions
): Promise<SandboxWriteFileResult> {
  const { sandboxId, path, contents, resources } = options

  // @note `mode` and `owner` are accepted and ignored. Every process in the VM
  // runs as its one user, so honouring them would mean inventing a permission
  // model the guest does not enforce.

  return await withVm(
    { sandboxId, resources },
    'FILE_WRITE_FAILED',
    async (vm) => {
      await vm.filesystem.writeFile(path, contents)

      return { mountedPaths: [] }
    }
  )
}

/**
 * @note there is nothing to configure, but there is something to check: the
 * sidecar is a native binary for this platform, and an install that resolved
 * but cannot start is a deployment fault best found here rather than at the
 * first agent turn. The VM used for the check has no workspace, so the check
 * leaves nothing on disk.
 *
 * @throws when the data directory cannot be created or the sidecar cannot run
 */
async function assertConfigured(): Promise<void> {
  try {
    mkdirSync(getDataDir(), { recursive: true })
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/sandbox cannot create its data directory ${getDataDir()}, so no sandbox workspace could be kept; point SANDBOX_DATA_DIR at a writable directory: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  try {
    const { AgentOs } = await load()

    const vm = await AgentOs.create({ permissions: PERMISSIONS })

    try {
      const result = await vm.process.exec('echo ok', {
        output: { capture: 'all' },
        timeoutMs: 30_000,
      })

      if (result.outcome !== 'succeeded' || result.stdout?.trim() !== 'ok') {
        throw new Error(
          `the sandbox answered unexpectedly (${result.outcome}, exit ${result.exitCode})`
        )
      }
    } finally {
      await vm.dispose()
    }
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/sandbox could not start a sandbox, so agent shell commands would fail at the point of use. The AgentOS sidecar is a native glibc binary for Linux x64/arm64 and macOS; Alpine images need a glibc base instead: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

const provider: SandboxProvider = {
  exec,
  runCode,
  readFile,
  writeFile,
  assertConfigured,
}

export default provider
