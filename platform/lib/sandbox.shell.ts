// @note the platform's side of code execution.
//
// The environment itself is now `@chatbotkit-dev/sandbox`, which pnpm resolves
// to either the in-process bash default or this deployment's Firecracker
// implementation. What is left here is the part that is genuinely the
// platform's: deciding which stores an agent should be able to reach and where
// they appear, turning a failure into a sentence a user can read, and deciding
// which failures are worth waking someone for.
//
// None of that moved into the module, and the reason is the same in each case -
// it depends on what a space or a conversation is. A sandbox backend should not
// have to know.

import type {
  SandboxErrorCode,
  SandboxErrorLike,
  SandboxMountPlan,
  SandboxMountRequest,
} from '@chatbotkit-dev/sandbox-spec'

import sandbox from '@chatbotkit-dev/sandbox'
import { getMounts } from '@chatbotkit-dev/storage'

import { getConversationStorageBucketInfo } from '@/lib/conversation.attachment'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import { getSpaceStorageMountConfig } from '@/lib/space.storage'

// @note where each store appears inside the sandbox. The platform chooses
// these; which container backs them is storage's business, and how they get
// attached is the sandbox implementation's.

const SPACE_PATH = '/space'
const CONVERSATION_PATH = '/conversation'

/**
 * A storage location the model can reach, described the way the model is told
 * about it.
 */
type MountInfo =
  | { folder: string; spaceId: string }
  | { folder: string; conversationId: string }

interface ScopeOptions {
  spaceId?: string
  conversationId?: string
}

interface Limits {
  memoryMb?: number
  diskMb?: number
}

/**
 * Describes what should be mounted, and how to pay for it.
 *
 * @note `resolve` is not called here. It is handed to the implementation, which
 * calls it only if it finds the mounts missing - so a conversation's tenth
 * command costs no credential minting, and a backend that cannot mount costs
 * none ever. See `SandboxMountPlan`.
 */
function buildMountPlan(options: ScopeOptions): SandboxMountPlan | undefined {
  const { spaceId, conversationId } = options

  const requests: SandboxMountRequest[] = []

  if (spaceId) {
    const { scope, prefix } = getSpaceStorageMountConfig({ spaceId })

    requests.push({ path: SPACE_PATH, scope, prefix })
  }

  if (conversationId) {
    const { scope, prefix } = getConversationStorageBucketInfo(conversationId)

    requests.push({ path: CONVERSATION_PATH, scope, prefix })
  }

  if (requests.length === 0) {
    return undefined
  }

  return {
    requests,

    resolve: () =>
      getMounts(
        requests.map(({ scope, prefix }) => ({
          scope,
          prefix,
        }))
      ),
  }
}

/**
 * Turns the paths that are really mounted into what the model is told.
 *
 * @note derived from the result rather than from the request, which is the
 * change worth noticing. The version this replaced announced `/space` whenever
 * a `spaceId` was in scope, whether or not anything had been attached, so a
 * storage backend that could not issue credentials produced an agent
 * confidently writing files into a folder that was not there. A backend that
 * mounts nothing now says so, and the model plans around it.
 */
function toMountInfo(mountedPaths: string[], options: ScopeOptions): MountInfo[] {
  const { spaceId, conversationId } = options

  const mounts: MountInfo[] = []

  if (spaceId && mountedPaths.includes(SPACE_PATH)) {
    mounts.push({ folder: SPACE_PATH, spaceId })
  }

  if (conversationId && mountedPaths.includes(CONVERSATION_PATH)) {
    mounts.push({ folder: CONVERSATION_PATH, conversationId })
  }

  return mounts
}

/**
 * @note structural rather than `instanceof`, because the contract brands errors
 * that way on purpose - the class lives in whichever implementation is
 * installed, and module identity across a bundle boundary is not something to
 * bet the error handling on.
 */
function isSandboxError(error: unknown): error is SandboxErrorLike {
  return (
    error instanceof Error &&
    (error as Partial<SandboxErrorLike>).sandbox === true &&
    typeof (error as Partial<SandboxErrorLike>).code === 'string'
  )
}

/**
 * Failures that are ordinary outcomes rather than incidents.
 *
 * @note agents read paths that do not exist and run commands that fail; that is
 * the tool working. Sandboxes are reaped for idleness and recreated on the next
 * call; that is the backend working. Paging on either buries the failures that
 * do mean something.
 */
