/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import platform from '@/config/platform'

import {
  getPlatformTokenUsageKey,
  platformBudgetOk,
} from '@/lib/limit.platform'
import memcache from '@/lib/memcache'

jest.mock('@/config/platform', () => ({
  __esModule: true,

  default: { maxTokensPerMonth: Infinity },
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,

  default: mockDeep(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,

  ...jest.requireActual('@/lib/debug'),

  default: jest.fn(() => {
    const debugObj = { log: jest.fn(() => debugObj) }

    return debugObj
  }),
}))

describe('limit.platform', () => {
  afterEach(() => {
    jest.clearAllMocks()

    delete process.env.SKIP_LIMITS_CHECK

    platform.maxTokensPerMonth = Infinity
  })

  describe('getPlatformTokenUsageKey', () => {
    it('should match the per-user usage key format', () => {
      expect(getPlatformTokenUsageKey()).toBe('usage-platform-token')
    })
  })

  describe('platformBudgetOk', () => {
    it('should return true when limits check is skipped', async () => {
      process.env.SKIP_LIMITS_CHECK = 'true'

      platform.maxTokensPerMonth = 100

      memcache.get.mockResolvedValue(999)

      expect(await platformBudgetOk({ id: 'user123' })).toBe(true)

      expect(memcache.get).not.toHaveBeenCalled()
    })

    it('should return true when the cap is disabled (Infinity)', async () => {
      platform.maxTokensPerMonth = Infinity

      expect(await platformBudgetOk({ id: 'user123' })).toBe(true)

      expect(memcache.get).not.toHaveBeenCalled()
    })

    it('should return true when usage is below the cap', async () => {
      platform.maxTokensPerMonth = 1000

      memcache.get.mockResolvedValue(999)

      expect(await platformBudgetOk({ id: 'user123' })).toBe(true)

      expect(memcache.get).toHaveBeenCalledWith('usage-platform-token')
    })

    it('should return true when usage counter is unset (null)', async () => {
      platform.maxTokensPerMonth = 1000

      memcache.get.mockResolvedValue(null)

      expect(await platformBudgetOk({ id: 'user123' })).toBe(true)
    })

    it('should return false when usage reaches the cap', async () => {
      platform.maxTokensPerMonth = 1000

      memcache.get.mockResolvedValue(1000)

      expect(await platformBudgetOk({ id: 'user123' })).toBe(false)
    })

    it('should return false when usage exceeds the cap', async () => {
      platform.maxTokensPerMonth = 1000

      memcache.get.mockResolvedValue(5000)

      expect(await platformBudgetOk({ id: 'user123' })).toBe(false)
    })

    it('should fail open when the redis read throws', async () => {
      platform.maxTokensPerMonth = 1000

      memcache.get.mockRejectedValue(new Error('redis down'))

      expect(await platformBudgetOk({ id: 'user123' })).toBe(true)
    })
  })
})
