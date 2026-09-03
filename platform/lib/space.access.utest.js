import { canUseSpace } from '@/lib/space.access'

describe('space.access', () => {
  describe('canUseSpace', () => {
    it('should return true when userId matches space.userId', () => {
      const userId = 'user-123'
      const space = { userId: 'user-123' }

      expect(canUseSpace(userId, space)).toBe(true)
    })

    it('should return false when userId does not match space.userId', () => {
      const userId = 'user-123'
      const space = { userId: 'user-456' }

      expect(canUseSpace(userId, space)).toBe(false)
    })

    it('should return false when userId is null', () => {
      const space = { userId: 'user-123' }

      expect(canUseSpace(null, space)).toBe(false)
    })

    it('should return false when userId is undefined', () => {
      const space = { userId: 'user-123' }

      expect(canUseSpace(undefined, space)).toBe(false)
    })

    it('should return false when userId is empty string', () => {
      const space = { userId: 'user-123' }

      expect(canUseSpace('', space)).toBe(false)
    })

    it('should handle space with empty userId', () => {
      const userId = 'user-123'
      const space = { userId: '' }

      expect(canUseSpace(userId, space)).toBe(false)
    })

    it('should return true when both userId and space.userId are empty strings', () => {
      const space = { userId: '' }

      expect(canUseSpace('', space)).toBe(true)
    })

    it('should handle special characters in userId', () => {
      const userId = 'user-with-special-chars-!@#$%'
      const space = { userId: 'user-with-special-chars-!@#$%' }

      expect(canUseSpace(userId, space)).toBe(true)
    })

    it('should be case sensitive', () => {
      const userId = 'user-ABC'
      const space = { userId: 'user-abc' }

      expect(canUseSpace(userId, space)).toBe(false)
    })

    it('should handle very long userId strings', () => {
      const longId = 'user-' + 'a'.repeat(1000)
      const space = { userId: longId }

      expect(canUseSpace(longId, space)).toBe(true)
    })

    it('should handle space object with additional properties', () => {
      const userId = 'user-123'
      const space = {
        userId: 'user-123',
        name: 'Test Space',
        description: 'A test space',
        extra: 'data',
      }

      expect(canUseSpace(userId, space)).toBe(true)
    })

    it('should handle numeric userId strings', () => {
      const userId = '12345'
      const space = { userId: '12345' }

      expect(canUseSpace(userId, space)).toBe(true)
    })

    it('should not match numeric userId with string representation', () => {
      const userId = '123'
      const space = { userId: '0123' }

      expect(canUseSpace(userId, space)).toBe(false)
    })
  })
})
