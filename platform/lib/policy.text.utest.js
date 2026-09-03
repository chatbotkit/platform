import { PolicyType } from '@/prisma/types'

import { describePolicyConfig } from '@/lib/policy.text'

jest.mock('@/lib/blueprint.fields', () => ({
  isUnmanagedBlueprintField: jest.fn((key) => {
    // Mock: treat fields ending with 'token' or 'secret' as unmanaged
    return key.includes('token') || key.includes('secret')
  }),
}))

// Mock the Prisma types first before importing policy.text
jest.mock('@/prisma/types', () => ({
  PolicyType: {
    retention: 'RETENTION',
    usage: 'USAGE',
  },
}))

jest.mock('@/prisma/zod', () => ({
  RetentionPolicyConfigType: {},
  UsagePolicyConfigType: {},
}))

describe('policy.text', () => {
  describe('describePolicyConfig', () => {
    describe('invalid input handling', () => {
      it('should return empty string for null config', () => {
        expect(describePolicyConfig(PolicyType.retention, null)).toBe('')
      })

      it('should return empty string for undefined config', () => {
        expect(describePolicyConfig(PolicyType.retention, undefined)).toBe('')
      })

      it('should return empty string for unknown policy type', () => {
        const result = describePolicyConfig('unknown-type', { some: 'config' })

        expect(result).toBe('')
      })

      it('should be lenient with invalid config shapes', () => {
        // The function is lenient - it doesn't validate config type strictly
        // It just tries to describe what it can
        const result = describePolicyConfig(PolicyType.retention, {
          invalidField: 'value',
        })

        // Without expiresInDays, it defaults to indefinite
        expect(typeof result).toBe('string')
      })
    })

    describe('retention policy descriptions', () => {
      it('should describe indefinite retention when expiresInDays is absent', () => {
        const result = describePolicyConfig(PolicyType.retention, {
          expiresInDays: null,
        })

        expect(result).toBe('Conversations are kept indefinitely.')
      })

      it('should describe indefinite retention when expiresInDays is 0', () => {
        const result = describePolicyConfig(PolicyType.retention, {
          expiresInDays: 0,
        })

        expect(result).toBe('Conversations are kept indefinitely.')
      })

      it('should describe single day retention correctly', () => {
        const result = describePolicyConfig(PolicyType.retention, {
          expiresInDays: 1,
        })

        expect(result).toContain('1 day')
        expect(result).toContain('expire')
      })

      it('should describe multiple day retention with pluralization', () => {
        const result = describePolicyConfig(PolicyType.retention, {
          expiresInDays: 30,
        })

        expect(result).toContain('30 days')
        expect(result).toContain('expire')
      })

      it('should describe large day values correctly', () => {
        const result = describePolicyConfig(PolicyType.retention, {
          expiresInDays: 365,
        })

        expect(result).toContain('365 days')
      })
    })

    describe('usage policy descriptions', () => {
      it('should describe basic usage policy with token limit', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 3600,
          actions: {},
        })

        expect(result).toContain('1,000,000 tokens')
        expect(result).toContain('1 hour')
        expect(result).toContain('take no action')
      })

      it('should describe usage policy with block action', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 5000000,
          windowInSeconds: 86400,
          actions: {
            block: {
              durationInSeconds: 3600,
            },
          },
        })

        expect(result).toContain('5,000,000 tokens')
        expect(result).toContain('block the bot')
        expect(result).toContain('1 hour')
      })

      it('should describe usage policy with email notification (single address)', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 86400,
          actions: {
            email: 'admin@example.com',
          },
        })

        expect(result).toContain('email admin@example.com')
      })

      it('should describe usage policy with email notification (array of addresses)', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 86400,
          actions: {
            email: ['admin@example.com', 'owner@example.com'],
          },
        })

        expect(result).toContain('admin@example.com')
        expect(result).toContain('owner@example.com')
        expect(result).toContain('and')
      })

      it('should describe usage policy with email object (explicit to)', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 86400,
          actions: {
            email: {
              to: 'billing@example.com',
            },
          },
        })

        expect(result).toContain('billing@example.com')
      })

      it('should describe usage policy with email object (undefined to, defaults to owner)', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 86400,
          actions: {
            email: {
              to: undefined,
            },
          },
        })

        expect(result).toContain('policy owner')
      })

      it('should describe usage policy with multiple actions', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 2000000,
          windowInSeconds: 86400,
          actions: {
            block: {
              durationInSeconds: 7200,
            },
            email: ['alert@example.com'],
          },
        })

        expect(result).toContain('block the bot')
        expect(result).toContain('email alert@example.com')
        expect(result).toContain('and')
      })

      it('should format large thresholds with localization', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'conversations',
          threshold: 10000000,
          windowInSeconds: 2592000,
          actions: {},
        })

        expect(result).toContain('10,000,000')
      })

      it('should handle various time windows correctly', () => {
        const configs = [
          { windowInSeconds: 60, expectedText: '1 minute' },
          { windowInSeconds: 3600, expectedText: '1 hour' },
          { windowInSeconds: 86400, expectedText: '1 day' },
          { windowInSeconds: 604800, expectedText: '7 days' }, // 1 week = 7 days
          { windowInSeconds: 2592000, expectedText: '30 days' },
        ]

        for (const { windowInSeconds, expectedText } of configs) {
          const result = describePolicyConfig(PolicyType.usage, {
            metric: 'tokens',
            threshold: 1000000,
            windowInSeconds,
            actions: {},
          })

          expect(result).toContain(expectedText)
        }
      })

      it('should handle email with array containing single item', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 86400,
          actions: {
            email: ['single@example.com'],
          },
        })

        expect(result).toContain('single@example.com')
        // Should not have ", and" for single item
        expect(result).not.toMatch(/,\s*and/)
      })

      it('should handle email with array of three items', () => {
        const result = describePolicyConfig(PolicyType.usage, {
          metric: 'tokens',
          threshold: 1000000,
          windowInSeconds: 86400,
          actions: {
            email: [
              'first@example.com',
              'second@example.com',
              'third@example.com',
            ],
          },
        })

        expect(result).toContain(
          'first@example.com, second@example.com and third@example.com'
        )
      })
    })
  })
})
