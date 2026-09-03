/**
 * Recursively redacts high-entropy strings from an object structure.
 * Useful for masking potential passwords, API keys, tokens, and other sensitive data.
 */

/**
 * Configuration options for entropy-based redaction
 */
export interface RedactEntropyOptions {
  /**
   * Number of characters to preserve at the end of redacted strings
   * @default 3
   */
  preserveLastChars?: number

  /**
   * Entropy threshold above which strings are considered sensitive
   * Shannon entropy is measured in bits. Common thresholds:
   * - 3.0-3.5: Lower threshold, catches more strings
   * - 4.0-4.5: Higher threshold, more selective
   * @default 4.0
   */
  entropyThreshold?: number

  /**
   * Minimum string length to consider for redaction
   * Short strings typically don't contain secrets
   * @default 8
   */
  minLength?: number

  /**
   * Maximum string length to analyze
   * Very long strings (like prose) are skipped for performance
   * @default 256
   */
  maxLength?: number

  /**
   * Character used for masking
   * @default '*'
   */
  maskChar?: string

  /**
   * Whether to detect and redact embedded tokens with known prefixes
   * @default true
   */
  redactEmbeddedTokens?: boolean

  /**
   * Minimum length for a delimited token to be considered by the generic
   * per-token entropy pass. Higher than {@link minLength} because the whole
   * string is not the candidate here - individual tokens are - and short
   * high-entropy fragments are usually not secrets.
   * @default 20
   */
  tokenMinLength?: number

  /**
   * Entropy threshold for the generic per-token pass. Deliberately higher than
   * {@link entropyThreshold}: structured identifiers (cuids, uuids, git shas)
   * sit around 3.7-4.0 bits/char while real secrets sit at 4.4+, so the bar is
   * placed in the gap to avoid masking benign ids.
   * @default 4.2
   */
  tokenEntropyThreshold?: number
}

const DEFAULT_OPTIONS: Required<RedactEntropyOptions> = {
  preserveLastChars: 3,
  entropyThreshold: 4.0,
  minLength: 8,
  maxLength: 256,
  maskChar: '*',
  redactEmbeddedTokens: true,
  tokenMinLength: 20,
  tokenEntropyThreshold: 4.2,
}

/**
 * Patterns that match known token/secret formats embedded in text
 * These patterns capture the full token including the prefix
 * @note uses word boundary to avoid partial matches
 */
const EMBEDDED_TOKEN_PATTERNS: RegExp[] = [
  // @note matches patterns like: prefix_sk_xxx, prefix_key_xxx, prefix_secret_xxx, prefix_token_xxx, prefix_claim_xxx
  /\b[a-zA-Z0-9]+_(sk|key|secret|token|claim|api|auth|pwd|pass)_[a-zA-Z0-9_-]{8,}\b/gi,
  // @note matches patterns like: sk-xxx, pk-xxx, api-xxx (common API key formats)
  /\b(sk|pk|api|key|secret|token)-[a-zA-Z0-9_-]{16,}\b/gi,
  // @note matches AWS-style keys: AKIA followed by 16+ chars
  /\bAKIA[A-Z0-9]{16,}\b/g,
  // @note GitHub tokens embedded in e.g. `x-access-token:ghs_...@github.com`
  // clone urls. Personal/oauth/user/server/refresh tokens share a gh?_ prefix
  // (ghp_/gho_/ghu_/ghs_/ghr_) followed by a base62 secret. These carry no
  // `_sk_`-style marker, so none of the patterns above catch them.
  /\bgh[oprsu]_[A-Za-z0-9]{20,}\b/g,
  // @note fine-grained GitHub PATs: github_pat_ prefix followed by two base62
  // segments joined by an underscore
  /\bgithub_pat_[A-Za-z0-9]{20,}_[A-Za-z0-9]{20,}\b/g,
]

