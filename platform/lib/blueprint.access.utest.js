import { canManipulateBlueprint, canUseBlueprint } from '@/lib/blueprint.access'

describe('blueprint.access', () => {
  describe('canUseBlueprint', () => {
    describe('owner access', () => {
      it('should allow user to use their own blueprint', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should allow user with matching id', () => {
        const user = { id: 'owner-id', email: 'owner@example.com' }
        const blueprint = { userId: 'owner-id' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with numeric-like string ids', () => {
        const user = { id: '12345', email: 'user@example.com' }
        const blueprint = { userId: '12345' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with uuid-style ids', () => {
        const user = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
        }
        const blueprint = { userId: '550e8400-e29b-41d4-a716-446655440000' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with cuid-style ids', () => {
        const user = { id: 'ckl123abc456def789', email: 'user@example.com' }
        const blueprint = { userId: 'ckl123abc456def789' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })
    })

    describe('non-owner access', () => {
      it('should deny access to blueprints owned by other users', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-456' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should deny access when user id does not match blueprint owner', () => {
        const user = { id: 'alice', email: 'alice@example.com' }
        const blueprint = { userId: 'bob' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should be case-sensitive for user ids', () => {
        const user = { id: 'User-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should not allow access with similar but different ids', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-1234' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should not allow access with substring ids', () => {
        const user = { id: 'user', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle empty string user id', () => {
        const user = { id: '', email: 'test@example.com' }
        const blueprint = { userId: '' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should handle empty string mismatch', () => {
        const user = { id: '', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should work with special characters in ids', () => {
        const user = { id: 'user-123@test', email: 'test@example.com' }
        const blueprint = { userId: 'user-123@test' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with underscores in ids', () => {
        const user = { id: 'user_123_test', email: 'test@example.com' }
        const blueprint = { userId: 'user_123_test' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with dots in ids', () => {
        const user = { id: 'user.123.test', email: 'test@example.com' }
        const blueprint = { userId: 'user.123.test' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should only check userId property', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = {
          userId: 'user-123',
          id: 'blueprint-456',
          name: 'Test Blueprint',
        }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should not be affected by user email', () => {
        const user = { id: 'user-123', email: 'different@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work when user has additional properties', () => {
        const user = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
        }
        const blueprint = { userId: 'user-123' }

        const result = canUseBlueprint(user, blueprint)

        expect(result).toBe(true)
      })
    })

    describe('consistency and determinism', () => {
      it('should return same result for same inputs', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result1 = canUseBlueprint(user, blueprint)
        const result2 = canUseBlueprint(user, blueprint)

        expect(result1).toBe(result2)
      })

      it('should return same result for different user objects with same id', () => {
        const user1 = { id: 'user-123', email: 'test1@example.com' }
        const user2 = { id: 'user-123', email: 'test2@example.com' }
        const blueprint = { userId: 'user-123' }

        const result1 = canUseBlueprint(user1, blueprint)
        const result2 = canUseBlueprint(user2, blueprint)

        expect(result1).toBe(result2)
        expect(result1).toBe(true)
      })
    })
  })

  describe('canManipulateBlueprint', () => {
    describe('owner manipulation', () => {
      it('should allow user to manipulate their own blueprint', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should allow manipulation with matching id', () => {
        const user = { id: 'owner-id', email: 'owner@example.com' }
        const blueprint = { userId: 'owner-id' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with uuid-style ids', () => {
        const user = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
        }
        const blueprint = { userId: '550e8400-e29b-41d4-a716-446655440000' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should work with cuid-style ids', () => {
        const user = { id: 'ckl123abc456def789', email: 'user@example.com' }
        const blueprint = { userId: 'ckl123abc456def789' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })
    })

    describe('non-owner manipulation', () => {
      it('should deny manipulation to blueprints owned by other users', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-456' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should deny manipulation when user id does not match', () => {
        const user = { id: 'alice', email: 'alice@example.com' }
        const blueprint = { userId: 'bob' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should be case-sensitive for user ids', () => {
        const user = { id: 'User-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should not allow manipulation with substring ids', () => {
        const user = { id: 'user', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle empty string user id', () => {
        const user = { id: '', email: 'test@example.com' }
        const blueprint = { userId: '' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should handle empty string mismatch', () => {
        const user = { id: '', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(false)
      })

      it('should work with special characters in ids', () => {
        const user = { id: 'user-123@test', email: 'test@example.com' }
        const blueprint = { userId: 'user-123@test' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should only check userId property', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = {
          userId: 'user-123',
          id: 'blueprint-456',
          name: 'Test Blueprint',
        }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })

      it('should not be affected by user email', () => {
        const user = { id: 'user-123', email: 'different@example.com' }
        const blueprint = { userId: 'user-123' }

        const result = canManipulateBlueprint(user, blueprint)

        expect(result).toBe(true)
      })
    })

    describe('consistency and determinism', () => {
      it('should return same result for same inputs', () => {
        const user = { id: 'user-123', email: 'test@example.com' }
        const blueprint = { userId: 'user-123' }

        const result1 = canManipulateBlueprint(user, blueprint)
        const result2 = canManipulateBlueprint(user, blueprint)

        expect(result1).toBe(result2)
      })

      it('should return same result for different user objects with same id', () => {
        const user1 = { id: 'user-123', email: 'test1@example.com' }
        const user2 = { id: 'user-123', email: 'test2@example.com' }
        const blueprint = { userId: 'user-123' }

        const result1 = canManipulateBlueprint(user1, blueprint)
        const result2 = canManipulateBlueprint(user2, blueprint)

        expect(result1).toBe(result2)
        expect(result1).toBe(true)
      })
    })
  })

  describe('function equivalence', () => {
    it('should return same results for both functions with same inputs', () => {
      const user = { id: 'user-123', email: 'test@example.com' }
      const blueprint = { userId: 'user-123' }

      const useResult = canUseBlueprint(user, blueprint)
      const manipulateResult = canManipulateBlueprint(user, blueprint)

      expect(useResult).toBe(manipulateResult)
    })

    it('should return same results for non-owner access', () => {
      const user = { id: 'user-123', email: 'test@example.com' }
      const blueprint = { userId: 'user-456' }

      const useResult = canUseBlueprint(user, blueprint)
      const manipulateResult = canManipulateBlueprint(user, blueprint)

      expect(useResult).toBe(manipulateResult)
      expect(useResult).toBe(false)
    })
  })
})
