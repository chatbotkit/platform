import {
  emailMatchesAnyPattern,
  emailMatchesPattern,
  isAllowedEmail,
  isReservedExampleEmail,
  looksLikeEmail,
  looksLikeThrowawayLocalPart,
  normalizeEmail,
  parseEmailPatterns,
} from '@/lib/email.validation'

describe('normalizeEmail', () => {
  it.each([
    ['test@test.com', 'test@test.com'],
    ['test@test.com.', 'test@test.com'],
    ['Test@Test.com', 'test@test.com'],
    ['!Test@Test.com', 'test@test.com'],
  ])('should normalize email', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected)
  })
})

describe('isReservedExampleEmail', () => {
  it('should return true for reserved example/test domains and TLDs', () => {
    const reserved = [
      'daily_trigger@example.com',
      'trader@example.com',
      'someone@example.net',
      'someone@example.org',
      'someone@sub.example.com',
      'someone@anything.test',
      'someone@anything.invalid',
      'someone@anything.example',
      'admin@localhost',
      'USER@EXAMPLE.COM',
    ]

    for (const email of reserved) {
      expect({ email, result: isReservedExampleEmail(email) }).toEqual({
        email,
        result: true,
      })
    }
  })

  it('should return false for real domains and malformed input', () => {
    const real = [
      'alice@acme.com',
      'john.doe@company.co',
      'user@gmail.com',
      'support@chatbotkit.com',
      'no-at-sign',
      '',
    ]

    for (const email of real) {
      expect({ email, result: isReservedExampleEmail(email) }).toEqual({
        email,
        result: false,
      })
    }
  })
})

describe('looksLikeEmail', () => {
  it('should return true for valid email', () => {
    const validEmails = [
      'test@example.com',
      'user123@gmail.com',
      'john.doe@company.co',
    ]

    for (const email of validEmails) {
      expect({ email, result: looksLikeEmail(email) }).toEqual({
        email,
        result: true,
      })
    }
  })

  it('should return false for invalid email', () => {
    const invalidEmails = [
      'test',
      'user123',
      'john.doe@company',
      'john.doe@company.',
      '@example.com',
      'test@example',
      'test@.com',
    ]

    for (const email of invalidEmails) {
      expect({ email, result: looksLikeEmail(email) }).toEqual({
        email,
        result: false,
      })
    }
  })
})

describe('isAllowedEmail', () => {
  it('should return true for allowed email', async () => {
    const allowedEmails = ['user@example.com', 'test@google.com']

    for (const email of allowedEmails) {
      expect({ email, result: await isAllowedEmail(email) }).toEqual({
        email,
        result: true,
      })
    }
  })

  it('should return false for not allowed email', async () => {
    const notAllowedEmails = [
      'test@anything.invalid',
      'test01@mailinator.com',
      'test02@mailinator.com',
      'test01@throwawaymail.com',
      'test02@throwawaymail.com',
    ]

    for (const email of notAllowedEmails) {
      expect({ email, result: await isAllowedEmail(email) }).toEqual({
        email,
        result: false,
      })
    }
  })

  it('should handle email without @ symbol gracefully', async () => {
    const result = await isAllowedEmail('notanemail')

    expect(result).toBe(false)
  })

  it('should handle empty string gracefully', async () => {
    const result = await isAllowedEmail('')

    expect(result).toBe(false)
  })

  it('should handle string with only @ symbol', async () => {
    const result = await isAllowedEmail('@')

    expect(result).toBe(false)
  })

  it('should deny (not throw) on nullish or non-string input', async () => {
    for (const input of [null, undefined, 0, {}, []]) {
      expect({ input, result: await isAllowedEmail(input) }).toEqual({
        input,
        result: false,
      })
    }
  })

  it('should reject machine-generated throwaway local parts on any domain', async () => {
    const throwawayEmails = [
      'tmpq8w3e7r1t5y9u2@lanxiu.cc',
      'tmpz4x6c8v1b3n5m7@gmail.com',
      'tmpl2k4j6h8g1f3d5@outlook.com',
    ]

    for (const email of throwawayEmails) {
      expect({ email, result: await isAllowedEmail(email) }).toEqual({
        email,
        result: false,
      })
    }
  })
})

