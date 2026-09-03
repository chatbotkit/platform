// @note the platform's side of page capture.
//
// The capture itself is now `@chatbotkit-dev/screenshot`, which pnpm resolves to
// either the community default that refuses or this deployment's backend. What
// is left here is the platform's vocabulary for it - the names its callers
// already use, which are not the contract's.
//
// The names differ on purpose rather than by inertia. `makeScreenshot` is what a
// page component calls to get something it can put in an `<img>`; the contract
// calls the same thing `publicUrl`, because from the module's side the
// distinction that matters is that it carries no credential. Renaming every call
// site to say `publicUrl` would have traded a name that describes the intent for
// one that describes the constraint.

import type {
  ScreenshotMetadata,
  ScreenshotOptions,
} from '@chatbotkit-dev/screenshot-spec'

import screenshot from '@chatbotkit-dev/screenshot'

export type { ScreenshotOptions, ScreenshotMetadata }
export type { ScreenshotFont } from '@chatbotkit-dev/screenshot-spec'

/**
 * Builds a screenshot URL that can be handed to a browser directly - as an
 * image source or a redirect target.
 *
 * @note the access key is deliberately not embedded; a URL that leaves the
 * server is authenticated with a signature instead, when one is configured.
 */
export function makeScreenshot(
  url: string,
  options?: ScreenshotOptions
): string {
  return screenshot.publicUrl(url, options)
}

/**
 * Builds the request for a server side capture. The access key travels as a
 * header so it never ends up in a URL that could be logged or shared.
 */
export function makeScreenshotRequest(
  url: string,
  options?: ScreenshotOptions
): { url: string; headers: Record<string, string> } {
  return screenshot.request(url, options)
}

/**
 * Reads the page metadata the capture collected.
 */
export function readScreenshotMetadata(headers: Headers): ScreenshotMetadata {
  return screenshot.readMetadata(headers)
}
