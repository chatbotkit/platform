// @note the community default for code execution.
//
// This one is unusual among the public defaults in this repository, and the
// difference is worth stating rather than discovering. `@chatbotkit-dev/email`
// logs to the console: it exists so the platform imports and boots, not so
// anyone runs on it. This package genuinely runs the agent's commands. `just-bash`
// interprets bash in-process against an in-memory filesystem - no daemon, no
// container, no host binaries - so `shell/exec` works on a laptop with nothing
// installed and nothing configured.
//
// That makes it the default a deployment can actually develop against, which
// was the point of splitting the module. It is not what should be serving
// production traffic: everything lives in this process's heap, so it is gone
// when the process is, and an infinite loop in agent code is an infinite loop
// in the application. An implementation that puts each environment in its own
// VM is what those two sentences are worth.
//
// Two behaviours differ from a real machine in ways a reader should know about
// before trusting a local reproduction, and both are the same shape: nothing
// survives a call except the filesystem. A `cd` does not move where the next
// command starts, a shell variable set in one command is unset in the next, and
// a name bound by one `runCode` is unbound by the next. A backend holding a
// live shell and a live interpreter keeps all three.
//
// This is measured rather than assumed - see the tests, which pin each of them
// so that a future version of `just-bash` changing its mind has to come here and
// say so.

import type {
  SandboxErrorCode,
  SandboxErrorLike,
  SandboxExecOptions,
  SandboxExecResult,
  SandboxProvider,
  SandboxReadFileOptions,
  SandboxReadFileResult,
  SandboxRunCodeOptions,
  SandboxRunCodeResult,
  SandboxWriteFileOptions,
  SandboxWriteFileResult,
} from '@chatbotkit-dev/sandbox-spec'

import type * as JustBash from 'just-bash'

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
    // The property itself is read at runtime by the error reporter all the
    // same, so the chain survives.

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/**
 * @note one shell per sandbox, and `sessionId` therefore changes nothing about
 * where a command runs. That is not a shortcut; it is the honest encoding of
 * what this interpreter does. A second `Bash` per session would look like
 * session isolation while providing none, because the state a session is
 * supposed to isolate - working directory, shell variables - is not carried
 * between calls by either arrangement. What sessions do share is the
 * filesystem, and one instance per sandbox already gives exactly that.
 */
const sandboxes = new Map<string, JustBash.Bash>()

const CODE_DIRECTORY = '/tmp/cbk'

/**
 * @note `just-bash` is imported lazily and cached, not because the environment
 * needs resolving - there is nothing to configure - but because of what it
 * weighs. The package vendors a CPython build for its `python3` command, and a
 * module-scope import means every consumer that merely imports the platform
 * pays for it whether or not an agent ever runs a command.
 */
let loading: Promise<typeof JustBash> | undefined

function load(): Promise<typeof JustBash> {
  if (!loading) {
    loading = import('just-bash')
  }

  return loading
}

async function getShell(sandboxId: string): Promise<JustBash.Bash> {
  let bash = sandboxes.get(sandboxId)

  if (!bash) {
    const { Bash: BashClass, InMemoryFs } = await load()

    bash = new BashClass({
      fs: new InMemoryFs(),

      // @note both interpreters are off by default in `just-bash` because they
      // widen what untrusted code can reach. They are on here because this
      // process is the sandbox - the isolation being relied upon is the
      // interpreter's, and turning off the interpreters does not add any.
      python: true,
      javascript: true,
    })

    sandboxes.set(sandboxId, bash)
  }

  return bash
}

function toSandboxError(error: unknown, fallback: SandboxErrorCode) {
  if (error instanceof SandboxError) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)

  if (error instanceof Error && error.name === 'AbortError') {
    return new SandboxError('EXEC_TIMEOUT', message, {
      detail: message,
      cause: error,
    })
  }

  if (/no such file|not found|enoent/i.test(message)) {
    return new SandboxError('FILE_NOT_FOUND', message, {
      detail: message,
      cause: error,
    })
  }

  return new SandboxError(fallback, message, { detail: message, cause: error })
}

