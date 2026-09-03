// @note the platform's side of batch execution.
//
// Where a job runs is now `@chatbotkit-dev/batch`, which pnpm resolves to
// either the community default that refuses or this deployment's cbk-batch
// implementation. What is left here is the part that is genuinely the
// platform's: the vocabulary its callers already use, and the decision about
// how long to wait for something.

import type { BatchJobStatus } from '@chatbotkit-dev/batch-spec'

import batch from '@chatbotkit-dev/batch'

import debug from '@/lib/debug'

/**
 * Configuration for running a batch job
 */
export interface RunBatchJobParams {
  /**
   * Docker image to run (e.g., 'ghcr.io/chatbotkit/runner-sitemap:latest')
   */
  image: string

  /**
   * Manifest TTL in seconds for registry proxy caching
   */
  manifest_ttl?: number

  /**
   * Environment variables to pass to the container
   */
  env?: Record<string, string>

  /**
   * Job timeout in seconds (max 3600 = 1 hour)
   */
  timeout?: number

  /**
   * VM memory in MB (default: 512, max: 8192)
   */
  memory?: number

  /**
   * Disk size in MB (default: 1024, max: 8192)
   */
  disk?: number

  // @note there was an `ephemeral` flag here and it is gone, because it never
  // did anything - it was accepted, documented as "whether the job should be
  // deleted after completion", and then not passed to the service by either
  // entry point. The service's equivalent is `retention`, which no caller has
  // ever set. Whoever wants it should add it to the contract, where a backend
  // has to honour it or say it cannot.
}

/**
 * A job that has been accepted
 */
export interface BatchJobHandle {
  /**
   * The job ID
   */
  id: string
}

/**
 * The outcome of a job that has finished
 */
export interface BatchJobResult {
  /**
   * The job ID
   */
  id: string

  /**
   * The job status
   */
  status: BatchJobStatus

  /**
   * The container's exit code, when it ran far enough to have one
   */
  exitCode?: number

  /**
   * Why the job failed, when it did
   */
  error?: string
}

/**
 * Translate the platform's parameter names into the contract's.
 */
function toRunOptions(params: RunBatchJobParams) {
  return {
    image: params.image,
    env: params.env,
    timeout: params.timeout,
    manifestTtl: params.manifest_ttl,
    resources:
      params.memory !== undefined || params.disk !== undefined
        ? { memoryMb: params.memory, diskMb: params.disk }
        : undefined,
  }
}

/**
 * Run a batch job asynchronously (fire-and-forget)
 *
 * @note This starts the job and returns immediately without waiting for completion.
 * The job will run in the background and post results to a queue URL.
 *
 * @param params - Job configuration
 * @returns The created job with its ID
 */
export async function runBatchJobAsync(
  params: RunBatchJobParams
): Promise<BatchJobHandle> {
  debug(`runBatchJobAsync`, { params }).log('batch.runBatchJobAsync')

  // @note no status comes back, where this used to answer with a made-up
  // `'created'`. Accepting a job is not a state the job is in, and the one
  // caller discarded the value anyway - a status here would only ever have been
  // read by someone who then had to look it up again to learn anything.

  const job = await batch.run(toRunOptions(params))

  debug(`batch job created`, { id: job.id }).log('batch.runBatchJobAsync')

  return { id: job.id }
}

const TERMINAL: ReadonlySet<BatchJobStatus> = new Set<BatchJobStatus>([
  'completed',
  'failed',
  'cancelled',
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run a batch job synchronously (wait for completion)
 *
 * @note This starts the job and waits for it to complete. Use with caution
 * for long-running jobs as it may timeout.
 *
 * @note the polling lives here rather than in the batch module on purpose. How
 * often to look and how long to give up after is this caller's timing policy,
 * and a `waitForCompletion` in the contract would make every backend
 * reimplement the same loop slightly differently. The intervals below are the
 * ones the service client used, so nothing about the wait has changed.
 *
 * @param params - Job configuration
 * @param waitOptions - Options for waiting (interval, timeout)
 * @returns The completed job
 */
export async function runBatchJob(
  params: RunBatchJobParams,
  waitOptions?: { interval?: number; timeout?: number }
): Promise<BatchJobResult> {
  debug(`runBatchJob`, { params }).log('batch.runBatchJob')

  const job = await batch.run(toRunOptions(params))

  debug(`batch job created, waiting for completion`, { id: job.id }).log(
    'batch.runBatchJob'
  )

  const interval = waitOptions?.interval ?? 2000
  const timeout = waitOptions?.timeout ?? 600000

  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const result = await batch.get(job.id)

    if (TERMINAL.has(result.status)) {
      return result
    }

    await sleep(interval)
  }

  throw new Error(`Job ${job.id} did not complete within ${timeout}ms`)
}
