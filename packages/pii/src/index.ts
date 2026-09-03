import type {
  Entity,
  KnownEntity,
  LanguageCode,
  PiiProvider,
  SafeEntity,
  SafeTextAndEntities,
} from '@chatbotkit-dev/pii-spec'

export type * from '@chatbotkit-dev/pii-spec'

// @note the parameters below are named for the contract rather than for what
// this implementation does with them, which is nothing. Renaming them to
// satisfy the linter would make the public default the one place the surface is
// hard to read against the spec.
/* eslint-disable unused-imports/no-unused-vars */

// @note the community implementation does not detect personally identifiable
// information, because detecting it needs a vendor and this package must run
// with nothing configured.
//
// It is a pass through rather than a partial implementation. Detection finds
// nothing, so there is nothing to replace, so the safe text is the text and the
// round trip is the identity. That is coherent: a deployment with no detector
// installed sends its text out as written, which is what it would do without
// this module at all.
//
// Replace this package to redact for real. The replacement owns both halves:
// what counts as personal data is inseparable from how it is swapped out, and
// splitting them would leave this package asserting a redaction policy it
// cannot enforce.

/**
 * The score below which a detection is discarded.
 *
 * @note carried so that a caller passing a threshold has something to reason
 * about relative to. Nothing here scores anything.
 */
export const DEFAULT_PII_SCORE_THRESHOLD = 0.8

/**
 * Finds nothing, because no detector is configured.
 */
export async function detectPiiEntities(
  text: string,
  lang: LanguageCode = 'en',
  scoreThreshold: number = DEFAULT_PII_SCORE_THRESHOLD
): Promise<Entity[]> {
  return []
}

/**
 * Returns the text unchanged.
 *
 * @note with no detector there are no entities, so there is nothing this could
 * usefully do with the ones it is handed. It reports that nothing was replaced
 * rather than reporting replacements it did not make, so a caller that
 * unredacts afterwards gets its own text back either way.
 */
export function getSafeTextAndEntities(
  text: string,
  entities: Entity[],
  knownEntities: KnownEntity[] = []
): SafeTextAndEntities {
  return { safeText: text, safeEntities: [] }
}

/**
 * Returns the text unchanged. Nothing was replaced, so nothing is redacted.
 */
export function redactEntities(text: string, entities: SafeEntity[]): string {
  return text
}

/**
 * Returns the text unchanged, which is the inverse of redacting nothing.
 */
export function unredactEntities(text: string, entities: SafeEntity[]): string {
  return text
}

/**
 * @note the community implementation needs no configuration, so there is
 * nothing that can be misconfigured.
 */
export async function assertConfigured(): Promise<void> {
  // pass
}

const provider: PiiProvider = {
  detectPiiEntities,
  getSafeTextAndEntities,
  redactEntities,
  unredactEntities,
  assertConfigured,
}

export default provider
