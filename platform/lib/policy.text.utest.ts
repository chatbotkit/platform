import { describePolicyConfig } from './policy.text'

describe('describePolicyConfig', () => {
  it('returns an empty string for nullish config', () => {
    expect(describePolicyConfig('retention', null)).toBe('')
    expect(describePolicyConfig('retention', undefined)).toBe('')
  })

  it('returns an empty string for an unknown type', () => {
    expect(describePolicyConfig('mystery', { expiresInDays: 30 })).toBe('')
  })

  describe('retention', () => {
    it('describes a day-based expiry', () => {
      expect(describePolicyConfig('retention', { expiresInDays: 30 })).toBe(
        'Conversations expire 30 days after they are created.'
      )
    })

    it('singularizes a one-day expiry', () => {
      expect(describePolicyConfig('retention', { expiresInDays: 1 })).toBe(
        'Conversations expire 1 day after they are created.'
      )
    })

    it('describes an indefinite retention when no expiry is set', () => {
      expect(describePolicyConfig('retention', {})).toBe(
        'Conversations are kept indefinitely.'
      )
    })
  })

  describe('usage', () => {
    it('describes a block action with a friendly window and duration', () => {
      expect(
        describePolicyConfig('usage', {
          metric: 'tokens',
          threshold: 100000,
          windowInSeconds: 86400,
          actions: { block: { durationInSeconds: 3600 } },
        })
      ).toBe(
        'When a bot uses more than 100,000 tokens within 1 day, block the bot for 1 hour.'
      )
    })

    it('notifies the policy owner for an email action without recipients', () => {
      expect(
        describePolicyConfig('usage', {
          metric: 'messages',
          threshold: 500,
          windowInSeconds: 86400,
          actions: { email: {} },
        })
      ).toBe(
        'When a bot uses more than 500 messages within 1 day, email the policy owner.'
      )
    })

    it('combines block and email actions and lists explicit recipients', () => {
      expect(
        describePolicyConfig('usage', {
          metric: 'conversations',
          threshold: 100,
          windowInSeconds: 3600,
          actions: {
            block: { durationInSeconds: 1800 },
            email: { to: ['a@example.com', 'b@example.com'] },
          },
        })
      ).toBe(
        'When a bot uses more than 100 conversations within 1 hour, block the bot for 30 minutes and email a@example.com and b@example.com.'
      )
    })

    it('redirects to a specific recipient via the object `to` form', () => {
      expect(
        describePolicyConfig('usage', {
          metric: 'messages',
          threshold: 500,
          windowInSeconds: 86400,
          actions: { email: { to: 'alerts@example.com' } },
        })
      ).toBe(
        'When a bot uses more than 500 messages within 1 day, email alerts@example.com.'
      )
    })

    it('accepts a bare email-address string action', () => {
      expect(
        describePolicyConfig('usage', {
          metric: 'tokens',
          threshold: 10,
          windowInSeconds: 60,
          actions: { email: 'ops@example.com' },
        })
      ).toBe(
        'When a bot uses more than 10 tokens within 1 minute, email ops@example.com.'
      )
    })
  })
})
