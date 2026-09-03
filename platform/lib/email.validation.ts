import blacklist from '@chatbotkit-dev/blacklists'

import { calculateEntropy } from '@/lib/redact.entropy'

import * as EmailValidator from 'email-validator'
import { ParseResultType, parseDomain } from 'parse-domain'

/**
 * Normalizes email input by removing special characters and trimming
 */
function normalizeInput(input: string): string {
  // @note the function will remove ! and . from the start and end of the input
  // and then trim it - both ! and . have special meaning in the context of
  // email addresses and we want to make sure that we are not going to end up
  // with false positives

  // @note the symbol ! is specifically used internally to denote an internal
  // email address and it is not part of the email address itself

  // @note guard against nullish / non-string input so every email helper that
  // funnels through here degrades to an empty (i.e. invalid / disallowed)
  // address instead of throwing a TypeError on bad input
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .toLowerCase()
    .trim()
    .replace(/^!+|\.+$/g, '')
    .trim()
}

/**
 * Returns the length of the longest run of consecutive consonant letters in a
 * string. Digits and vowels reset the run. Pronounceable, human-chosen handles
 * rarely stack more than three consonants; random generators frequently do.
 */
function longestConsonantRun(value: string): number {
  let longest = 0
  let current = 0

  for (const char of value) {
    if (/[bcdfghjklmnpqrstvwxyz]/.test(char)) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }

  return longest
}

/**
 * Heuristically detects machine-generated "throwaway" email local parts such
 * as `tmpn7ifm8kcropoz5` - the random strings produced by disposable-account
 * generators. This is deliberately domain-agnostic and list-free, so it keeps
 * working when a bot rotates to a fresh domain instead of requiring us to
 * chase domains in a maintained blacklist.
 *
 * The bar is set high on purpose: a false positive silently turns away a real
 * customer at sign-in, which is worse than letting a throwaway through. A local
 * part must first clear these gates (all required):
 *
 *  - it is long (>= 12 chars) - hand-picked handles are usually shorter;
 *  - it is plain alphanumeric with no `. _ - +` separators - humans use these,
 *    generators rarely do;
 *  - it contains at least one letter and at least one digit.
 *
 * It is then flagged when ANY randomness signature holds:
 *
 *  - *extreme consonant run* - 7+ consecutive consonants is non-linguistic and
 *    on its own marks a generated string (`fmdjqnhpox6j`); the bar is 7 so real
 *    concatenated surnames (`hartschmidt` -> 6) are not caught; or
 *  - *scattered digits* - two or more digit groups split by letters, plus a
 *    modest randomness check. Humans keep numbers in a single block - a year, a
 *    zip, a favourite number (`johnsmith2024`, `route66highway`, `agent007bond`)
 *    - so this alone excludes most legitimate addresses; or
 *  - *single digit block but strongly random* - to catch generators that
 *    cluster their digits (`tmpusertn8766yzwb`) we still flag a single-block
 *    local part, but only with much stronger evidence: high Shannon entropy AND
 *    an unpronounceable consonant cluster. That pair separates a generated
 *    string (entropy ~3.85, run `yzwb`) from word+year handles like
 *    `johnsmith2024` (entropy ~3.39) and `account12345678` (no consonant run).
 *
 * These thresholds are intentionally conservative and easy to tune; the unit
 * tests pin the expected boundary.
 */
export function looksLikeThrowawayLocalPart(localPart: string): boolean {
  // @note tolerate nullish / non-string input rather than throwing
  if (typeof localPart !== 'string') {
    return false
  }

  const value = localPart.trim().toLowerCase()

  // short local parts overlap heavily with legitimate handles
  if (value.length < 12) {
    return false
  }

  // separators are a strong signal of a human-chosen address
  if (/[._+-]/.test(value)) {
    return false
  }

  // only consider plain alphanumeric local parts
  if (!/^[a-z0-9]+$/.test(value)) {
    return false
  }

  const hasLetter = /[a-z]/.test(value)

  // a handle is expected to contain letters
  if (!hasLetter) {
    return false
  }

  const digitRuns = value.match(/[0-9]+/g) || []
  const entropy = calculateEntropy(value)
  const consonantRun = longestConsonantRun(value)

  // an extreme consonant run (7+ in a row) is essentially non-linguistic - a
  // strong standalone signal, digits or not (e.g. `fmdjqnhpox6j` has a run of
  // 8). The bar is 7 not 6 on purpose: concatenated real surnames can hit 6
  // consonants at a compound boundary (`hartschmidt` -> `rtschm`), and turning
  // away a real person is worse than missing one generated handle.
  if (consonantRun >= 7) {
    return true
  }

  // the remaining signals all rely on a mix of letters and digits
  if (digitRuns.length < 1) {
    return false
  }

  // scattered digits (2+ groups split by letters) is a strong signal - a modest
  // randomness check is enough.
  if (digitRuns.length >= 2 && (entropy >= 3.4 || consonantRun >= 4)) {
    return true
  }

  // a single digit block can still be generated (`tmpusertn8766yzwb`) rather
  // than word+year (`johnsmith2024`); demand much stronger randomness to tell
  // them apart: high entropy AND an unpronounceable consonant cluster.
  if (entropy >= 3.6 && consonantRun >= 4) {
    return true
  }

  return false
}

