// @note the community default for page capture, and it refuses.
//
// Rendering a web page means running a browser: a real engine, real network
// access to whatever the page asks for, and a process that can be told to stop.
// A package cannot be that, and it should not pretend - a capture backend that
// silently produced nothing would show as a broken image in a preview, which is
// indistinguishable from a page that failed to load.
//
// So `publicUrl` and `request` throw `NOT_CONFIGURED` naming the override point,
// and `assertConfigured` throws too. The platform still imports and boots; what
// it loses are previews and thumbnails, which fail at the point of use with a
// message naming what to install.
//
// `readMetadata` is the exception and answers normally. It reads whatever a
// capture reported, and with no capture there is nothing to report - a fully
// null object, which is exactly what the contract says a caller gets from a page
// that carried no metadata. Throwing there would make callers guard a method
// that cannot fail.

import type {
  ScreenshotMetadata,
  ScreenshotOptions,
  ScreenshotProvider,
  ScreenshotRequest,
} from '@chatbotkit-dev/screenshot-spec'

import { ScreenshotError } from './error'

export type * from '@chatbotkit-dev/screenshot-spec'

export { ScreenshotError }

// @note the parameters below are named for the contract rather than for what
// this implementation does with them, which is nothing
/* eslint-disable unused-imports/no-unused-vars */

const UNCONFIGURED =
  'no page capture backend is installed, so screenshots cannot be taken - override @chatbotkit-dev/screenshot with a package whose default export satisfies ScreenshotProvider from @chatbotkit-dev/screenshot-spec'

/**
 * Refuses, because nothing here can render a page.
 *
 * @throws always, with `NOT_CONFIGURED`
 */
export function publicUrl(url: string, options?: ScreenshotOptions): string {
  throw new ScreenshotError('NOT_CONFIGURED', UNCONFIGURED, {
    detail: `cannot capture ${url}`,
  })
}

/**
 * Refuses, because nothing here can render a page.
 *
 * @throws always, with `NOT_CONFIGURED`
 */
export function request(
  url: string,
  options?: ScreenshotOptions
): ScreenshotRequest {
  throw new ScreenshotError('NOT_CONFIGURED', UNCONFIGURED, {
    detail: `cannot capture ${url}`,
  })
}

/**
 * @note answers rather than refusing - see the note at the top of the file.
 */
export function readMetadata(headers: Headers): ScreenshotMetadata {
  return { title: null, icon: null, fonts: null, openGraph: null }
}

/**
 * @note throws, unlike most public defaults. Nothing can be served from this
 * module, so it fails the deployment's readiness check rather than letting the
 * first preview discover it.
 */
export async function assertConfigured(): Promise<void> {
  throw new Error(
    `@chatbotkit-dev/screenshot is the community default and ${UNCONFIGURED}`
  )
}

const provider: ScreenshotProvider = {
  publicUrl,
  request,
  readMetadata,
  assertConfigured,
}

export default provider