const EXPECTED: ReadonlySet<SandboxErrorCode> = new Set<SandboxErrorCode>([
  'SANDBOX_NOT_FOUND',
  'SANDBOX_UNAVAILABLE',
  'SESSION_NOT_FOUND',
  'EXEC_FAILED',
  'EXEC_TIMEOUT',
  'FILE_NOT_FOUND',
  'FILE_READ_FAILED',
  'FILE_WRITE_FAILED',
  'UNSUPPORTED_OPERATION',
])

function getUserMessage(code: SandboxErrorCode): string {
  switch (code) {
    case 'SANDBOX_NOT_FOUND':
      return 'Sandbox session expired. A new session will be created on retry.'

    case 'SESSION_NOT_FOUND':
      return 'Shell session expired. A new session will be created on retry.'

    case 'SANDBOX_UNAVAILABLE':
      return 'Sandbox is temporarily unavailable. Please try again.'

    case 'EXEC_TIMEOUT':
      return 'Command execution timed out. Try a simpler command or increase timeout.'

    case 'EXEC_FAILED':
      return 'Command execution failed. Check the command syntax and try again.'

    case 'FILE_NOT_FOUND':
      return 'File not found. Check the file path and try again.'

    case 'FILE_READ_FAILED':
      return 'Failed to read file. Check file permissions and path.'

    case 'FILE_WRITE_FAILED':
      return 'Failed to write file. Check file permissions and available disk space.'

    case 'MOUNT_FAILED':
      return 'Storage mount operation failed. Please try again.'

    case 'VALIDATION_FAILED':
      return 'Invalid operation parameters. Please check your input.'

    case 'UNSUPPORTED_OPERATION':
      return 'This sandbox cannot run that. The installed sandbox does not support the operation.'

    default:
      return 'Sandbox operation failed. Please try again.'
  }
}

interface Failure {
  error: string
  errorDetail?: string
}

/**
 * @note every operation below hands the model a failed result rather than
 * throwing, because a thrown error ends the turn and a returned one lets the
 * agent read what went wrong and try something else. Which of the two an
 * exception becomes is decided here and nowhere else.
 */
async function toFailure(error: unknown, operation: string): Promise<Failure> {
  if (isSandboxError(error)) {
    debug('sandbox failure', {
      operation,
      code: error.code,
      detail: error.detail,
    }).log('sandbox.shell.failure')

    if (!EXPECTED.has(error.code)) {
      await captureException(error)
    }

    return {
      error: getUserMessage(error.code),
      errorDetail: error.detail ?? error.message,
    }
  }

  // @note not from the sandbox at all - storage refusing to issue credentials,
  // most likely. Nothing here knows what it was, so it is reported.

  await captureException(error)

  return {
    error: 'Sandbox operation failed. Please try again.',
    errorDetail: error instanceof Error ? error.message : String(error),
  }
}

function toResources(limits: Limits) {
  return limits.memoryMb !== undefined || limits.diskMb !== undefined
    ? { memoryMb: limits.memoryMb, diskMb: limits.diskMb }
    : undefined
}

// --- exec ---

interface ExecOptions extends ScopeOptions, Limits {
  sandboxId: string
  sessionId?: string
  sessionType?: 'bash' | 'python' | 'node'
  cmd: string
  timeout?: number
  env?: Record<string, string>
  files?: { path: string; contents: string }[]
}

interface ExecResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  error?: string
  errorDetail?: string
  mounts: MountInfo[]
}

export async function exec(options: ExecOptions): Promise<ExecResult> {
  const {
    sandboxId,
    sessionId,
    sessionType,
    cmd,
    spaceId,
    conversationId,
    timeout,
    env,
    files,
    ...limits
  } = options

  debug('exec', { sandboxId, sessionId, cmd, spaceId, conversationId }).log(
    'sandbox.shell.exec'
  )

  try {
    const result = await sandbox.exec({
      sandboxId,
      sessionId,
      sessionType,
      cmd,
      timeout,
      env,
      files,
      resources: toResources(limits),
      mounts: buildMountPlan({ spaceId, conversationId }),
    })

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
      mounts: toMountInfo(result.mountedPaths, { spaceId, conversationId }),
    }
  } catch (error) {
    const failure = await toFailure(error, 'exec')

    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: failure.error,
      error: failure.error,
      errorDetail: failure.errorDetail,
      mounts: [],
    }
  }
}