/**
 * @note `AbortSignal.timeout` rather than a race against a promise, because
 * `just-bash` accepts a signal and stops interpreting when it fires. A race
 * would return on time and leave the script running in this process, which is
 * the shape of hang that outlives the request that caused it.
 */
function toSignal(timeout: number | undefined): AbortSignal | undefined {
  return timeout ? AbortSignal.timeout(timeout) : undefined
}

/**
 * Runs a code payload by writing it out and invoking an interpreter on it.
 *
 * @note a file rather than `python3 -c`, so that a syntax error reports a line
 * number the model can act on, and so the payload is not subject to shell
 * quoting on the way in.
 */
async function interpret(options: {
  sandboxId: string
  sessionId: string
  language: 'python' | 'javascript'
  code: string
  env?: Record<string, string>
  timeout?: number
}) {
  const { sandboxId, sessionId, language, code, env, timeout } = options

  const bash = await getShell(sandboxId)

  const extension = language === 'python' ? 'py' : 'js'
  const path = `${CODE_DIRECTORY}/${sessionId || 'default'}.${extension}`

  await bash.exec(`mkdir -p ${CODE_DIRECTORY}`)
  await bash.writeFile(path, code)

  const command = language === 'python' ? 'python3' : 'js-exec'

  const signal = toSignal(timeout)

  return await bash.exec(`${command} ${path}`, {
    ...(env ? { env } : {}),
    ...(signal ? { signal } : {}),
  })
}

/**
 * The exit status a shell uses for a command its own timeout killed.
 *
 * @note `just-bash` reports an aborted script this way rather than throwing,
 * which is faithful to a real shell but not to the contract: a VM-backed
 * implementation raises `EXEC_TIMEOUT` and the platform turns that into "the
 * command timed out, try a simpler one or raise the timeout". Left alone, the
 * same timeout here reaches the model as a command that failed with
 * `execution aborted`, and the agent's next move is to debug a command that was
 * fine. Only treated as a timeout when a timeout was actually set, so a script
 * that genuinely exits 124 on its own is not relabelled.
 */
const TIMEOUT_EXIT_CODE = 124

function assertNotTimedOut(
  result: { exitCode: number },
  timeout: number | undefined
): void {
  if (timeout !== undefined && result.exitCode === TIMEOUT_EXIT_CODE) {
    throw new SandboxError(
      'EXEC_TIMEOUT',
      `command did not finish within ${timeout}ms`,
      { detail: `aborted after ${timeout}ms` }
    )
  }
}

/**
 * This package exists for `pnpm dev`. Agent code runs inside the application
 * process here - same heap, same event loop, same CPU - and that is not a
 * sandbox in any sense a deployment can rely on. So the package refuses to
 * run at all under `NODE_ENV=production`, before a shell is even created,
 * and says what to install instead. Nothing configures this away: a sandbox
 * that is not a sandbox is not a deployment option.
 */
const DEVELOPMENT_ONLY_MESSAGE =
  'the installed sandbox runs agent code inside the application process and is for development only; install an isolated implementation of @chatbotkit-dev/sandbox-spec (its own container, microVM or service) by overriding @chatbotkit-dev/sandbox'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function assertDevelopment(): void {
  if (isProduction()) {
    throw new SandboxError('SANDBOX_UNAVAILABLE', DEVELOPMENT_ONLY_MESSAGE, {
      detail: 'refused: development-only sandbox under NODE_ENV=production',
    })
  }
}

function runBash(
  bash: JustBash.Bash,
  cmd: string,
  env: Record<string, string> | undefined,
  timeout: number | undefined
) {
  const signal = toSignal(timeout)

  return bash.exec(cmd, {
    ...(env ? { env } : {}),
    ...(signal ? { signal } : {}),
  })
}