/**
 * Checks if an email domain is allowed based on blacklist and domain validation
 */
export async function isAllowedEmailDomain(input: string): Promise<boolean> {
  input = normalizeInput(input)

  try {
    const result = parseDomain(input)

    switch (result.type) {
      case ParseResultType.Invalid: {
        return false
      }

      case ParseResultType.NotListed: {
        return false
      }

      case ParseResultType.Reserved: {
        return false
      }

      case ParseResultType.Ip: {
        return false
      }
    }

    input = result.domain
      ? result.domain + '.' + result.topLevelDomains.join('.')
      : input
  } catch {
    return false
  }

  for (const domain of blacklist.domains) {
    if (input === domain || input.endsWith(`.${domain}`)) {
      return false
    }
  }

  return true
}

/**
 * Checks if an email address is allowed based on domain rules
 */
export async function isAllowedEmail(input: string): Promise<boolean> {
  const parts = normalizeInput(input).split('@')

  const localPart = parts[0]?.trim()
  const domain = parts[1]?.trim()

  // @note if input doesn't contain @, domain will be undefined - reject for safety

  if (!domain) {
    return false
  }

  // @note domain-agnostic heuristic: reject machine-generated throwaway local
  // parts (e.g. tmpn7ifm8kcropoz5) regardless of domain, so we do not have to
  // chase disposable domains one by one in the blacklist

  if (localPart && looksLikeThrowawayLocalPart(localPart)) {
    return false
  }

  return await isAllowedEmailDomain(domain)
}

/**
 * Validates email format using email-validator library
 */
export function isValidEmail(input: string): boolean {
  return EmailValidator.validate(input)
}

/**
 * Reserved second-level example domains (RFC 2606) that can never belong to a
 * real person.
 */
const RESERVED_EXAMPLE_DOMAINS = ['example.com', 'example.net', 'example.org']

/**
 * Reserved top-level domains (RFC 2606 / RFC 6761) used for documentation,
 * testing and examples that can never belong to a real person.
 */
const RESERVED_EXAMPLE_TLDS = [
  'example',
  'test',
  'invalid',
  'localhost',
  'local',
]

/**
 * Checks whether an email lives on a reserved example/test/documentation domain
 * (RFC 2606 / RFC 6761), e.g. `someone@example.com`. Such addresses are not
 * real contacts - they are commonly produced by LLM extraction when a
 * conversation has no human counterpart - and must never be persisted as
 * contacts.
 */
export function isReservedExampleEmail(input: string): boolean {
  const domain = normalizeInput(input).split('@')[1]?.trim()

  if (!domain) {
    return false
  }

  for (const reserved of RESERVED_EXAMPLE_DOMAINS) {
    if (domain === reserved || domain.endsWith(`.${reserved}`)) {
      return true
    }
  }

  const tld = domain.split('.').pop()

  return tld ? RESERVED_EXAMPLE_TLDS.includes(tld) : false
}

/**
 * Performs a simple regex check to see if input looks like an email
 */
export function looksLikeEmail(input: string): boolean {
  return /\S+@\S+\.\S+/.test(input)
}

/**
 * Normalizes and validates an email address
 * @throws {Error} If email is invalid
 */
export function normalizeEmail(input: string): string {
  // @note It is a terrible to do this to emails in general. The reason for
  // this is because it is not RFC compatible. However, we have certain parts
  // of the code-base that rely on email to email mappings. Without
  // normalizing the email we are going to end up with database rows not
  // matching properly. This also results in a problem with prisma which can
  // break the entire program.

  input = normalizeInput(input)

  if (!isValidEmail(input)) {
    throw new Error(`Email is invalid`)
  }

  return input
}

/**
 * Checks if an email matches a given pattern. Patterns can be:
 * - `*` - matches all emails
 * - `user@example.com` - exact email match
 * - `@example.com` - matches all emails from the domain
 * - `*@example.com` - matches all emails from the domain (wildcard syntax)
 */
export function emailMatchesPattern(email: string, pattern: string): boolean {
  // normalize both email and pattern for comparison
  email = normalizeInput(email)
  pattern = normalizeInput(pattern)

  // wildcard matches all emails
  if (pattern === '*') {
    return true
  }

  // exact email match
  if (email === pattern) {
    return true
  }

  // extract domain from email (part after the first @)
  const atIndex = email.indexOf('@')
  const domain = atIndex !== -1 ? email.slice(atIndex + 1).trim() : ''

  if (domain) {
    // @domain.com - matches all emails from the domain
    if (pattern === `@${domain}`) {
      return true
    }

    // *@domain.com - matches all emails from the domain with wildcard syntax
    if (pattern === `*@${domain}`) {
      return true
    }
  }

  return false
}

/**
 * Parses a string of email patterns separated by newlines or commas into an
 * array of patterns. Empty lines and whitespace are removed.
 */
export function parseEmailPatterns(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
}

/**
 * Checks if an email matches any of the patterns in a list. If the list is
 * empty, no emails are allowed (returns false) for safety.
 */
export function emailMatchesAnyPattern(
  email: string,
  patterns: string[]
): boolean {
  // @note if no patterns are specified, deny by default for safety

  if (patterns.length === 0) {
    return false
  }

  return patterns.some((pattern) => emailMatchesPattern(email, pattern))
}
