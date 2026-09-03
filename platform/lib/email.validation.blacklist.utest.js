import { isAllowedEmail, isAllowedEmailDomain } from '@/lib/email.validation'

// @note These tests mock the blacklist config with a small, controlled list so
// they exercise the *matching mechanism* - bare-TLD bans, exact-domain matches
// and subdomain matches - independently of the real (and frequently edited)
// blacklist contents. The real-config behaviour is covered in
// email.validation.utest.js.
//
// The list deliberately mixes the two kinds of entry we rely on:
//   - 'cfd'      -> a bare TLD: should block EVERY domain on that TLD
//   - 'ccwu.cc'  -> a specific domain: should block it and its subdomains ONLY,
//                   never the whole .cc TLD

jest.mock('@chatbotkit-dev/blacklists', () => ({
  __esModule: true,
  default: { domains: ['cfd', 'ccwu.cc', 'throwawaymail.com'] },
}))

describe('blacklist matching mechanism', () => {
  describe('bare TLD entry ("cfd") blocks the entire TLD', () => {
    it.each([
      'user@sfanrj.cfd',
      'user@imac.sfanrj.cfd', // multi-level subdomain is reduced then matched
      'user@anything.cfd',
      'q7xk2mzp9w@imac.sfanrj.cfd', // the real throwaway the heuristic missed
    ])('blocks %s', async (email) => {
      expect({ email, allowed: await isAllowedEmail(email) }).toEqual({
        email,
        allowed: false,
      })
    })

    it('blocks via isAllowedEmailDomain as well', async () => {
      expect(await isAllowedEmailDomain('imac.sfanrj.cfd')).toBe(false)
    })
  })

  describe('specific-domain entry ("ccwu.cc") is scoped, not TLD-wide', () => {
    it.each(['user@ccwu.cc', 'user@bydvip.ccwu.cc'])(
      'blocks %s',
      async (email) => {
        expect({ email, allowed: await isAllowedEmail(email) }).toEqual({
          email,
          allowed: false,
        })
      }
    )

    it('does NOT block a different domain on the same .cc TLD', async () => {
      // proves a specific-domain entry never leaks into a whole-TLD ban
      expect(await isAllowedEmail('user@realcompany.cc')).toBe(true)
    })
  })

  describe('does NOT over-match on substrings or adjacent names', () => {
    // @note the match is anchored at a dot boundary (=== domain OR endsWith
    // "." + domain), NOT a substring/`includes` test. These guard against the
    // classic over-block where a bare TLD "cfd" would wrongly catch a domain
    // that merely contains those letters - e.g. legitimate CFD trading sites.
    it.each([
      'user@cfdtrading.com', // contains "cfd" but is a .com, not the .cfd TLD
      'user@mycfd.io',
      'user@bestcfd.dev',
    ])('allows %s (substring of a bare-TLD entry)', async (email) => {
      expect({ email, allowed: await isAllowedEmail(email) }).toEqual({
        email,
        allowed: true,
      })
    })

    it.each([
      'user@xccwu.cc', // shares the "ccwu.cc" tail but is a different domain
      'user@notccwu.cc',
    ])('allows %s (adjacent to a specific-domain entry)', async (email) => {
      expect({ email, allowed: await isAllowedEmail(email) }).toEqual({
        email,
        allowed: true,
      })
    })
  })

  describe('unrelated domains stay allowed', () => {
    it.each(['user@gmail.com', 'user@example.com'])(
      'allows %s',
      async (email) => {
        expect({ email, allowed: await isAllowedEmail(email) }).toEqual({
          email,
          allowed: true,
        })
      }
    )
  })
})