async function exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
  assertDevelopment()

  const { sandboxId, sessionId, sessionType, cmd, timeout, env, files } =
    options

  // @note `options.mounts` is deliberately never read. Nothing is mounted and
  // nothing pretends to be: `mountedPaths` comes back empty, which is how the
  // platform knows not to tell the model about a `/space` that is not there,
  // and `resolve` is never called, so no credentials are minted for a mount
  // that will not happen.

  try {
    const bash = await getShell(sandboxId)

    if (files) {
      for (const file of files) {
        await bash.writeFile(file.path, file.contents)
      }
    }

    // @note a typed session means the command *is* code in that language, which
    // is what the contract's `sessionType` says.
    const result =
      sessionType && sessionType !== 'bash'
        ? await interpret({
            sandboxId,
            sessionId: sessionId ?? 'default',
            language: sessionType === 'python' ? 'python' : 'javascript',
            code: cmd,
            env,
            timeout,
          })
        : await runBash(bash, cmd, env, timeout)

    assertNotTimedOut(result, timeout)

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      mountedPaths: [],
    }
  } catch (error) {
    throw toSandboxError(error, 'EXEC_FAILED')
  }
}

/**
 * @note this runs real code - `just-bash` vendors a CPython build and a QuickJS
 * one - but it does not run it in a *persistent* interpreter. Each call starts
 * a fresh one, so a name bound by one call is unbound by the next, where a
 * backend holding a live session keeps the binding.
 *
 * That is a difference an agent notices: incremental code that builds up state
 * across turns works there and raises `NameError` here. It is documented rather
 * than thrown because the code genuinely executes and most payloads are
 * self-contained - refusing them all would make the local default useless to
 * avoid surprising a minority.
 */
async function runCode(
  options: SandboxRunCodeOptions
): Promise<SandboxRunCodeResult> {
  assertDevelopment()

  const { sandboxId, sessionId, code, language, env, timeout } = options

  try {
    const result = await interpret({
      sandboxId,
      sessionId: sessionId ?? `${sandboxId}-${language}`,
      language: language === 'python' ? 'python' : 'javascript',
      code,
      env,
      timeout,
    })

    assertNotTimedOut(result, timeout)

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      mountedPaths: [],
    }
  } catch (error) {
    throw toSandboxError(error, 'EXEC_FAILED')
  }
}

async function readFile(
  options: SandboxReadFileOptions
): Promise<SandboxReadFileResult> {
  assertDevelopment()

  const { sandboxId, path } = options

  const bash = await getShell(sandboxId)

  try {
    return { contents: await bash.readFile(path), mountedPaths: [] }
  } catch (error) {
    throw toSandboxError(error, 'FILE_READ_FAILED')
  }
}

async function writeFile(
  options: SandboxWriteFileOptions
): Promise<SandboxWriteFileResult> {
  assertDevelopment()

  const { sandboxId, path, contents } = options

  // @note `mode` and `owner` are accepted and ignored. There is one user and no
  // permission model in an in-process filesystem, so honouring them would mean
  // inventing enforcement that does not exist.

  const bash = await getShell(sandboxId)

  try {
    await bash.writeFile(path, contents)

    return { mountedPaths: [] }
  } catch (error) {
    throw toSandboxError(error, 'FILE_WRITE_FAILED')
  }
}

/**
 * @note there is nothing to configure, but that is not the same as nothing to
 * check. The interpreter is vendored code loaded at runtime, so this runs a
 * command through it: an install that resolved but cannot execute is a
 * deployment fault, and finding it here rather than at the first agent turn is
 * the entire purpose of this hook.
 */
async function assertConfigured(): Promise<void> {
  // @note checked first and reported plainly: a production deployment with
  // this package installed has the wrong module, and the fix is a different
  // install, not a working interpreter

  if (isProduction()) {
    throw new Error(`@chatbotkit-dev/sandbox: ${DEVELOPMENT_ONLY_MESSAGE}`)
  }

  try {
    const { Bash: BashClass } = await load()

    const result = await new BashClass().exec('echo ok')

    if (result.exitCode !== 0 || result.stdout.trim() !== 'ok') {
      throw new Error(
        `the bundled interpreter answered unexpectedly (exit ${result.exitCode})`
      )
    }
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/sandbox could not run a command through its bundled interpreter, so agent shell commands would fail at the point of use: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

/**
 * @note exported for tests and for a long-lived process that wants the heap
 * back. Nothing in the platform calls it - the contract has no teardown, since
 * a backend where teardown matters manages it itself.
 */
export function reset(): void {
  sandboxes.clear()
}

const provider: SandboxProvider = {
  exec,
  runCode,
  readFile,
  writeFile,
  assertConfigured,
}

export default provider
