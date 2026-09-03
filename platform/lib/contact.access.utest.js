import { canUseContact } from '@/lib/contact.access'

describe('contact.access', () => {
  describe('canUseContact', () => {
    it('should return true when userId matches contact.userId', () => {
      const userId = 'user-123'
      const contact = { userId: 'user-123' }

      expect(canUseContact(userId, contact)).toBe(true)
    })

    it('should return false when userId does not match contact.userId', () => {
      const userId = 'user-123'
      const contact = { userId: 'user-456' }

      expect(canUseContact(userId, contact)).toBe(false)
    })

    it('should return false when userId is null', () => {
      const contact = { userId: 'user-123' }

      expect(canUseContact(null, contact)).toBe(false)
    })

    it('should return false when userId is undefined', () => {
      const contact = { userId: 'user-123' }

      expect(canUseContact(undefined, contact)).toBe(false)
    })

    it('should return false when userId is empty string', () => {
      const contact = { userId: 'user-123' }

      expect(canUseContact('', contact)).toBe(false)
    })

    it('should handle contact with empty userId', () => {
      const userId = 'user-123'
      const contact = { userId: '' }

      expect(canUseContact(userId, contact)).toBe(false)
    })

    it('should return true when both userId and contact.userId are empty strings', () => {
      const contact = { userId: '' }

      expect(canUseContact('', contact)).toBe(true)
    })

    it('should handle special characters in userId', () => {
      const userId = 'user-with-special-chars-!@#$%'
      const contact = { userId: 'user-with-special-chars-!@#$%' }

      expect(canUseContact(userId, contact)).toBe(true)
    })

    it('should be case sensitive', () => {
      const userId = 'user-ABC'
      const contact = { userId: 'user-abc' }

      expect(canUseContact(userId, contact)).toBe(false)
    })

    it('should handle very long userId strings', () => {
      const longId = 'user-' + 'a'.repeat(1000)
      const contact = { userId: longId }

      expect(canUseContact(longId, contact)).toBe(true)
    })

    it('should handle contact object with additional properties', () => {
      const userId = 'user-123'
      const contact = {
        userId: 'user-123',
        name: 'Test Contact',
        email: 'test@example.com',
        extra: 'data',
      }

      expect(canUseContact(userId, contact)).toBe(true)
    })

    it('should handle numeric userId strings', () => {
      const userId = '12345'
      const contact = { userId: '12345' }

      expect(canUseContact(userId, contact)).toBe(true)
    })

    it('should not match numeric userId with string representation', () => {
      const userId = '123'
      const contact = { userId: '0123' }

      expect(canUseContact(userId, contact)).toBe(false)
    })
  })
})