describe('looksLikeThrowawayLocalPart', () => {
  it('should flag machine-generated throwaway local parts', () => {
    const throwaway = [
      // the real samples observed in production
      'tmpn7ifm8kcropoz5',
      'tmpz5hibwvclyfu7k',
      'tmpk74yskfq0yw7sl',
      // same random shape without the giveaway `tmp` prefix - the heuristic
      // must not depend on the prefix
      'x7ifm8kcropoz5aq',
      'a3kd9fjq2mzx8plv',
      'k7m3xq9wzp2bde',
      'q9wxz7bkfm3pltra',
      // base36-random with scattered digits and no consonant cluster - caught
      // by the entropy signal rather than the consonant-run signal
      'zi8pa4qo2ye6ub',
      // single digit block but strongly random (high entropy + `yzwb` cluster) -
      // the generator variant that clusters its digits
      'tmpusertn8766yzwb',
      // extreme consonant run (`fmdjqnhp` = 8) - the nimail.cn generator variant
      'fmdjqnhpox6j',
    ]

    for (const localPart of throwaway) {
      expect({
        localPart,
        result: looksLikeThrowawayLocalPart(localPart),
      }).toEqual({
        localPart,
        result: true,
      })
    }
  })

  it('should normalize case and surrounding whitespace before matching', () => {
    const throwaway = [
      'TMPN7IFM8KCROPOZ5',
      'TmpZ5hibWvClyFu7k',
      '  tmpk74yskfq0yw7sl  ',
    ]

    for (const localPart of throwaway) {
      expect({
        localPart,
        result: looksLikeThrowawayLocalPart(localPart),
      }).toEqual({
        localPart,
        result: true,
      })
    }
  })

  it('should not flag legitimate local parts', () => {
    const legitimate = [
      // too short to be confident
      'pdp',
      'john',
      'x1y2z3',
      // no digits at all
      'johnsmith',
      'robertdowneyjr',
      'williamshakespeare',
      // consonant-heavy but real names must survive the consonant-run signal.
      // hartschmidt has a 6-consonant run (rtschm) at the compound boundary -
      // right below the >= 7 bar - so these are the crossfire guards.
      'hartschmidt99',
      'schmidtwerner',
      'krishnamurthy',
      'mcconnellohara',
      'grzegorzwojcik',
      // digits kept in a single human-style block (year, zip, favourite number)
      'johnsmith2024',
      'alexander123456',
      'elizabeth2023',
      'michael90210',
      'agent007bond',
      'route66highway',
      'user2024newsletter',
      'christopher2000',
      'account12345678',
      // separators present - a strong sign of a human-chosen address
      'john.smith2024',
      'mary_jane99',
      'first.last',
      'jane+newsletter',
      // the exact throwaway shape but with a separator is left alone
      'tmpn7ifm8k.cropoz5',
    ]

    for (const localPart of legitimate) {
      expect({
        localPart,
        result: looksLikeThrowawayLocalPart(localPart),
      }).toEqual({
        localPart,
        result: false,
      })
    }
  })

  it('should respect the minimum-length boundary', () => {
    // identical scattered-digit shape, one character apart across the boundary
    expect(looksLikeThrowawayLocalPart('a1b2c3d4e5f')).toBe(false) // 11 chars
    expect(looksLikeThrowawayLocalPart('a1b2c3d4e5fg')).toBe(true) // 12 chars
  })

  it('should require scattered digits, not a single block', () => {
    // one digit block -> treated as human (a year/number)
    expect(looksLikeThrowawayLocalPart('marketing2024team')).toBe(false)
    // the same digits split into two groups -> machine signature
    expect(looksLikeThrowawayLocalPart('mark9eting2024team')).toBe(true)
  })

  it('should handle empty and malformed input gracefully', () => {
    expect(looksLikeThrowawayLocalPart('')).toBe(false)
    expect(looksLikeThrowawayLocalPart('   ')).toBe(false)
    expect(looksLikeThrowawayLocalPart('12345678901234')).toBe(false) // digits only, no letters
  })

  it('should deny (not throw) on nullish or non-string input', () => {
    for (const input of [null, undefined, 0, {}, []]) {
      expect({ input, result: looksLikeThrowawayLocalPart(input) }).toEqual({
        input,
        result: false,
      })
    }
  })
})