// --- runCode ---

interface RunCodeOptions extends ScopeOptions, Limits {
  sandboxId: string
  sessionId?: string
  code: string
  language?: 'python' | 'javascript'
  timeout?: number
  env?: Record<string, string>
}

interface RunCodeResult {
  success: boolean
  output: string
  error?: string
  errorDetail?: string
  mounts: MountInfo[]
}

export async function runCode(options: RunCodeOptions): Promise<RunCodeResult> {
  const {
    sandboxId,
    sessionId,
    code,
    language = 'python',
    spaceId,
    conversationId,
    timeout,
    env,
    ...limits
  } = options

  debug('runCode', { sandboxId, sessionId, language }).log(
    'sandbox.shell.runCode'
  )

  try {
    const result = await sandbox.runCode({
      sandboxId,
      sessionId,
      code,
      language,
      timeout,
      env,
      resources: toResources(limits),
      mounts: buildMountPlan({ spaceId, conversationId }),
    })

    const success = result.exitCode === 0

    // @note stderr is folded into the output rather than dropped: an
    // interpreter's traceback is on stderr, and it is the most useful thing the
    // model can be handed when its own code fails.

    const output =
      result.stdout + (result.stderr ? `\n${result.stderr}` : '')

    return {
      success,
      output: output.trim(),
      error: success ? undefined : result.stderr,
      mounts: toMountInfo(result.mountedPaths, { spaceId, conversationId }),
    }
  } catch (error) {
    const failure = await toFailure(error, 'runCode')

    return {
      success: false,
      output: '',
      error: failure.error,
      errorDetail: failure.errorDetail,
      mounts: [],
    }
  }
}

// --- files ---

interface ReadFileOptions extends ScopeOptions, Limits {
  sandboxId: string
  sessionId?: string
  path: string
}

interface ReadFileResult {
  success: boolean
  contents: string
  error?: string
  errorDetail?: string
  mounts: MountInfo[]
}

export async function readFile(
  options: ReadFileOptions
): Promise<ReadFileResult> {
  const {
    sandboxId,
    sessionId: _sessionId,
    path,
    spaceId,
    conversationId,
    ...limits
  } = options

  debug('readFile', { sandboxId, path }).log('sandbox.shell.readFile')

  try {
    const result = await sandbox.readFile({
      sandboxId,
      path,
      resources: toResources(limits),
      mounts: buildMountPlan({ spaceId, conversationId }),
    })

    return {
      success: true,
      contents: result.contents,
      mounts: toMountInfo(result.mountedPaths, { spaceId, conversationId }),
    }
  } catch (error) {
    const failure = await toFailure(error, 'readFile')

    return {
      success: false,
      contents: '',
      error: failure.error,
      errorDetail: failure.errorDetail,
      mounts: [],
    }
  }
}

interface WriteFileOptions extends ScopeOptions, Limits {
  sandboxId: string
  sessionId?: string
  path: string
  contents: string
  mode?: string
  owner?: string
}

interface WriteFileResult {
  success: boolean
  error?: string
  errorDetail?: string
  mounts: MountInfo[]
}

export async function writeFile(
  options: WriteFileOptions
): Promise<WriteFileResult> {
  const {
    sandboxId,
    sessionId: _sessionId,
    path,
    contents,
    mode,
    owner,
    spaceId,
    conversationId,
    ...limits
  } = options

  debug('writeFile', { sandboxId, path, size: contents.length }).log(
    'sandbox.shell.writeFile'
  )

  try {
    const result = await sandbox.writeFile({
      sandboxId,
      path,
      contents,
      mode,
      owner,
      resources: toResources(limits),
      mounts: buildMountPlan({ spaceId, conversationId }),
    })

    return {
      success: true,
      mounts: toMountInfo(result.mountedPaths, { spaceId, conversationId }),
    }
  } catch (error) {
    const failure = await toFailure(error, 'writeFile')

    return {
      success: false,
      error: failure.error,
      errorDetail: failure.errorDetail,
      mounts: [],
    }
  }
}
