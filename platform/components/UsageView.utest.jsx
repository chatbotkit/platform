import { hasExceededUsageLimit } from './UsageView'

describe('hasExceededUsageLimit', () => {
  it('should return false when usage is below every limit', () => {
    const usage = { tokens: { value: 10 }, conversations: { value: 5 } }
    const limits = { tokens: 100, conversations: 100 }

    expect(hasExceededUsageLimit(usage, {}, limits)).toBe(false)
  })

  it('should return true when a top-level usage metric reaches its limit', () => {
    const usage = { tokens: { value: 100 } }
    const limits = { tokens: 100 }

    expect(hasExceededUsageLimit(usage, {}, limits)).toBe(true)
  })

  it('should match limits case-insensitively', () => {
    const usage = { Tokens: { value: 150 } }
    const limits = { tokens: 100 }

    expect(hasExceededUsageLimit(usage, {}, limits)).toBe(true)
  })

  it('should return true when a nested other-usage metric is exceeded', () => {
    const otherUsage = { 'database/bots': 3 }
    const limits = { database: { bots: 3 } }

    expect(hasExceededUsageLimit({}, otherUsage, limits)).toBe(true)
  })

  it('should ignore infinite or serialized-infinite limits', () => {
    const usage = { tokens: { value: 1_000_000 } }

    expect(hasExceededUsageLimit(usage, {}, { tokens: Infinity })).toBe(false)
    expect(hasExceededUsageLimit(usage, {}, { tokens: '$Infinity' })).toBe(
      false
    )
    expect(hasExceededUsageLimit(usage, {}, {})).toBe(false)
  })

  it('should not flag a zero limit with zero usage', () => {
    const usage = { tokens: { value: 0 } }
    const limits = { tokens: 0 }

    expect(hasExceededUsageLimit(usage, {}, limits)).toBe(false)
  })

  it('should flag any consumption against a zero limit', () => {
    const usage = { tokens: { value: 1 } }
    const limits = { tokens: 0 }

    expect(hasExceededUsageLimit(usage, {}, limits)).toBe(true)
  })

  it('should tolerate missing arguments', () => {
    expect(hasExceededUsageLimit()).toBe(false)
    expect(hasExceededUsageLimit(null, null, null)).toBe(false)
  })
})
