// @note the code execution contract.
//
// The platform runs agent-authored shell commands and code somewhere isolated,
// reads and writes files there, and keeps that environment alive across the
// turns of a conversation. Where "there" is, is a deployment's choice.
//
// The altitude of this contract is the decision worth explaining, because there
// was an obvious wrong answer. One deployment already has a typed client for
// its own hosted execution service, and wrapping *that* in a spec would have
// been a smaller edit: the class already exists and
// already has types. It would also have been useless. That surface has thirty
// five methods - warm pool status, VNC session minting, desktop screenshots,
// sandbox log tailing, `path_style` on mount bodies - of which the platform
// calls about ten and none of the interesting ones. A contract shaped like one
// vendor's REST API is a contract only that vendor can implement, which is the
// same mistake `eval` would have been on the key-value contract, thirty times
// over.
//
// So the operations here are the four the platform actually performs, and the
// vocabulary is the platform's rather than any service's. There is no
// `external_sandbox_id`, no session handle, and no VM. `sandboxId` is a name
// the caller chooses and keeps using; making that name resolve to the same
// environment on the next call - and deciding when it stops - is the
// implementation's problem. That is what lets one deployment map it to a
// microVM through a key-value mapping, and another to an entry in a `Map`,
// without the platform holding a state machine that only one of them needs.
//
// The exception is mounts, and it is the interesting one. See `SandboxMountPlan`
// at the bottom of this file.

import type { StorageMounts, StorageScope } from '@chatbotkit-dev/storage-spec'

/**
 * The interpreter a session runs. `bash` is the default and the only one every
 * implementation is expected to have.
 *
 * @note the distinction is a session property rather than an argument to each
 * command because the environment persists: a Python session keeps its
 * variables between calls, which is the whole reason the code interpreter uses
 * one.
 */
export type SandboxSessionType = 'bash' | 'python' | 'node'

/** The language a `runCode` payload is written in. */
export type SandboxLanguage = 'python' | 'javascript'

/**
 * How much machine to give a sandbox, when the implementation has a say.
 *
 * @note advisory. An implementation with nothing to allocate ignores this
 * rather than failing - the platform is expressing a preference, not a
 * requirement, and no caller checks whether it was honoured.
 */
export interface SandboxResources {
  memoryMb?: number
  diskMb?: number
}

/** A file to place in the sandbox before the command runs. */
export interface SandboxFile {
  path: string
  contents: string
}

// --- errors ---

/**
 * @note these are deliberately coarser than the codes a VM-backed service
 * returns, and the collapsing is not lossy in any way the platform can observe.
 * One such service distinguishes a VM it could not reach from a VM it could not
 * acquire, and a mount failure from an unmount failure from an invalid mount;
 * the platform mapped each of those groups to a single sentence for the user
 * and treated them identically everywhere else. Codes naming object stores and
 * VMs would also have been unimplementable by a backend that has neither.
 *
 * `UNSUPPORTED_OPERATION` is the one code with no vendor ancestor, and it is
 * what makes a partial implementation honest - see `runCode` on the provider.
 */
export type SandboxErrorCode =
  | 'SANDBOX_NOT_FOUND'
  | 'SANDBOX_UNAVAILABLE'
  | 'SESSION_NOT_FOUND'
  | 'EXEC_FAILED'
  | 'EXEC_TIMEOUT'
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'MOUNT_FAILED'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_OPERATION'
  | 'UNKNOWN'

/**
 * The shape an implementation's errors have to carry so the platform can turn
 * them into a message for the user and decide whether to report them.
 *
 * @note an interface rather than a base class, and detected structurally rather
 * than with `instanceof`, for two reasons. The spec packages in this repository
 * hold no behaviour, and a class is behaviour. And `instanceof` across a package
 * boundary is a bet on module identity that this repository has already lost
 * once - the code being replaced carries string-matching fallbacks
 * (`msg.includes('not found')`) that exist precisely because the typed check
 * could not be relied on. A structural brand cannot fail that way.
 *
 * Implementations declare their own error class; there are about fifteen lines
 * of it, and each one gets to keep whatever else it wants to attach.
 */
export interface SandboxErrorLike extends Error {
  /** The brand. Always `true`, present so the check is not a guess. */
  readonly sandbox: true

  readonly code: SandboxErrorCode

  /** The underlying failure, for logs. Never shown to a user. */
  readonly detail?: string
}

// --- operations ---

export interface SandboxExecOptions {
  /**
   * The caller's name for the environment. Stable across calls; the
   * implementation is what makes it resolve to the same place.
   */
  sandboxId: string

  /**
   * Names a persistent session. Without one the command runs standalone and
   * keeps nothing - no shell variables, no working directory, no history.
   */
  sessionId?: string

  sessionType?: SandboxSessionType

  cmd: string

  /** Milliseconds. */
  timeout?: number

  env?: Record<string, string>

  /** Written before `cmd` runs. */
  files?: SandboxFile[]

  resources?: SandboxResources

  mounts?: SandboxMountPlan
}

