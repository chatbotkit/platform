// @ts-check

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_SCRIPTS = ['https:', 'blob:', 'data:'].join(' ')

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_STYLES = ['https:', 'blob:', 'data:'].join(' ')

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_IMAGES = ['https:', 'blob:', 'data:'].join(' ')

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_FONTS = ['https:', 'blob:', 'data:'].join(' ')

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_MEDIA = ['https:', 'blob:', 'data:'].join(' ')

/**
 * @type {string}
 *
 */
const ALLOWED_CONNECTS = ['https:', 'blob:', 'data:', 'wss:'].join(' ')

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_FRAMES = ['https:', 'blob:', 'data:'].join(' ')

/**
 * @type {string}
 * @todo requires progressive hardening in the future
 */
const ALLOWED_WORKERS = ['https:', 'blob:', 'data:'].join(' ')

/**
 * Ancestors that may frame embeddable surfaces. `*` only matches network
 * schemes (http, https, ws, wss) per CSP3, so hybrid mobile apps - which
 * serve their WebView from an app-container scheme (Capacitor and Ionic on
 * iOS use `capacitor://localhost` / `ionic://localhost`) - need the scheme
 * listed explicitly or WebKit refuses to frame the widget.
 *
 * @type {string[]}
 */
const ALLOWED_FRAME_ANCESTOR_SCHEMES = ['capacitor:', 'ionic:']

/**
 * @type {string}
 */
const ALLOWED_FRAME_ANCESTORS = ['*', ...ALLOWED_FRAME_ANCESTOR_SCHEMES].join(
  ' '
)

/**
 * Matches an origin that may be whitelisted as a frame ancestor: web origins
 * and the app-container schemes above.
 *
 * @type {RegExp}
 */
const FRAME_ANCESTOR_ORIGIN_PATTERN = new RegExp(
  `^(https?:|${ALLOWED_FRAME_ANCESTOR_SCHEMES.join('|')})\\/\\/`,
  'i'
)

/**
 * @typedef {Object} SecurityHeadersConfig
 * @property {string|false} [xFrameOptions] - X-Frame-Options header value
 * @property {string|false} [contentSecurityPolicy] - Content-Security-Policy header value
 * @property {string|false} [xContentTypeOptions] - X-Content-Type-Options header value
 * @property {string|false} [referrerPolicy] - Referrer-Policy header value
 * @property {string|false} [permissionsPolicy] - Permissions-Policy header value
 * @property {string|false} [strictTransportSecurity] - Strict-Transport-Security header value
 * @property {string|false} [xXssProtection] - X-XSS-Protection header value
 * @property {string|false} [crossOriginEmbedderPolicy] - Cross-Origin-Embedder-Policy header value
 * @property {string|false} [crossOriginOpenerPolicy] - Cross-Origin-Opener-Policy header value
 * @property {string|false} [crossOriginResourcePolicy] - Cross-Origin-Resource-Policy header value
 */

/**
 * Default security headers for most endpoints
 *
 * @type {SecurityHeadersConfig}
 */