describe('emailMatchesPattern', () => {
  describe('wildcard pattern (*)', () => {
    it('should match any email with wildcard pattern', () => {
      expect(emailMatchesPattern('test@example.com', '*')).toBe(true)
      expect(emailMatchesPattern('user@domain.org', '*')).toBe(true)
      expect(emailMatchesPattern('a@b.c', '*')).toBe(true)
    })
  })

  describe('exact email match', () => {
    it('should match exact email address', () => {
      expect(emailMatchesPattern('test@example.com', 'test@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('user@example.com', 'test@example.com')).toBe(
        false
      )
    })

    it('should be case-insensitive', () => {
      expect(emailMatchesPattern('Test@Example.COM', 'test@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('test@example.com', 'TEST@EXAMPLE.COM')).toBe(
        true
      )
    })
  })

  describe('domain pattern (@domain.com)', () => {
    it('should match all emails from a domain', () => {
      expect(emailMatchesPattern('user1@example.com', '@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('user2@example.com', '@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('user@other.com', '@example.com')).toBe(false)
    })

    it('should be case-insensitive for domain pattern', () => {
      expect(emailMatchesPattern('User@Example.COM', '@example.com')).toBe(true)
      expect(emailMatchesPattern('user@example.com', '@EXAMPLE.COM')).toBe(true)
    })
  })

  describe('wildcard domain pattern (*@domain.com)', () => {
    it('should match all emails from a domain', () => {
      expect(emailMatchesPattern('user1@example.com', '*@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('user2@example.com', '*@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('user@other.com', '*@example.com')).toBe(false)
    })

    it('should be case-insensitive for wildcard domain pattern', () => {
      expect(emailMatchesPattern('User@Example.COM', '*@example.com')).toBe(
        true
      )
      expect(emailMatchesPattern('user@example.com', '*@EXAMPLE.COM')).toBe(
        true
      )
    })
  })

  describe('no match', () => {
    it('should return false when pattern does not match', () => {
      expect(emailMatchesPattern('user@example.com', 'other@example.com')).toBe(
        false
      )
      expect(emailMatchesPattern('user@example.com', '@other.com')).toBe(false)
      expect(emailMatchesPattern('user@example.com', '*@other.com')).toBe(false)
    })
  })
})

describe('parseEmailPatterns', () => {
  it('should parse newline-delimited patterns', () => {
    const input = 'user@example.com\n@chatbotkit.com\n*@test.org'

    expect(parseEmailPatterns(input)).toEqual([
      'user@example.com',
      '@chatbotkit.com',
      '*@test.org',
    ])
  })

  it('should parse comma-delimited patterns', () => {
    const input = 'user@example.com,@chatbotkit.com,*@test.org'

    expect(parseEmailPatterns(input)).toEqual([
      'user@example.com',
      '@chatbotkit.com',
      '*@test.org',
    ])
  })

  it('should parse mixed delimiters', () => {
    const input = 'user@example.com\n@chatbotkit.com,*@test.org'

    expect(parseEmailPatterns(input)).toEqual([
      'user@example.com',
      '@chatbotkit.com',
      '*@test.org',
    ])
  })

  it('should trim whitespace from patterns', () => {
    const input = '  user@example.com  \n  @chatbotkit.com  '

    expect(parseEmailPatterns(input)).toEqual([
      'user@example.com',
      '@chatbotkit.com',
    ])
  })

  it('should filter out empty lines', () => {
    const input = 'user@example.com\n\n\n@chatbotkit.com'

    expect(parseEmailPatterns(input)).toEqual([
      'user@example.com',
      '@chatbotkit.com',
    ])
  })

  it('should return empty array for empty input', () => {
    expect(parseEmailPatterns('')).toEqual([])
    expect(parseEmailPatterns('   ')).toEqual([])
    expect(parseEmailPatterns('\n\n')).toEqual([])
  })
})

describe('emailMatchesAnyPattern', () => {
  it('should return true when email matches one of the patterns', () => {
    const patterns = ['user@example.com', '@chatbotkit.com', '*@test.org']

    expect(emailMatchesAnyPattern('user@example.com', patterns)).toBe(true)
    expect(emailMatchesAnyPattern('admin@chatbotkit.com', patterns)).toBe(true)
    expect(emailMatchesAnyPattern('dev@test.org', patterns)).toBe(true)
  })

  it('should return false when email matches none of the patterns', () => {
    const patterns = ['user@example.com', '@chatbotkit.com', '*@test.org']

    expect(emailMatchesAnyPattern('other@example.com', patterns)).toBe(false)
    expect(emailMatchesAnyPattern('user@other.com', patterns)).toBe(false)
  })

  it('should return false when patterns array is empty (deny by default)', () => {
    expect(emailMatchesAnyPattern('any@email.com', [])).toBe(false)
    expect(emailMatchesAnyPattern('user@example.com', [])).toBe(false)
  })
})
