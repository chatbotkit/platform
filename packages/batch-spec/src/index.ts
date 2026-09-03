// @note the batch execution contract.
//
// The platform occasionally needs a container image run somewhere that is not
// the request that asked for it: a crawl of someone's site, an import that
// takes twenty minutes, work that wants eight gigabytes of disk and must not
// hold a Node process open while it uses them. Where that runs is a
// deployment's choice.
//
// The altitude is the decision worth explaining, for the same reason it was on
// the sandbox contract. A deployment that already has a typed client for its own
// job-running service will be tempted to wrap that, because the client exists
// and is already typed. It is the wrong shape. Such a surface carries warm pool
// status, job cloning, server log tailing, registry credentials, a manifest TTL
// on the create body and a vCPU count nobody sets, of which the platform calls
// exactly one method. A contract shaped like one vendor's REST API is a contract
// only that vendor can implement.
//
// So there are two operations here, and the vocabulary is the platform's. There
// is no VM, no queue, and no pool. `id` is whatever the implementation issues
// and the platform only ever hands it back; making it resolve to the same job
// later is the implementation's problem. That is what lets one deployment map
// it to a microVM and another to a Kubernetes Job, a container on the host, or
// a row in a table, without the platform holding a lifecycle only one of them
// has.
//
// What is deliberately absent is as much of the design as what is here. See
// `BatchProvider` at the bottom of the file.

/**
 * Where a job is in its life.
 *
 * @note five states because the platform can distinguish five outcomes and no
 * more. An implementation with a richer machine - pulling, scheduling,
 * uploading - collapses into these on the way out, the way the error codes do.
 */
export type BatchJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * How much machine to give a job, when the implementation has a say.
 *
 * @note advisory, like the sandbox contract's resources. A backend with nothing
 * to allocate ignores this rather than failing, and no caller checks whether it
 * was honoured. It is a preference, not a requirement.
 */
export interface BatchResources {
  memoryMb?: number
  diskMb?: number
}

export interface BatchRunOptions {
  /**
   * The container image to run, as a registry reference.
   *
   * @note the one field with no plausible alternative. A backend that cannot
   * pull OCI images cannot implement this contract at all, which is why the
   * community default refuses rather than approximating.
   */
  image: string

  /**
   * Environment for the container.
   *
   * @note this is how the platform passes a job its input - there is no
   * argument list here, because the platform has never set one and every image
   * it runs reads its own `BATCH_INPUT`. Adding `command` would be adding a way
   * to run something other than what an image was built to do.
   */
  env?: Record<string, string>

  /**
   * Wall clock limit, in **seconds**.
   *
   * @note seconds rather than the milliseconds the sandbox contract uses, and
   * the inconsistency is deliberate: these jobs are budgeted in minutes by the
   * plan limits that produce this number, and a millisecond field would invite
   * the conversion to be done twice
   */
  timeout?: number

  resources?: BatchResources

  /**
   * How long a registry may serve a cached manifest for `image`, in seconds.
   *
   * @note advisory, and the only field here that leaks an implementation detail
   * - it exists because a `:latest` tag that is re-pushed hourly is otherwise
   * pinned by whatever proxy sits in front of the registry. A backend with no
   * proxy ignores it. It is kept rather than dropped because the caller that
   * sets it is expressing something real: this image moves, do not cache it
   */
  manifestTtl?: number
}

export interface BatchRunResult {
  /** The implementation's identifier for the job. */
  id: string
}

/**
 * A job as the platform can observe it.
 *
 * @note there are no timestamps on this, and that is not an oversight. The
 * platform starts jobs and finds out how they ended; nothing reads when one was
 * queued, and a `startedAt` that some backends can supply and others cannot is
 * a field every caller has to treat as absent anyway.
 */
export interface BatchJob {
  id: string

  status: BatchJobStatus

  /** The container's exit code. Present once the job has finished. */
  exitCode?: number

  /** Why it failed, when it did. For logs; never shown to a user unedited. */
  error?: string
}

// --- errors ---

/**
 * @note coarser than the codes a VM-backed service returns, and the collapsing
 * is not lossy in any way the platform can observe. One such service separates
 * a VM it could not acquire from one it could not reach from one it could not
 * release; the platform cannot respond to those differently, and codes naming
 * VMs would be unimplementable by a backend that has none.
 *
 * `UNSUPPORTED_OPERATION` is the one code with no vendor ancestor, and it is
 * what makes a partial implementation honest - see `run` on the provider.
 */
export type BatchErrorCode =
  | 'JOB_NOT_FOUND'
  | 'BATCH_UNAVAILABLE'
  | 'NOT_AUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_OPERATION'
  | 'UNKNOWN'

/**
 * The shape an implementation's errors have to carry so the platform can decide
 * what to tell the caller and whether to report the failure.
 *
 * @note an interface rather than a base class, and detected structurally rather
 * than with `instanceof`, for the same two reasons the sandbox contract gives:
 * the spec packages in this repository hold no behaviour, and `instanceof`
 * across a package boundary is a bet on module identity that a bundler is free
 * to lose. A structural brand cannot fail that way.
 */
export interface BatchErrorLike extends Error {
  /** The brand. Always `true`, present so the check is not a guess. */
  readonly batch: true

  readonly code: BatchErrorCode

  /** The underlying failure, for logs. */
  readonly detail?: string
}

// --- provider ---

export interface BatchProvider {
  /**
   * Starts a job and returns as soon as it has been accepted.
   *
   * @note asynchronous by construction, and there is no synchronous sibling.
   * Every job the platform runs reports its own results back through the API
   * when it is done, so the caller has nothing to wait for and the request that
   * started it is long gone by the time the job finishes.
   *
   * An implementation that cannot run containers must throw
   * `UNSUPPORTED_OPERATION` naming the override that can, rather than
   * approximating. A batch runner that silently does nothing looks exactly like
   * one whose jobs are slow, and the deployment finds out weeks later from a
   * dataset that never filled.
   */
  run(options: BatchRunOptions): Promise<BatchRunResult>

  /**
   * Reports a job's current state.
   *
   * @note there is no `waitForCompletion` here, and the omission is the reason
   * this method exists at all. Waiting is a caller's timing policy - how often
   * to look, how long to give up after - and putting it in the contract makes
   * every backend reimplement the same poll loop slightly differently. The
   * platform runs one loop over this.
   *
   * @throws `JOB_NOT_FOUND` for an id the implementation has forgotten, which
   * it is entitled to do: jobs are retained for a while after they finish and
   * then they are not.
   */
  get(id: string): Promise<BatchJob>

  // @note there is no `cancel`, no `logs` and no `list`, and their absence was
  // checked rather than assumed. The service client offers all three and
  // nothing in the repository calls any of them; three operations no caller
  // wants are still three operations every future backend has to implement.
  // Whoever needs one should add it here first, which is the point of the seam.

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