const DEFAULT_SECURITY_HEADERS = {
  // Prevent clickjacking attacks

  xFrameOptions: 'SAMEORIGIN',

  // Comprehensive Content Security Policy

  contentSecurityPolicy: [
    "default-src 'self'", // @note restricts all content to the same origin
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ALLOWED_SCRIPTS}`, // @note we cannot use nonce just yet, see https://nextjs.org/docs/app/guides/content-security-policy
    `style-src 'self' 'unsafe-inline' ${ALLOWED_STYLES}`, // @note unsafe-inline needed for css-in-js
    `img-src 'self' ${ALLOWED_IMAGES}`,
    `font-src 'self' ${ALLOWED_FONTS}`,
    `connect-src 'self' ${ALLOWED_CONNECTS}`,
    `media-src 'self' ${ALLOWED_MEDIA}`,
    `frame-src 'self' ${ALLOWED_FRAMES}`, // @note allows embedding of external content like widgets
    `worker-src 'self' ${ALLOWED_WORKERS}`,
    "frame-ancestors 'self'", // @note restricts embedding to the same origin
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),

  // Prevent MIME type sniffing

  xContentTypeOptions: 'nosniff',

  // Control referrer information

  referrerPolicy: 'same-origin',

  // Restrict dangerous features

  permissionsPolicy:
    'camera=(self), microphone=(self), geolocation=(self), payment=(self)',

  // Force HTTPS (only if serving over HTTPS)

  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',

  // XSS protection (legacy, but still useful for older browsers)

  xXssProtection: '1; mode=block',

  // Additional modern security headers

  crossOriginEmbedderPolicy: 'unsafe-none', // @note allows third-party iframes without coep requirements - needed for google tag manager
  crossOriginOpenerPolicy: 'unsafe-none', // @note allows setting up openners for any context - needed for oauth
  crossOriginResourcePolicy: 'cross-origin', // @note allows cross-origin resource loading
}

/**
 * Security headers for embeddable surfaces - widget, avatar and MCP frames,
 * example previews, cards and the widget scripts. These documents are
 * framed by third-party pages on arbitrary origins, so the only thing that
 * may differ from the default policy is *who may frame us*. Everything that
 * constrains what the framed document itself can do - scripts, connections,
 * forms, base URL, referrer, browser capabilities - stays as strict as the
 * default, because a widget frame that can be scripted from a hostile parent
 * is exactly the thing these headers exist to prevent.
 *
 * @note the framed document runs on the deployment's own origin (or a custom
 * domain mapped to it) and pulls its assets and API over `https:`/`wss:`,
 * which the default allow-lists already cover - nothing here needs to know
 * the parent's origin.
 *
 * @type {SecurityHeadersConfig}
 */
const EMBEDDABLE_SECURITY_HEADERS = {
  // @note omitted entirely: X-Frame-Options has no "any origin" value and
  // would override the CSP frame-ancestors directive below in older engines

  xFrameOptions: false,

  // Same policy as the default with one difference: any origin may frame us

  contentSecurityPolicy: [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ALLOWED_SCRIPTS}`, // @note we cannot use nonce just yet, see https://nextjs.org/docs/app/guides/content-security-policy
    `style-src 'self' 'unsafe-inline' ${ALLOWED_STYLES}`, // @note unsafe-inline needed for css-in-js
    `img-src 'self' ${ALLOWED_IMAGES}`,
    `font-src 'self' ${ALLOWED_FONTS}`,
    `connect-src 'self' ${ALLOWED_CONNECTS}`,
    `media-src 'self' ${ALLOWED_MEDIA}`,
    `frame-src 'self' ${ALLOWED_FRAMES}`,
    `worker-src 'self' ${ALLOWED_WORKERS}`,
    `frame-ancestors ${ALLOWED_FRAME_ANCESTORS}`, // @note the one deliberate difference: embeddable by any page, including hybrid mobile apps
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),

  // Prevent MIME type sniffing - unrelated to framing, and the widget scripts
  // are served with their correct type

  xContentTypeOptions: 'nosniff',

  // Send only the origin to cross-origin destinations; the frame never needs
  // to leak its full URL (which can carry conversation and contact ids) to
  // third parties it loads resources from

  referrerPolicy: 'strict-origin-when-cross-origin',

  // Same capability surface as the default; a parent page still has to
  // delegate camera/microphone through the iframe `allow` attribute for the
  // voice and avatar surfaces to get them

  permissionsPolicy:
    'camera=(self), microphone=(self), geolocation=(self), payment=(self)',

  // HTTPS pinning without `includeSubDomains`/`preload`: embeddable frames
  // are served on customers' custom domains too, and the platform must not
  // make transport commitments for a host it does not own. Broader HSTS is a
  // proxy/edge concern.

  strictTransportSecurity: 'max-age=31536000',

  // XSS protection (legacy, but still useful for older browsers)

  xXssProtection: '1; mode=block',

  // Cross-origin isolation headers. CORP must be `cross-origin` so the
  // widget scripts and frames load into pages that opt into COEP; COEP/COOP
  // stay unset - the frame has no reason to isolate, and isolating would
  // break the parent/child messaging the widget is built on.

  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: 'cross-origin',
}

