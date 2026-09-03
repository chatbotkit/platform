import { canUseTask } from '@/lib/task.access'

describe('task.access', () => {
  describe('canUseTask', () => {
    it('should return true when userId matches task.userId', () => {
      const userId = 'user-123'
      const task = { userId: 'user-123' }

      expect(canUseTask(userId, task)).toBe(true)
    })

    it('should return false when userId does not match task.userId', () => {
      const userId = 'user-123'
      const task = { userId: 'user-456' }

      expect(canUseTask(userId, task)).toBe(false)
    })

    it('should return false when userId is null', () => {
      const task = { userId: 'user-123' }

      expect(canUseTask(null, task)).toBe(false)
    })

    it('should return false when userId is undefined', () => {
      const task = { userId: 'user-123' }

      expect(canUseTask(undefined, task)).toBe(false)
    })

    it('should return false when userId is empty string', () => {
      const task = { userId: 'user-123' }

      expect(canUseTask('', task)).toBe(false)
    })

    it('should handle task with empty userId', () => {
      const userId = 'user-123'
      const task = { userId: '' }

      expect(canUseTask(userId, task)).toBe(false)
    })

    it('should return true when both userId and task.userId are empty strings', () => {
      const task = { userId: '' }

      expect(canUseTask('', task)).toBe(true)
    })

    it('should handle special characters in userId', () => {
      const userId = 'user-with-special-chars-!@#$%'
      const task = { userId: 'user-with-special-chars-!@#$%' }

      expect(canUseTask(userId, task)).toBe(true)
    })

    it('should be case sensitive', () => {
      const userId = 'user-ABC'
      const task = { userId: 'user-abc' }

      expect(canUseTask(userId, task)).toBe(false)
    })

    it('should handle very long userId strings', () => {
      const longId = 'user-' + 'a'.repeat(1000)
      const task = { userId: longId }

      expect(canUseTask(longId, task)).toBe(true)
    })

    it('should handle task object with additional properties', () => {
      const userId = 'user-123'
      const task = {
        userId: 'user-123',
        name: 'Test Task',
        description: 'A test task',
        status: 'pending',
        extra: 'data',
      }

      expect(canUseTask(userId, task)).toBe(true)
    })

    it('should handle numeric userId strings', () => {
      const userId = '12345'
      const task = { userId: '12345' }

      expect(canUseTask(userId, task)).toBe(true)
    })

    it('should not match numeric userId with string representation', () => {
      const userId = '123'
      const task = { userId: '0123' }

      expect(canUseTask(userId, task)).toBe(false)
    })
  })
})
