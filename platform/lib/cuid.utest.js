import { cuid, generate, isCuid } from '@/lib/cuid'

describe('cuid', () => {
  describe('isCuid()', () => {
    it('should return true for default cuid2 ids', () => {
      expect(isCuid('abcdefghijklmnopqrstuvwx')).toBe(true)
    })

    it('should return true for legacy 25 character cuids', () => {
      expect(isCuid('cmoli2n6t000tcafbys9xzw83')).toBe(true)
    })

    it('should return false for malformed ids', () => {
      expect(isCuid(null)).toBe(false)
      expect(isCuid(undefined)).toBe(false)
      expect(isCuid('')).toBe(false)
      expect(isCuid('123456789012345678901234')).toBe(false)
      expect(isCuid('abcdefghijklmnopqrstuvw')).toBe(false)
      expect(isCuid('abcdefghijklmnopqrstuvwx1')).toBe(false)
      expect(isCuid('abcdefghijklmnopqrstuvw-')).toBe(false)
    })
  })

  describe('cuid()', () => {
    it('should generate a valid CUID', () => {
      const id = cuid()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(isCuid(id)).toBe(true)
    })

    it('should generate unique CUIDs', () => {
      const id1 = cuid()
      const id2 = cuid()
      const id3 = cuid()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it('should generate multiple unique CUIDs in sequence', () => {
      const ids = new Set()
      const count = 100

      for (let i = 0; i < count; i++) {
        ids.add(cuid())
      }

      expect(ids.size).toBe(count)
    })
  })

  describe('generate()', () => {
    it('should return a generator function', () => {
      const generator = generate('test-namespace')

      expect(typeof generator).toBe('function')
    })

    it('should generate IDs with namespace fingerprint', () => {
      const generator = generate('test-namespace')
      const id = generator()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(24)
    })

    it('should generate IDs with custom length', () => {
      const generator = generate('test-namespace', 10)
      const id = generator()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(10)
    })

    it('should generate unique IDs with same namespace', () => {
      const generator = generate('same-namespace')

      const id1 = generator()
      const id2 = generator()
      const id3 = generator()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it('should generate different IDs with different namespaces', () => {
      const generator1 = generate('namespace-1')
      const generator2 = generate('namespace-2')

      const id1 = generator1()
      const id2 = generator2()

      expect(id1).not.toBe(id2)
    })

    it('should handle empty namespace', () => {
      const generator = generate('')
      const id = generator()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(24)
    })

    it('should handle null namespace', () => {
      const generator = generate(null)
      const id = generator()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(24)
    })

    it('should handle undefined namespace', () => {
      const generator = generate(undefined)
      const id = generator()

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBe(24)
    })

    it('should generate consistent format IDs', () => {
      const generator = generate('consistent-test')
      const ids = []

      for (let i = 0; i < 10; i++) {
        ids.push(generator())
      }

      // All IDs should have the same length
      const lengths = new Set(ids.map((id) => id.length))

      expect(lengths.size).toBe(1)
      expect(lengths.has(24)).toBe(true)
    })
  })
})