// @note preserve the auth scheme label, but fully redact the credential body
const BEARER_TOKEN_PATTERN = /\bBearer\s+([^\s'"`]{20,})/gi

/**
 * Calculates Shannon entropy of a string
 * Returns entropy in bits per character
 */
export function calculateEntropy(str: string): number {
  if (!str || str.length === 0) {
    return 0
  }

  const charCounts: Record<string, number> = {}

  for (const char of str) {
    charCounts[char] = (charCounts[char] || 0) + 1
  }

  const len = str.length
  let entropy = 0

  for (const char in charCounts) {
    const probability = charCounts[char] / len

    entropy -= probability * Math.log2(probability)
  }

  return entropy
}

/**
 * Checks if a string looks like a high-entropy secret
 */
export function isHighEntropyString(
  str: string,
  options: Required<RedactEntropyOptions>
): boolean {
  const { entropyThreshold, minLength, maxLength } = options

  if (typeof str !== 'string') {
    return false
  }

  const len = str.length

  if (len < minLength || len > maxLength) {
    return false
  }

  // @note skip strings that look like natural language (contain spaces and common punctuation patterns)
  if (/^[a-zA-Z\s.,!?;:'"()-]+$/.test(str) && str.includes(' ')) {
    return false
  }

  // @note skip URLs and email addresses - they have high entropy but are not secrets
  if (/^https?:\/\//.test(str) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return false
  }

  // @note skip strings that are mostly numeric with formatting (phone numbers, dates, etc.)
  if (/^[\d\s()+.-]+$/.test(str)) {
    return false
  }

  const entropy = calculateEntropy(str)

  return entropy >= entropyThreshold
}

/**
 * Redacts a string, preserving the last N characters
 */
export function redactString(
  str: string,
  options: Required<RedactEntropyOptions>
): string {
  const { preserveLastChars, maskChar } = options

  if (str.length <= preserveLastChars) {
    return maskChar.repeat(str.length)
  }

  const maskLength = str.length - preserveLastChars
  const preserved = str.slice(-preserveLastChars)

  return maskChar.repeat(maskLength) + preserved
}

/**
 * Masks a value that is known to be sensitive, unconditionally.
 *
 * Unlike {@link redactEntropyFields}, this skips the entropy/length heuristics
 * used for auto-detecting secrets in arbitrary data - use it when the caller
 * already knows the field holds a secret (e.g. a credentials field) so even
 * short or low-entropy values are masked. The last few characters are
 * preserved so the value stays recognisable.
 */
export function redactSecret(
  str: string,
  options: RedactEntropyOptions = {}
): string {
  const mergedOptions: Required<RedactEntropyOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  return redactString(str, mergedOptions)
}

/**
 * Redacts the secret portion of a token while preserving its prefix
 * @example "moltbook_sk_Wk4gjx2IXVWoG0M4zdx_mlEzz4HuUz2w" -> "moltbook_sk_***...***z2w"
 */
function redactTokenPreservingPrefix(
  token: string,
  options: Required<RedactEntropyOptions>
): string {
  const { preserveLastChars, maskChar } = options

  // @note find the separators between the prefix label(s) and the secret body.
  // Two-part prefixes like `moltbook_sk_` keep everything up to the second
  // separator; single-part prefixes like `ghs_` or `sk-` keep up to the first.
  const separatorMatches = [...token.matchAll(/[_-]/g)]

  if (separatorMatches.length >= 1) {
    const separator =
      separatorMatches.length >= 2 ? separatorMatches[1] : separatorMatches[0]
    const prefixEnd = separator.index! + 1
    const prefix = token.slice(0, prefixEnd)
    const secretPart = token.slice(prefixEnd)

    if (secretPart.length <= preserveLastChars) {
      return prefix + maskChar.repeat(secretPart.length)
    }

    const maskLength = secretPart.length - preserveLastChars
    const preserved = secretPart.slice(-preserveLastChars)

    return prefix + maskChar.repeat(maskLength) + preserved
  }

  // @note no separator at all (e.g. AKIA...) - fall back to simple redaction
  return redactString(token, options)
}

/**
 * Redacts known token patterns embedded within a larger string
 */
export function redactEmbeddedTokens(
  str: string,
  options: Required<RedactEntropyOptions>
): string {
  let result = str.replace(BEARER_TOKEN_PATTERN, (_, credential: string) => {
    return `Bearer ${redactString(credential, options)}`
  })

  for (const pattern of EMBEDDED_TOKEN_PATTERNS) {
    // @note reset lastIndex for global regex
    pattern.lastIndex = 0

    result = result.replace(pattern, (match) => {
      return redactTokenPreservingPrefix(match, options)
    })
  }

  return result
}

// @note boundaries that commonly border a secret but never appear inside one:
// whitespace plus shell/url/json punctuation. We deliberately keep `_`, `-` and
// `.` OUT of this set because token secrets (github_pat_..., sk-proj-...) and
// JWTs (a.b.c) embed them. The capturing group keeps the delimiters so the
// string can be rebuilt verbatim around the redacted tokens.
const TOKEN_BOUNDARY = /([\s:@/\\="'`,;()<>{}[\]|?!$%^&*+~#]+)/

/**
 * Counts how many distinct character classes (lowercase, uppercase, digit) a
 * token uses. Real secrets mix at least two; single-case words and file paths
 * use one, which lets us cheaply skip most prose.
 */
function countCharClasses(token: string): number {
  let count = 0

  if (/[a-z]/.test(token)) {
    count++
  }

  if (/[A-Z]/.test(token)) {
    count++
  }

  if (/[0-9]/.test(token)) {
    count++
  }

  return count
}

/**
 * Whether a single delimited token looks like a high-entropy secret. This is the
 * generic counterpart to the prefix patterns: it needs no vendor-specific format,
 * only length, character-class mix and Shannon entropy, so it catches unknown
 * credential shapes regardless of how long the surrounding string is.
 */
function isHighEntropyToken(
  token: string,
  options: Required<RedactEntropyOptions>
): boolean {
  const { tokenMinLength, tokenEntropyThreshold, maskChar } = options

  if (token.length < tokenMinLength) {
    return false
  }

  // @note skip anything already masked (e.g. by the prefix pass that runs first)
  // so we never double-process a redacted token
  if (token.includes(maskChar)) {
    return false
  }

  if (countCharClasses(token) < 2) {
    return false
  }

  return calculateEntropy(token) >= tokenEntropyThreshold
}

/**
 * Splits a string into delimited tokens and redacts the ones that look like
 * high-entropy secrets, leaving all surrounding text and delimiters intact.
 *
 * Unlike the whole-string {@link isHighEntropyString} check, this is not gated on
 * the length of the containing string, so a secret embedded in a long command or
 * log line is still caught - and unlike {@link redactEmbeddedTokens} it needs no
 * known prefix.
 */
export function redactHighEntropyTokens(
  str: string,
  options: Required<RedactEntropyOptions>
): string {
  return str
    .split(TOKEN_BOUNDARY)
    .map((token) =>
      isHighEntropyToken(token, options) ? redactString(token, options) : token
    )
    .join('')
}

function recursiveRedact<T>(
  value: T,
  options: Required<RedactEntropyOptions>
): T {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    // @note 1. a lone value that is itself high-entropy (short api keys, punctuated
    // passwords) - mask the whole thing
    if (isHighEntropyString(value, options)) {
      return redactString(value, options) as T
    }

    let result: string = value

    // @note 2. known token prefixes embedded in the string (precise; preserves the
    // scheme label, e.g. ghs_***, Bearer ***)
    if (options.redactEmbeddedTokens) {
      result = redactEmbeddedTokens(result, options)
    }

    // @note 3. generic per-token entropy sweep for unknown secret formats, at any
    // string length. Runs last so it skips tokens already masked in step 2.
    result = redactHighEntropyTokens(result, options)

    return result as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => recursiveRedact(item, options)) as T
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}

    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = recursiveRedact(
          (value as Record<string, unknown>)[key],
          options
        )
      }
    }

    return result as T
  }

  return value
}

/**
 * Recursively applies entropy-based redaction to all string fields in an object
 */
export function redactEntropyFields<T>(
  value: T,
  options: RedactEntropyOptions = {}
): T {
  const mergedOptions: Required<RedactEntropyOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  return recursiveRedact(value, mergedOptions)
}

/**
 * Redacts high-entropy strings from a messages array structure
 * Convenience function for message-specific redaction
 */
export function redactMessagesEntropy<
  T extends { text?: string; meta?: Record<string, unknown> },
>(messages: T[], options: RedactEntropyOptions = {}): T[] {
  return redactEntropyFields(messages, options)
}
