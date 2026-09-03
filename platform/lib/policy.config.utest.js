import { PolicyConfig } from '@/prisma/zod'

import { parsePolicyConfig } from '@/lib/policy.config'

describe('PolicyConfig', () => {
  it('preserves a usage config parsed through the loose union', () => {
    // @note guards the union branch order: RetentionPolicyConfig has only
    // optional keys and strips unknown ones, so if it were tried first it
    // would match a usage config and silently strip it to `{}`
    const config = {
      metric: 'tokens',
      threshold: 100000,
      windowInSeconds: 600,
      actions: { block: { durationInSeconds: 600 } },
    }

    expect(PolicyConfig.parse(config)).toEqual(config)
  })
})

describe('parsePolicyConfig', () => {
  describe('pass-through', () => {
    it('returns null/undefined config unchanged without needing a type', () => {
      expect(parsePolicyConfig('retention', null)).toBeNull()
      expect(parsePolicyConfig('usage', undefined)).toBeUndefined()
    })

    it('throws for an unknown policy type when a config is present', () => {
      expect(() => parsePolicyConfig('nope', {})).toThrow(/unknown policy type/)
    })
  })

  describe('retention', () => {
    it('accepts a positive expiresInDays', () => {
      expect(parsePolicyConfig('retention', { expiresInDays: 30 })).toEqual({
        expiresInDays: 30,
      })
    })

    it('accepts an empty config (no expiry configured)', () => {
      expect(parsePolicyConfig('retention', {})).toEqual({})
    })

    it('rejects a zero or negative expiresInDays', () => {
      expect(() =>
        parsePolicyConfig('retention', { expiresInDays: 0 })
      ).toThrow()
      expect(() =>
        parsePolicyConfig('retention', { expiresInDays: -1 })
      ).toThrow()
    })
  })

  describe('usage', () => {
    const valid = {
      metric: 'tokens',
      threshold: 100000,
      windowInSeconds: 600,
      actions: { block: { durationInSeconds: 600 } },
    }

    it('accepts a valid usage config with a block action', () => {
      expect(parsePolicyConfig('usage', valid)).toMatchObject({
        metric: 'tokens',
        actions: { block: { durationInSeconds: 600 } },
      })
    })

    it('accepts an email action without recipients', () => {
      const result = parsePolicyConfig('usage', {
        ...valid,
        actions: { email: {} },
      })

      expect(result.actions.email).toEqual({})
    })

    it('accepts an email action as a single recipient string', () => {
      const result = parsePolicyConfig('usage', {
        ...valid,
        actions: { email: 'a@example.com' },
      })

      expect(result.actions.email).toBe('a@example.com')
    })

    it('accepts an email action as a recipient array', () => {
      const result = parsePolicyConfig('usage', {
        ...valid,
        actions: { email: ['a@example.com', 'b@example.com'] },
      })

      expect(result.actions.email).toEqual(['a@example.com', 'b@example.com'])
    })

    it('accepts an email action object with to as a single string', () => {
      const result = parsePolicyConfig('usage', {
        ...valid,
        actions: { email: { to: 'a@example.com' } },
      })

      expect(result.actions.email).toEqual({ to: 'a@example.com' })
    })

    it('rejects a config with no actions', () => {
      expect(() =>
        parsePolicyConfig('usage', { ...valid, actions: {} })
      ).toThrow(/at least one action/)
    })

    it('rejects an invalid metric', () => {
      expect(() =>
        parsePolicyConfig('usage', { ...valid, metric: 'bananas' })
      ).toThrow()
    })

    it('rejects a non-positive threshold', () => {
      expect(() =>
        parsePolicyConfig('usage', { ...valid, threshold: 0 })
      ).toThrow()
    })

    it('rejects a retention-shaped config (selection is by row type)', () => {
      expect(() => parsePolicyConfig('usage', { expiresInDays: 30 })).toThrow()
    })
  })
})
