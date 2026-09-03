import limits from '@/config/limits'

import { revealUserPlan } from '@/lib/user.plan'
import { getEffectivePartner } from '@/lib/user.type'
import { canDisablePoweredBy, getPoweredByDetails } from './widget'

jest.mock('@/config/limits', () => ({
  __esModule: true,
  default: {
    free: {
      widgetIntegration: {
        canDisablePoweredBy: false,
      },
    },
    pro: {
      widgetIntegration: {
        canDisablePoweredBy: true,
      },
    },
  },
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/user.type', () => ({
  getEffectivePartner: jest.fn(),
}))

describe('widget utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('canDisablePoweredBy', () => {
    it('should return true when the plan grants the entitlement', async () => {
      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      const user = { id: 'user-1', email: 'user1@example.com' }
      const result = await canDisablePoweredBy(user)

      expect(result).toBe(true)
      expect(revealUserPlan).toHaveBeenCalledWith(user)
    })

    it('should return false when the plan does not grant the entitlement', async () => {
      revealUserPlan.mockResolvedValue({ plan: 'free' })

      const user = { id: 'free-user', email: 'free@example.com' }
      const result = await canDisablePoweredBy(user)

      expect(result).toBe(false)
    })

    it('should return false when the plan is missing from the catalogue', async () => {
      revealUserPlan.mockResolvedValue({ plan: 'unknown' })

      const user = { id: 'user-2', email: 'user2@example.com' }
      const result = await canDisablePoweredBy(user)

      expect(result).toBe(false)
    })

    it('should return false when the plan lacks the widget entitlement key', async () => {
      limits.basic = {}
      revealUserPlan.mockResolvedValue({ plan: 'basic' })

      const user = { id: 'user-3', email: 'user3@example.com' }
      const result = await canDisablePoweredBy(user)

      expect(result).toBe(false)
    })
  })

  describe('getPoweredByDetails', () => {
    it('should return the partner brand for a whitelabel partner-managed account', async () => {
      getEffectivePartner.mockResolvedValue({
        id: 'partner-id',
        name: 'AgenticOS',
        logo: 'https://example.com/logo.svg',
        domain: 'backend.example.ai',
        whitelabel: true,
      })

      const user = { id: 'sub.partner-id', email: 'user@example.com' }
      const result = await getPoweredByDetails(user)

      expect(result).toEqual({
        caption: 'AgenticOS',
        url: 'https://backend.example.ai',
        logo: 'https://example.com/logo.svg',
      })
      expect(getEffectivePartner).toHaveBeenCalledWith(user)
    })

    it('should fall back to the site url when the partner has no domain', async () => {
      getEffectivePartner.mockResolvedValue({
        id: 'partner-id',
        name: 'Faro',
        whitelabel: true,
      })

      const user = { id: 'sub.partner-id', email: 'user@example.com' }
      const result = await getPoweredByDetails(user)

      expect(result).toEqual({
        caption: 'Faro',
        url: process.env.SITE_URL,
        logo: undefined,
      })
    })

    it('should return the platform brand for a non-whitelabel partner-managed account', async () => {
      getEffectivePartner.mockResolvedValue({
        id: 'partner-id',
        name: 'Aperture Laboratories',
      })

      const user = { id: 'sub.partner-id', email: 'user@example.com' }
      const result = await getPoweredByDetails(user)

      expect(result).toEqual({
        caption: 'ChatBotKit',
        url: process.env.SITE_URL,
      })
    })

    it('should return the platform brand when the user has no partner', async () => {
      getEffectivePartner.mockResolvedValue(null)

      const user = { id: 'user-1', email: 'user1@example.com' }
      const result = await getPoweredByDetails(user)

      expect(result).toEqual({
        caption: 'ChatBotKit',
        url: process.env.SITE_URL,
      })
    })
  })
})
