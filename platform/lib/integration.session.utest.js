import { captureUnexpectedState } from '@/lib/error'
import memcache from '@/lib/memcache'

import {
  deleteSessionKeys,
  resolveSession,
  setSessionKeys,
} from './integration.session'

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureUnexpectedState: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}))

describe('integration.session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('resolveSession', () => {
    it('returns null and captures state for empty keys', async () => {
      await expect(resolveSession([])).resolves.toBeNull()
      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'resolveSession called with empty keys array',
        { keys: [] }
      )
      expect(memcache.get).not.toHaveBeenCalled()
    })

    it('returns first resolved key and value', async () => {
      memcache.get.mockResolvedValueOnce(null).mockResolvedValueOnce('conv-123')

      await expect(resolveSession(['a', 'b', 'c'])).resolves.toEqual({
        key: 'b',
        value: 'conv-123',
      })
      expect(memcache.get).toHaveBeenCalledTimes(2)
      expect(memcache.get).toHaveBeenNthCalledWith(1, 'a')
      expect(memcache.get).toHaveBeenNthCalledWith(2, 'b')
    })

    it('stops at the first key when it resolves immediately', async () => {
      memcache.get.mockResolvedValueOnce('conv-456')

      await expect(
        resolveSession(['key-primary', 'key-fallback'])
      ).resolves.toEqual({ key: 'key-primary', value: 'conv-456' })
      expect(memcache.get).toHaveBeenCalledTimes(1)
    })

    it('returns null when no session value is found', async () => {
      memcache.get.mockResolvedValue(null)

      await expect(resolveSession(['a', 'b'])).resolves.toBeNull()
      expect(memcache.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('setSessionKeys', () => {
    it('captures state for empty keys and does not write', async () => {
      await setSessionKeys([], 'conv-1', { ex: 60 })

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'setSessionKeys called with empty keys array',
        { keys: [], value: 'conv-1' }
      )
      expect(memcache.set).not.toHaveBeenCalled()
    })

    it('stores value under all keys', async () => {
      memcache.set.mockResolvedValue('OK')

      await setSessionKeys(['a', 'b'], 'conv-1', { ex: 120 })

      expect(memcache.set).toHaveBeenCalledTimes(2)
      expect(memcache.set).toHaveBeenNthCalledWith(1, 'a', 'conv-1', { ex: 120 })
      expect(memcache.set).toHaveBeenNthCalledWith(2, 'b', 'conv-1', { ex: 120 })
    })

    it('stores value under a single key', async () => {
      memcache.set.mockResolvedValue('OK')

      await setSessionKeys(['key-only'], 'conv-789', { ex: 86400 })

      expect(memcache.set).toHaveBeenCalledTimes(1)
      expect(memcache.set).toHaveBeenCalledWith('key-only', 'conv-789', {
        ex: 86400,
      })
    })
  })

  describe('deleteSessionKeys', () => {
    it('captures state for empty keys and does not delete', async () => {
      await deleteSessionKeys([])

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'deleteSessionKeys called with empty keys array',
        { keys: [] }
      )
      expect(memcache.del).not.toHaveBeenCalled()
    })

    it('deletes all provided keys', async () => {
      memcache.del.mockResolvedValue(1)

      await deleteSessionKeys(['a', 'b', 'c'])

      expect(memcache.del).toHaveBeenCalledTimes(3)
      expect(memcache.del).toHaveBeenNthCalledWith(1, 'a')
      expect(memcache.del).toHaveBeenNthCalledWith(2, 'b')
      expect(memcache.del).toHaveBeenNthCalledWith(3, 'c')
    })

    it('deletes a single key', async () => {
      memcache.del.mockResolvedValue(1)

      await deleteSessionKeys(['key-only'])

      expect(memcache.del).toHaveBeenCalledTimes(1)
      expect(memcache.del).toHaveBeenCalledWith('key-only')
    })
  })
})
