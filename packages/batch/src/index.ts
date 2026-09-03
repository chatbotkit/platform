// @note the community default for batch execution.
//
// This one refuses, and the choice is worth stating rather than discovering.
// The other public defaults in this repository degrade: `@chatbotkit-dev/email`
// logs to the console, `@chatbotkit-dev/searchengine` finds nothing, and
// `@chatbotkit-dev/sandbox` genuinely interprets bash in-process. Each of those
// has a cheap, honest approximation of the real thing. This module does not.
// Running an arbitrary OCI image with its own kernel, disk and network is not
// something a Node process can approximate, and every approximation on offer is
// worse than refusing:
//
//   shell out to `docker`  - needs a daemon, which is configuration, and turns
//                            a missing socket into a failure that reads like a
//                            broken job rather than an absent backend.
//
//   run the entrypoint     - runs the platform's own process as the job, with
//   in-process               the platform's credentials. Not a sandbox at all.
//
//   accept and drop        - the worst one, and the reason this file exists.
//                            A batch runner that silently succeeds and does
//                            nothing is indistinguishable from one whose jobs
//                            are slow, so the deployment finds out weeks later
//                            from a dataset that never filled.
//
// So `run` throws `UNSUPPORTED_OPERATION` naming the override, and
// `assertConfigured` throws too, rather than following `@chatbotkit-dev/email`
// and resolving anyway: a module that cannot serve any request
// should fail the deployment's readiness check instead of waiting to fail the
// first user. See packages/AGENTS.md.
//
// The platform still imports and boots on this. What it loses is the features
// that launch jobs - today, sitemap and crawl imports - which fail at the point
// of use with a message naming what to install.

import type {
  BatchErrorCode,
  BatchErrorLike,
  BatchJob,
  BatchProvider,
  BatchRunOptions,
  BatchRunResult,
} from '@chatbotkit-dev/batch-spec'

export type * from '@chatbotkit-dev/batch-spec'

// @note the parameters below are named for the contract rather than for what
// this implementation does with them, which is nothing
/* eslint-disable unused-imports/no-unused-vars */

export class BatchError extends Error implements BatchErrorLike {
  readonly batch = true as const

  readonly code: BatchErrorCode

  readonly detail?: string

  constructor(
    code: BatchErrorCode,
    message: string,
    options?: { detail?: string; cause?: unknown }
  ) {
    super(message)

    this.name = 'BatchError'
    this.code = code
    this.detail = options?.detail

    // @note assigned rather than passed to `super`, because the two-argument
    // `Error` constructor is ES2022 and these packages compile against ES2021

    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

const UNSUPPORTED =
  'no batch backend is installed, so container jobs cannot run - override @chatbotkit-dev/batch with a package whose default export satisfies BatchProvider from @chatbotkit-dev/batch-spec'

/**
 * Refuses, because nothing here can run a container image.
 *
 * @throws always, with `UNSUPPORTED_OPERATION`
 */
export async function run(options: BatchRunOptions): Promise<BatchRunResult> {
  throw new BatchError('UNSUPPORTED_OPERATION', UNSUPPORTED, {
    detail: `cannot run ${options.image}`,
  })
}

/**
 * Reports that the job is not here, because no job ever started here.
 *
 * @note `JOB_NOT_FOUND` rather than `UNSUPPORTED_OPERATION`, and the difference
 * matters to the caller. An id can only reach this function if something else
 * issued it, which means the caller is polling a job started by a backend that
 * has since been swapped out - and "that job is gone" is both true and the
 * thing it needs to stop polling.
 */
export async function get(id: string): Promise<BatchJob> {
  throw new BatchError('JOB_NOT_FOUND', `no batch job ${id}`, {
    detail: UNSUPPORTED,
  })
}

/**
 * @note throws, unlike most of the public defaults. Nothing can be served from
 * this module - every job would fail at the point of use - so it fails the
 * deployment's readiness check instead, the way an empty model catalogue does.
 * A deployment that genuinely wants no batch backend removes the case from
 * `platform/tests/config/providers.utest.js`, which is a decision someone
 * makes on purpose rather than one that happens quietly.
 */
export async function assertConfigured(): Promise<void> {
  throw new Error(
    `@chatbotkit-dev/batch is the community default and ${UNSUPPORTED}`
  )
}

const provider: BatchProvider = {
  run,
  get,
  assertConfigured,
}

export default provider
