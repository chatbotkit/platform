import { isUuid } from '@/lib/uuid'

describe('isUuid', () => {
  describe('valid UUIDs', () => {
    it('should return true for valid lowercase UUID', () => {
      expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    })

    it('should return true for valid uppercase UUID', () => {
      expect(isUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true)
    })

    it('should return true for valid mixed case UUID', () => {
      expect(isUuid('123e4567-E89B-12d3-A456-426614174000')).toBe(true)
    })

    it('should return true for UUID with all zeros', () => {
      expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true)
    })

    it('should return true for UUID with all f', () => {
      expect(isUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true)
    })
  })

  describe('invalid UUIDs', () => {
    it('should return false for null', () => {
      expect(isUuid(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isUuid(undefined)).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isUuid('')).toBe(false)
    })

    it('should return false for slug-like string', () => {
      expect(isUuid('chatbotkit-terraform-provider')).toBe(false)
    })

    it('should return false for random slug', () => {
      expect(isUuid('some-random-slug')).toBe(false)
    })

    it('should return false for UUID without hyphens', () => {
      expect(isUuid('123e4567e89b12d3a456426614174000')).toBe(false)
    })

    it('should return false for UUID with extra characters', () => {
      expect(isUuid('123e4567-e89b-12d3-a456-426614174000x')).toBe(false)
    })

    it('should return false for UUID with missing characters', () => {
      expect(isUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false)
    })

    it('should return false for UUID with invalid characters', () => {
      expect(isUuid('123e4567-e89b-12d3-a456-42661417400g')).toBe(false)
    })

    it('should return false for UUID with wrong segment lengths', () => {
      expect(isUuid('123e456-e89b-12d3-a456-426614174000')).toBe(false)
    })

    it('should return false for plain text', () => {
      expect(isUuid('hello world')).toBe(false)
    })

    it('should return false for numeric string', () => {
      expect(isUuid('12345678901234567890123456789012')).toBe(false)
    })
  })
})
