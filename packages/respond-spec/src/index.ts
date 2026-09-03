// @note the canned response contract.
//
// Some third parties will only take a URL where the platform has a document.
// A telephony provider handed a call asks for a webhook and expects markup back
// from it; the platform knows the markup already, at the moment it is arranging
// the call, and has nothing to decide when the fetch arrives. What it needs is
// somewhere to put a fixed answer and a URL that serves it.
//
// The altitude worth defending is that this contract describes the *need* -
// give me a URL that returns this - rather than the mechanism. The obvious
// smaller contract would have been "here is the base URL of a service that
// echoes its query string", which is one deployment's answer written down as if
// it were the question. Encoding the body into the URL is a legitimate
// implementation and it is not the only one: a backend that stores the document
// and returns a short link to it satisfies this identically, and would be the
// right answer for a body too large to put in a query string.
//
// There is no read side and no lifecycle. The platform never fetches these
// URLs; it hands them out and something else does. How long one keeps working
// is the implementation's business, and every caller today needs it for the
// length of one phone call.

export interface RespondDocument {
  /** Exactly what a fetch of the URL should return. */
  body: string

  /**
   * The media type to serve it as.
   *
   * @note required rather than defaulted to `text/plain`, because the callers
   * that need this at all need a specific one - a telephony provider handed
   * anything but its own XML type ignores the document and hangs up. A default
   * would make the one thing that must be right the one thing easy to omit.
   */
  contentType: string
}

// --- errors ---

export type RespondErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNSUPPORTED_OPERATION'
  | 'DOCUMENT_TOO_LARGE'
  | 'VALIDATION_FAILED'

/**
 * @note branded structurally rather than by class, for the reasons the other
 * contracts in this repository give.
 */
export interface RespondErrorLike extends Error {
  /** The brand. Always `true`, present so the check is not a guess. */
  readonly respond: true

  readonly code: RespondErrorCode

  /** The underlying failure, for logs. */
  readonly detail?: string
}

// --- provider ---

export interface RespondProvider {
  /**
   * A URL that answers a fetch with `document`.
   *
   * @note synchronous, which rules out a backend that must store the document
   * before it can name it - and that is a deliberate trade rather than an
   * oversight. Every caller builds one of these while composing a reply to a
   * third party that is already waiting, and the alternative shape costs a
   * round trip on the hot path of answering a phone call. An implementation
   * that wants to store the body can still do so, by deriving a deterministic
   * address and writing it on first fetch.
   *
   * @throws `DOCUMENT_TOO_LARGE` when the implementation cannot address a body
   * that size. Callers cannot know the limit - it is a property of the backend,
   * and encoding one into the platform would be encoding one backend's.
   */
  urlFor(document: RespondDocument): string

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
