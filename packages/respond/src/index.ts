// @note the community default for canned responses, and it refuses.
//
// The temptation here is stronger than it was for the other refusing defaults,
// because there is something that looks like an answer: a `data:` URL encodes a
// body and a media type exactly, needs nothing configured, and is a real URL. It
// is also useless to every caller this contract has. The parties that ask the
// platform for a URL are telephony providers and webhook consumers, and they
// fetch over HTTP; handing one a `data:` URL produces a document that is never
// retrieved and a call that is dropped without a request ever being made.
//
// That is the worst failure shape available - it succeeds locally, fails
// remotely, and leaves nothing in the platform's logs. Refusing is legible.
//
// So `urlFor` throws `NOT_CONFIGURED` naming the override point, and
// `assertConfigured` throws too. The platform still imports and boots; what it
// loses are the features that hand a URL to someone else, which fail at the
// point of use with a message naming what to install.

import type {
  RespondDocument,
  RespondProvider,
} from '@chatbotkit-dev/respond-spec'

import { RespondError } from './error'

export type * from '@chatbotkit-dev/respond-spec'

export { RespondError }

// @note the parameter below is named for the contract rather than for what this
// implementation does with it, which is nothing
/* eslint-disable unused-imports/no-unused-vars */

const UNCONFIGURED =
  'no canned response backend is installed, so URLs that serve a fixed document cannot be issued - override @chatbotkit-dev/respond with a package whose default export satisfies RespondProvider from @chatbotkit-dev/respond-spec'

/**
 * Refuses, because there is nowhere to serve the document from.
 *
 * @throws always, with `NOT_CONFIGURED`
 */
export function urlFor(document: RespondDocument): string {
  throw new RespondError('NOT_CONFIGURED', UNCONFIGURED, {
    detail: `cannot address a ${document.contentType} document of ${document.body.length} characters`,
  })
}

/**
 * @note throws, unlike most public defaults. Nothing can be served from this
 * module, so it fails the deployment's readiness check rather than letting the
 * first outbound call discover it.
 */
export async function assertConfigured(): Promise<void> {
  throw new Error(
    `@chatbotkit-dev/respond is the community default and ${UNCONFIGURED}`
  )
}

const provider: RespondProvider = {
  urlFor,
  assertConfigured,
}

export default provider
