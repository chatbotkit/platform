// @note the contract for detecting and redacting personally identifiable
// information. Implementations decide what counts as PII, which vendor or model
// finds it, and what a detected value is replaced with. None of that appears
// here, because none of it is the platform's concern.
//
// The platform's use of this module is a round trip: text goes out to a model,
// an agent or a third party with its personal data replaced by opaque tokens,
// and the tokens are put back when the reply comes home. Two properties of that
// round trip belong to the caller rather than to an implementation, so they are
// stated here:
//
//   stable     - the same value gets the same token throughout one call, so a
//                name mentioned twice does not come back as two people.
//
//   reversible - unredacting undoes redacting exactly, so the user reads their
//                own text back rather than a token.
//
// Detection is the part that needs a vendor. Everything else is text handling
// that an implementation may do however it likes, including not at all.

/**
 * The languages detection may be asked to work in.
 *
 * @note ISO 639-1, plus the regional variant Chinese needs. Deliberately a
 * closed set: a caller passing a language its detector cannot read should find
 * out at the type level, not by receiving no entities.
 */
export type LanguageCode =
  | 'ar'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'hi'
  | 'it'
  | 'ja'
  | 'ko'
  | 'pt'
  | 'zh'
  | 'zh-TW'

/**
 * A span of the original text that a detector considers personal data.
 */
export interface Entity {
  /**
   * What kind of personal data this is - `name`, `email`, `phone_number`.
   *
   * @note lower case, and otherwise open: implementations classify with
   * whatever taxonomy their detector has. The platform carries the value into
   * the replacement token and does not interpret it.
   */
  type: string

  /** Offset of the first character, in the original text. */
  begin: number

  /** Offset one past the last character, in the original text. */
  end: number
}

/**
 * A span the caller already knows about and does not want replaced.
 *
 * @note offsets are into the safe text as built so far, not the original. The
 * caller is usually protecting something it has itself put into the text, such
 * as a token from an earlier round trip, which would otherwise be detected and
 * replaced a second time.
 */
export interface KnownEntity {
  begin: number
  end: number
}

/**
 * A detected entity together with the token that stands in for it.
 */
export interface SafeEntity {
  type: string

  /** Offsets into the original text. */
  begin: number
  end: number

  /** The original text of the entity, which is the personal data itself. */
  text: string

  /**
   * The token, and where it sits in the safe text.
   *
   * @note the offsets differ from `begin` and `end` above because a token is
   * rarely the same length as the value it replaces.
   */
  replacement: {
    begin: number
    end: number
    text: string
  }
}

/**
 * Text with its personal data replaced, and the record needed to put it back.
 */
export interface SafeTextAndEntities {
  safeText: string
  safeEntities: SafeEntity[]
}

export interface PiiProvider {
  /**
   * Finds the personal data in a piece of text.
   *
   * @note `scoreThreshold` is the detector's own confidence scale. An
   * implementation supplies its default, because what a score means is a
   * property of the detector and not something the platform can set.
   */
  detectPiiEntities(
    text: string,
    lang?: LanguageCode,
    scoreThreshold?: number
  ): Promise<Entity[]>

  /**
   * Replaces detected entities with tokens, and reports what was replaced.
   *
   * @note entities are applied in the order given and offsets are tracked as
   * the text changes, so the caller does not have to sort them.
   */
  getSafeTextAndEntities(
    text: string,
    entities: Entity[],
    knownEntities?: KnownEntity[]
  ): SafeTextAndEntities

  /**
   * Replaces every occurrence of each entity's value with its token.
   *
   * @note distinct from `getSafeTextAndEntities`, which works from offsets in
   * one specific string. This works from the values, so it can be applied to
   * text derived from the original - a summary, a model's reply - where the
   * offsets no longer mean anything.
   */
  redactEntities(text: string, entities: SafeEntity[]): string

  /**
   * The inverse of `redactEntities`: puts the original values back.
   */
  unredactEntities(text: string, entities: SafeEntity[]): string

  /**
   * Throws when this implementation is not usable with the current
   * configuration. See packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}
