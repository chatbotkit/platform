import {
  TAG_ABORT,
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_MESSAGE,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
  TAG_USAGE,
} from './conv'

describe('conv type constants', () => {
  describe('tag constants', () => {
    it('should define TAG_ABORT', () => {
      expect(TAG_ABORT).toBe('abort')
    })

    it('should define TAG_COMPLETE_BEGIN', () => {
      expect(TAG_COMPLETE_BEGIN).toBe('completeBegin')
    })

    it('should define TAG_COMPLETE_END', () => {
      expect(TAG_COMPLETE_END).toBe('completeEnd')
    })

    it('should define TAG_TOKEN', () => {
      expect(TAG_TOKEN).toBe('token')
    })

    it('should define TAG_REASONING_TOKEN', () => {
      expect(TAG_REASONING_TOKEN).toBe('reasoningToken')
    })

    it('should define TAG_MESSAGE', () => {
      expect(TAG_MESSAGE).toBe('message')
    })

    it('should define TAG_USAGE', () => {
      expect(TAG_USAGE).toBe('usage')
    })
  })

  describe('tag constants uniqueness', () => {
    it('should have unique tag values', () => {
      const tags = [
        TAG_ABORT,
        TAG_COMPLETE_BEGIN,
        TAG_COMPLETE_END,
        TAG_TOKEN,
        TAG_REASONING_TOKEN,
        TAG_MESSAGE,
        TAG_USAGE,
      ]

      const uniqueTags = new Set(tags)

      expect(uniqueTags.size).toBe(tags.length)
    })
  })

  describe('tag constants string type', () => {
    it('should all be strings', () => {
      expect(typeof TAG_ABORT).toBe('string')
      expect(typeof TAG_COMPLETE_BEGIN).toBe('string')
      expect(typeof TAG_COMPLETE_END).toBe('string')
      expect(typeof TAG_TOKEN).toBe('string')
      expect(typeof TAG_REASONING_TOKEN).toBe('string')
      expect(typeof TAG_MESSAGE).toBe('string')
      expect(typeof TAG_USAGE).toBe('string')
    })

    it('should not be empty strings', () => {
      expect(TAG_ABORT.length).toBeGreaterThan(0)
      expect(TAG_COMPLETE_BEGIN.length).toBeGreaterThan(0)
      expect(TAG_COMPLETE_END.length).toBeGreaterThan(0)
      expect(TAG_TOKEN.length).toBeGreaterThan(0)
      expect(TAG_REASONING_TOKEN.length).toBeGreaterThan(0)
      expect(TAG_MESSAGE.length).toBeGreaterThan(0)
      expect(TAG_USAGE.length).toBeGreaterThan(0)
    })
  })
})
