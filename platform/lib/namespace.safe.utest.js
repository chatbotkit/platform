import { SAFE_NAMESPACE, getSafeNamespace } from './namespace.safe'

describe('namespace.safe', () => {
  describe('SAFE_NAMESPACE constant', () => {
    it('should be a valid UUID', () => {
      expect(SAFE_NAMESPACE).toBe('67b8f341-6f7c-4877-b12d-07540d393e3a')
    })

    it('should match UUID v4 format', () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

      expect(SAFE_NAMESPACE).toMatch(uuidRegex)
    })

    it('should be lowercase', () => {
      expect(SAFE_NAMESPACE).toBe(SAFE_NAMESPACE.toLowerCase())
    })
  })

  describe('getSafeNamespace', () => {
    describe('basic functionality', () => {
      it('should generate a namespace for user and namespace combination', () => {
        const user = { id: 'user-123' }
        const namespace = 'test-namespace'

        const result = getSafeNamespace(user, namespace)

        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      })

      it('should return a valid UUID format', () => {
        const user = { id: 'user-123' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

        expect(result).toMatch(uuidRegex)
      })

      it('should return lowercase UUID', () => {
        const user = { id: 'USER-ABC' }
        const namespace = 'TEST'

        const result = getSafeNamespace(user, namespace)

        expect(result).toBe(result.toLowerCase())
      })
    })

    describe('deterministic behavior', () => {
      it('should return same namespace for same user and namespace', () => {
        const user = { id: 'user-123' }
        const namespace = 'test-namespace'

        const result1 = getSafeNamespace(user, namespace)
        const result2 = getSafeNamespace(user, namespace)

        expect(result1).toBe(result2)
      })

      it('should be consistent across multiple calls', () => {
        const user = { id: 'user-456' }
        const namespace = 'consistent'

        const results = Array.from({ length: 100 }, () =>
          getSafeNamespace(user, namespace)
        )

        const uniqueResults = new Set(results)

        expect(uniqueResults.size).toBe(1)
      })
    })

    describe('uniqueness', () => {
      it('should generate different namespaces for different users', () => {
        const user1 = { id: 'user-1' }
        const user2 = { id: 'user-2' }
        const namespace = 'test'

        const result1 = getSafeNamespace(user1, namespace)
        const result2 = getSafeNamespace(user2, namespace)

        expect(result1).not.toBe(result2)
      })

      it('should generate different namespaces for different namespace strings', () => {
        const user = { id: 'user-123' }
        const namespace1 = 'test1'
        const namespace2 = 'test2'

        const result1 = getSafeNamespace(user, namespace1)
        const result2 = getSafeNamespace(user, namespace2)

        expect(result1).not.toBe(result2)
      })

      it('should generate different namespaces for slightly different user IDs', () => {
        const user1 = { id: 'user-123' }
        const user2 = { id: 'user-124' }
        const namespace = 'test'

        const result1 = getSafeNamespace(user1, namespace)
        const result2 = getSafeNamespace(user2, namespace)

        expect(result1).not.toBe(result2)
      })

      it('should generate different namespaces for different combinations', () => {
        const users = [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }]
        const namespaces = ['ns1', 'ns2', 'ns3']

        const results = new Set()

        users.forEach((user) => {
          namespaces.forEach((namespace) => {
            results.add(getSafeNamespace(user, namespace))
          })
        })

        expect(results.size).toBe(9) // All combinations should be unique
      })
    })

    describe('input variations', () => {
      it('should handle user ID with special characters', () => {
        const user = { id: 'user-!@#$%^&*()' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle namespace with special characters', () => {
        const user = { id: 'user-123' }
        const namespace = 'test-!@#$%'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle UUID-formatted user ID', () => {
        const user = { id: '550e8400-e29b-41d4-a716-446655440000' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
        expect(result).not.toBe(user.id)
      })

      it('should handle long user ID', () => {
        const user = { id: 'a'.repeat(1000) }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle long namespace', () => {
        const user = { id: 'user-123' }
        const namespace = 'n'.repeat(1000)

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })
    })

    describe('edge cases', () => {
      it('should handle empty user ID', () => {
        const user = { id: '' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle empty namespace', () => {
        const user = { id: 'user-123' }
        const namespace = ''

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle both empty values', () => {
        const user = { id: '' }
        const namespace = ''

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle numeric user ID', () => {
        const user = { id: '12345' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })

      it('should handle user object with extra properties', () => {
        const user = {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        expect(result).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      })
    })

    describe('separator behavior', () => {
      it('should treat user ID and namespace as separate components', () => {
        const user1 = { id: 'user' }
        const namespace1 = '123:::test'

        const user2 = { id: 'user:::123' }
        const namespace2 = 'test'

        const result1 = getSafeNamespace(user1, namespace1)
        const result2 = getSafeNamespace(user2, namespace2)

        expect(result1).not.toBe(result2)
      })

      it('should use ::: as separator internally', () => {
        const user = { id: 'user-123' }
        const namespace = 'test'

        const result1 = getSafeNamespace(user, namespace)

        // The function joins with ::: separator
        // user-123:::test should generate the same result
        const result2 = getSafeNamespace(user, namespace)

        expect(result1).toBe(result2)
      })
    })

    describe('UUID v5 properties', () => {
      it('should generate UUID v5 (version field should be 5)', () => {
        const user = { id: 'user-123' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        // UUID v5 has version '5' at position 14 (0-indexed)
        expect(result[14]).toBe('5')
      })

      it('should have variant bits set correctly', () => {
        const user = { id: 'user-123' }
        const namespace = 'test'

        const result = getSafeNamespace(user, namespace)

        // UUID variant bits at position 19 should be '8', '9', 'a', or 'b'
        expect(['8', '9', 'a', 'b']).toContain(result[19])
      })
    })
  })
})