/**
 * Paths that should use embeddable security headers (allow embedding)
 *
 * @type {string[]}
 */
const EMBEDDABLE_PATHS = [
  // Cards

  String.raw`/.+?/card$`,

  // Widget frame pages

  String.raw`/integrations/widget/.+?/frame`,
  String.raw`/integrations/widget/.+?/frame/.+`,

  // Static example widget previews (pages/examples/[slug]/preview.jsx) -
  // themed demo markup with no session or conversation, safe for external
  // surfaces to embed

  String.raw`/examples/.+?/preview$`,

  String.raw`/integrations/anam/.+?/frame`,
  String.raw`/integrations/anam/.+?/frame/.+`,

  String.raw`/integrations/avatar/.+?/frame`,
  String.raw`/integrations/avatar/.+?/frame/.+`,

  // String.raw`/integrations/recall/.+?/camera`,
  // String.raw`/integrations/recall/.+?/camera/.+`,
  // String.raw`/integrations/recall/.+?/screenshare`,
  // String.raw`/integrations/recall/.+?/screenshare/.+`,

  // Static widget assets

  String.raw`/integrations/widget/v1\.js`,
  String.raw`/integrations/widget/v2\.js`,
  String.raw`/integrations/widget/plugins/.+`,

  // MCP frame pages

  String.raw`/integrations/mcpserver/.+?/frame`,
  String.raw`/integrations/mcpserver/.+?/frame/.+`,

  // Static widget assets

  String.raw`/integrations/mcpserver/v1\.js`,
]

/**
 * Hosts that should be excluded from security headers entirely
 *
 * @type {string[]}
 */
const EXCLUDE_HOSTS = [
  // API routes don't need browser security headers

  String.raw`api\.`,
]

/**
 * Paths that should be excluded from security headers entirely
 *
 * @type {string[]}
 */
const EXCLUDE_PATHS = [
  // API routes don't need browser security headers

  String.raw`/api/.+`,
]

/**
 * Global report URI - if present it will be included in the CSP policy
 *
 * @type {string|undefined}
 */
const REPORT_URI = process.env.SENTRY_HEADERS_REPORT_URI

/**
 * Build the Content-Security-Policy for an embeddable surface that restricts
 * framing to an explicit origin whitelist. The result is the full embeddable
 * policy with only `frame-ancestors` replaced, so tightening who may frame
 * the document never loosens what the document itself may do.
 *
 * @param {string} [origin] - raw origin list as stored on the integration
 *   (comma, semicolon, whitespace or newline separated)
 * @returns {string|undefined} the policy, or undefined when no valid origin
 *   is configured (the route-level embeddable headers then apply)
 */
function buildOriginRestrictedCsp(origin) {
  const origins = Array.from(
    new Set(
      (origin || '')
        .split(/,|;|\s|\n/g)
        .map((o) => o.trim())
        .map((o) => o.replace(/\/+$/, ''))
        .filter((o) => o)
        .filter((o) => FRAME_ANCESTOR_ORIGIN_PATTERN.test(o))
    )
  )

  if (!origins.length) {
    return
  }

  const directives = (EMBEDDABLE_SECURITY_HEADERS.contentSecurityPolicy || '')
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith('frame-ancestors'))

  directives.push(`frame-ancestors 'self' ${origins.join(' ')}`)

  if (REPORT_URI) {
    directives.push(`report-uri ${REPORT_URI}`)
  }

  return directives.join('; ')
}

/**
 *
 */
export {
  ALLOWED_FRAME_ANCESTORS,
  DEFAULT_SECURITY_HEADERS,
  EMBEDDABLE_SECURITY_HEADERS,
  EMBEDDABLE_PATHS,
  EXCLUDE_HOSTS,
  EXCLUDE_PATHS,
  REPORT_URI,
  buildOriginRestrictedCsp,
}
