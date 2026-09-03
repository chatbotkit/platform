// @note the page capture contract.
//
// The platform shows people pictures of web pages: a preview of the site a
// widget is about to be installed on, a thumbnail in a landing page, an image an
// agent fetched because someone asked what a URL looks like. Rendering a page
// needs a real browser, which is not something the platform runs, so where that
// happens is a deployment's choice.
//
// Two operations rather than one, and the split is the interesting part of the
// design. Callers want a capture in two quite different situations:
//
//   as an address  - handed straight to a browser as an image source or a
//                    redirect target. It travels through a user agent, ends up
//                    in referrer headers and browser history, and must therefore
//                    carry no credential.
//
//   as a request   - fetched by the platform itself, to read the bytes or the
//                    page metadata. Nothing leaves the server, so the
//                    credential travels in a header where it belongs.
//
// Collapsing those into one method means either putting an access key into a URL
// that a browser will log, or making the server-side path unable to
// authenticate. The code this replaced had both shapes for exactly this reason;
// the contract keeps them apart on purpose rather than by habit.

/** The image format a capture is encoded as. */
export type ScreenshotFormat = 'png' | 'jpeg' | 'webp'

/**
 * How long to let a page settle before capturing it.
 *
 * @note these are the browser's own readiness states rather than an invention,
 * because there is no useful abstraction over them - a caller either wants the
 * first paint or wants the network to go quiet, and no third word describes the
 * difference. An implementation with a coarser notion maps onto the nearest one
 * it has.
 */
export type ScreenshotWaitUntil =
  | 'load'
  | 'domcontentloaded'
  | 'networkidle0'
  | 'networkidle2'

export interface ScreenshotOptions {
  format?: ScreenshotFormat

  fullPage?: boolean

  viewportWidth?: number
  viewportHeight?: number

  imageWidth?: number
  imageHeight?: number
  imageQuality?: number

  /** Capture only the first element matching this CSS selector. */
  selector?: string

  darkMode?: boolean

  waitUntil?: ScreenshotWaitUntil

  /** Extra settle time before the capture, in milliseconds. */
  delay?: number

  /** Navigation budget, in milliseconds. */
  timeout?: number

  /**
   * How long a capture of this URL may be reused, in seconds.
   *
   * @note advisory. An implementation with nothing in front of it ignores this
   * rather than failing, and no caller checks whether it was honoured.
   */
  cacheTtl?: number

  /** CSS selectors to remove before capturing. */
  hideSelectors?: string[]

  /**
   * Suppress the furniture that makes a page unrecognisable as itself - ads,
   * trackers, consent dialogs, support chat launchers.
   *
   * @note one flag rather than four, because no caller has ever wanted three of
   * them. What exactly gets blocked is the implementation's judgement and will
   * differ between backends; what the caller is asking for is a picture of the
   * page rather than of a cookie banner.
   */
  block?: boolean

  /**
   * Also collect what the page says about itself. See `ScreenshotMetadata`.
   *
   * @note off by default because it costs work at capture time, and most
   * captures are shown to a person who wants the picture.
   */
  metadata?: boolean
}

export interface ScreenshotFont {
  /** The first family named in the declaration. */
  first: string

  /** The full family list, as authored. */
  family: string

  /** How much of the page's text it sets, as the implementation counts it. */
  usage: number
}

/**
 * What the page said about itself during the capture.
 *
 * @note every field is nullable and the whole object is always returned, rather
 * than the object being optional. A page with no open graph tags and a page that
 * was captured without `metadata` are different situations, but neither gives a
 * caller anything to do differently - both mean "not available", and a shape
 * that forces the check once is easier to use correctly than one that forces it
 * twice.
 */
export interface ScreenshotMetadata {
  title: string | null

  /** An absolute URL to the page's icon. */
  icon: string | null

  fonts: ScreenshotFont[] | null

  openGraph: Record<string, string> | null
}

/**
 * A capture the platform performs itself.
 *
 * @note the headers are separate from the URL, which is the whole point of this
 * shape - see the note at the top of the file.
 */
export interface ScreenshotRequest {
  url: string

  headers: Record<string, string>
}

// --- errors ---

export type ScreenshotErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNSUPPORTED_OPERATION'
  | 'VALIDATION_FAILED'

/**
 * @note branded structurally rather than by class, for the reasons the other
 * contracts in this repository give.
 */
export interface ScreenshotErrorLike extends Error {
  /** The brand. Always `true`, present so the check is not a guess. */
  readonly screenshot: true

  readonly code: ScreenshotErrorCode

  /** The underlying failure, for logs. */
  readonly detail?: string
}

// --- provider ---

export interface ScreenshotProvider {
  /**
   * An address for a capture, safe to hand to a browser.
   *
   * @note carries no credential. An implementation that needs the request
   * authenticated must do it in a way that survives being public - a signature
   * over the parameters, which proves the platform composed them without
   * letting anyone compose their own.
   *
   * @throws `NOT_CONFIGURED` when no backend is installed.
   */
  publicUrl(url: string, options?: ScreenshotOptions): string

  /**
   * A capture the platform fetches itself, with whatever it must send.
   *
   * @throws `NOT_CONFIGURED` when no backend is installed.
   */
  request(url: string, options?: ScreenshotOptions): ScreenshotRequest

  /**
   * Reads the page metadata off a response to `request`.
   *
   * @note this takes the response headers rather than the response, and it is
   * the only place the contract touches one. Where the metadata rides is an
   * implementation detail - header names, encoding, whether it is JSON - and
   * putting the reading here is what keeps every one of those out of the
   * platform.
   *
   * Returns a fully null object rather than throwing when there is nothing to
   * read, including for an implementation that never sends any.
   */
  readMetadata(headers: Headers): ScreenshotMetadata

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