export interface SandboxExecResult {
  exitCode: number
  stdout: string
  stderr: string

  /** Set when the command could not be run, as opposed to running and failing. */
  error?: string

  /**
   * The mount paths that are actually available inside this sandbox.
   *
   * @note the platform tells the model which folders it can reach, and it has
   * to be told the truth. A backend that cannot mount returns `[]` and the
   * model is never offered a `/space` that is not there.
   */
  mountedPaths: string[]
}

export interface SandboxRunCodeOptions {
  sandboxId: string
  sessionId?: string
  code: string
  language: SandboxLanguage

  /** Milliseconds. */
  timeout?: number

  env?: Record<string, string>
  resources?: SandboxResources
  mounts?: SandboxMountPlan
}

export interface SandboxRunCodeResult {
  exitCode: number
  stdout: string
  stderr: string
  mountedPaths: string[]
}

export interface SandboxReadFileOptions {
  sandboxId: string
  path: string
  resources?: SandboxResources
  mounts?: SandboxMountPlan
}

export interface SandboxReadFileResult {
  contents: string
  mountedPaths: string[]
}

export interface SandboxWriteFileOptions {
  sandboxId: string
  path: string
  contents: string

  /** Unix mode, as a string - `'644'`. Ignored where it means nothing. */
  mode?: string

  owner?: string

  resources?: SandboxResources
  mounts?: SandboxMountPlan
}

export interface SandboxWriteFileResult {
  mountedPaths: string[]
}

// --- mounts ---

/**
 * One store the platform wants reachable inside the sandbox, and where.
 *
 * @note `path` is the platform's decision and `scope`/`prefix` are the storage
 * backend's vocabulary. Which container backs the scope is neither's business
 * here - it arrives with the credentials, from `resolve`.
 */
export interface SandboxMountRequest {
  /** Absolute path inside the sandbox, e.g. `/space`. */
  path: string

  scope: StorageScope

  prefix: string
}

/**
 * The requested mounts, and a way to get credentials for them.
 *
 * @note the callback is the part that needs justifying, since a contract full
 * of plain data with one function in it looks like an accident.
 *
 * Mounting is expensive and usually unnecessary. Credentials are scoped and
 * short lived, so getting them means an STS round trip, and the environment
 * being mounted into is long lived - across a conversation, the same store is
 * requested many times and has to be mounted once. Whether this call is the
 * one that needs it is something only the implementation knows, because only it
 * knows what is already mounted.
 *
 * Passing `StorageMounts` directly would mint credentials on every exec and
 * throw nearly all of them away. Passing nothing and having the implementation
 * fetch its own would put the platform's mapping - which space, which
 * conversation, which prefix - inside every backend. The callback keeps the
 * mapping in the platform and the "do I need this yet" decision in the
 * implementation, and means a backend that cannot mount at all never causes a
 * credential to be issued.
 *
 * `resolve` returns `null` when the storage backend cannot issue scoped
 * credentials. That is not an error: sandboxes run without storage rather than
 * failing to start, and `mountedPaths` on the result is how the model finds
 * out.
 */
export interface SandboxMountPlan {
  requests: SandboxMountRequest[]

  /**
   * Issues credentials covering `requests`. Correlate the returned `mounts` to
   * the requests by `scope`.
   */
  resolve(): Promise<StorageMounts | null>
}

// --- provider ---

export interface SandboxProvider {
  /**
   * Runs a shell command. The one operation every implementation has.
   */
  exec(options: SandboxExecOptions): Promise<SandboxExecResult>

  /**
   * Runs a code payload in a typed session.
   *
   * @note an implementation with no interpreter for `language` must throw
   * `UNSUPPORTED_OPERATION` naming the override that provides one, rather than
   * shelling out to something approximate. A `python3` that is really bash
   * fails in ways that read to the model as its own code being wrong, and it
   * will keep trying.
   *
   * "Typed session" is the guarantee worth being precise about, because the
   * implementations differ on it and the difference is visible to the model.
   * A backend with a long-lived interpreter process keeps names bound between
   * calls, so a variable assigned in one `runCode` is still there in the next.
   * A backend that starts an interpreter per call does not. Both are
   * implementations of this method; only the first is what an agent writing
   * incremental code expects, so an implementation that cannot do it should say
   * so in its README rather than in a thrown error, since the code does run.
   */
  runCode(options: SandboxRunCodeOptions): Promise<SandboxRunCodeResult>

  readFile(options: SandboxReadFileOptions): Promise<SandboxReadFileResult>

  writeFile(options: SandboxWriteFileOptions): Promise<SandboxWriteFileResult>

  // @note there is no `deleteSession` and no `destroySandbox`, and their
  // absence was checked rather than assumed. The module this replaced exported
  // both and nothing in the repository called either; `destroySandbox` also
  // did not destroy anything, since its own comment records that it cleared the
  // platform's bookkeeping and left the environment to expire on its own. Two
  // operations that no caller wants are still two operations every future
  // backend has to implement, so they are gone. Sandboxes and their sessions
  // end by expiry, which is what was happening anyway.

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
