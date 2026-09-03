import {
  getMaxFileSize,
  isLiveEventStreamingEnabled,
  isScheduledIntegrationEnabled,
  isScheduledTaskEnabled,
} from './user.limits'
import { revealUserPlan } from './user.plan'

jest.mock('./user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

// @note the catalogue is read from LIMITS_CONFIG, which the test environment
// does not carry, so the suite brings its own tables for the values it reads
jest.mock('@/config/limits', () => {
  const table = (maxFileSize, liveStreaming, scheduling) => ({
    attachment: { maxFileSize },
    eventLogs: { liveStreaming },
    scheduling: { integrations: scheduling, tasks: scheduling },
  })

  return {
    __esModule: true,

    hasPlans: true,

    default: {
      free: table(4_500_000, false, false),
      basic: table(4_500_000, false, false),
      pro: table(50_000_000, false, true),
      ultimate: table(50_000_000, false, true),
    },
  }
})

describe('user.limits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getMaxFileSize', () => {
    it('should return max file size for free plan user', async () => {
      const user = { id: 'user-1', plan: 'free' }

      revealUserPlan.mockResolvedValue({ plan: 'free' })

      const maxFileSize = await getMaxFileSize(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(maxFileSize).toBe(4500000) // 4.5MB
    })

    it('should return max file size for basic plan user', async () => {
      const user = { id: 'user-2', plan: 'basic' }

      revealUserPlan.mockResolvedValue({ plan: 'basic' })

      const maxFileSize = await getMaxFileSize(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(maxFileSize).toBe(4500000) // 4.5MB
    })

    it('should return max file size for pro plan user', async () => {
      const user = { id: 'user-3', plan: 'pro' }

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      const maxFileSize = await getMaxFileSize(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(maxFileSize).toBe(50000000) // 50MB
    })

    it('should return max file size for ultimate plan user', async () => {
      const user = { id: 'user-4', plan: 'ultimate' }

      revealUserPlan.mockResolvedValue({ plan: 'ultimate' })

      const maxFileSize = await getMaxFileSize(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(maxFileSize).toBe(50000000) // 50MB
    })
  })

  describe('isLiveEventStreamingEnabled', () => {
    it('should return false for free plan user', async () => {
      const user = { id: 'user-1' }

      revealUserPlan.mockResolvedValue({ plan: 'free' })

      const enabled = await isLiveEventStreamingEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(false)
    })

    it('should return false for basic plan user', async () => {
      const user = { id: 'user-2' }

      revealUserPlan.mockResolvedValue({ plan: 'basic' })

      const enabled = await isLiveEventStreamingEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(false)
    })

    it('should return false for pro plan user', async () => {
      const user = { id: 'user-3' }

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      const enabled = await isLiveEventStreamingEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(false)
    })

    it('should return false for ultimate plan user', async () => {
      const user = { id: 'user-4' }

      revealUserPlan.mockResolvedValue({ plan: 'ultimate' })

      const enabled = await isLiveEventStreamingEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(false)
    })
  })

  describe('isScheduledIntegrationEnabled', () => {
    it('should return false for a plan that does not grant scheduling', async () => {
      const user = { id: 'user-1' }

      revealUserPlan.mockResolvedValue({ plan: 'free' })

      const enabled = await isScheduledIntegrationEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(false)
    })

    it('should return true for a plan that grants scheduling', async () => {
      const user = { id: 'user-3' }

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      const enabled = await isScheduledIntegrationEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(true)
    })

    it('should return false for a plan the catalogue does not carry', async () => {
      const user = { id: 'user-5' }

      revealUserPlan.mockResolvedValue({ plan: 'nosuchplan' })

      const enabled = await isScheduledIntegrationEnabled(user)

      expect(enabled).toBe(false)
    })
  })

  describe('isScheduledTaskEnabled', () => {
    it('should return false for a plan that does not grant scheduling', async () => {
      const user = { id: 'user-2' }

      revealUserPlan.mockResolvedValue({ plan: 'basic' })

      const enabled = await isScheduledTaskEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(false)
    })

    it('should return true for a plan that grants scheduling', async () => {
      const user = { id: 'user-4' }

      revealUserPlan.mockResolvedValue({ plan: 'ultimate' })

      const enabled = await isScheduledTaskEnabled(user)

      expect(revealUserPlan).toHaveBeenCalledWith(user)
      expect(enabled).toBe(true)
    })
  })
})
