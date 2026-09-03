import provider, {
  DEFAULT_PII_SCORE_THRESHOLD,
  assertConfigured,
  detectPiiEntities,
  getSafeTextAndEntities,
  redactEntities,
  unredactEntities,
} from './index'

// @note the community provider is a pass through, so what these cover is that
// it passes text through rather than mangling it: a deployment with no detector
// installed must still be able to send a message.

describe('community pii provider', () => {
  describe('detectPiiEntities', () => {
    it('should find nothing', async () => {
      const result = await detectPiiEntities('My name is John')

      expect(result).toEqual([])
    })

    it('should find nothing whatever language or threshold is asked for', async () => {
      const result = await detectPiiEntities('José', 'es', 0.1)

      expect(result).toEqual([])
    })
  })

  describe('getSafeTextAndEntities', () => {
    it('should return the text unchanged', () => {
      const text = 'Contact John at john@example.com'

      const { safeText, safeEntities } = getSafeTextAndEntities(text, [])

      expect(safeText).toBe(text)
      expect(safeEntities).toEqual([])
    })

    it('should report no replacements even when handed entities', () => {
      const text = 'Contact John at john@example.com'

      const { safeText, safeEntities } = getSafeTextAndEntities(text, [
        { type: 'name', begin: 8, end: 12 },
      ])

      // @note it reports that nothing was replaced rather than reporting
      // replacements it did not make, so a caller that unredacts afterwards
      // gets its own text back either way

      expect(safeText).toBe(text)
      expect(safeEntities).toEqual([])
    })
  })

  describe('redactEntities', () => {
    it('should return the text unchanged', () => {
      const text = 'Hello John, how are you?'

      const entities = [
        { text: 'John', replacement: { begin: 6, end: 19, text: '[name:abc]' } },
      ]

      expect(redactEntities(text, entities)).toBe(text)
    })
  })

  describe('unredactEntities', () => {
    it('should return the text unchanged', () => {
      const text = 'Hello John, how are you?'

      const entities = [
        { text: 'John', replacement: { begin: 6, end: 19, text: '[name:abc]' } },
      ]

      expect(unredactEntities(text, entities)).toBe(text)
    })
  })

  describe('the round trip', () => {
    it('should return the original text', async () => {
      const text = 'Contact John at john@example.com or call 555-1234'

      const entities = await detectPiiEntities(text)

      const { safeText, safeEntities } = getSafeTextAndEntities(text, entities)

      const redacted = redactEntities(safeText, safeEntities)

      expect(unredactEntities(redacted, safeEntities)).toBe(text)
    })
  })

  describe('assertConfigured', () => {
    it('should resolve, because nothing needs configuring', async () => {
      await expect(assertConfigured()).resolves.toBeUndefined()
    })
  })

  describe('DEFAULT_PII_SCORE_THRESHOLD', () => {
    it('should be carried for callers reasoning about thresholds', () => {
      expect(DEFAULT_PII_SCORE_THRESHOLD).toBe(0.8)
    })
  })

  describe('the default export', () => {
    it('should expose the whole surface', () => {
      expect(provider.detectPiiEntities).toBe(detectPiiEntities)
      expect(provider.getSafeTextAndEntities).toBe(getSafeTextAndEntities)
      expect(provider.redactEntities).toBe(redactEntities)
      expect(provider.unredactEntities).toBe(unredactEntities)
      expect(provider.assertConfigured).toBe(assertConfigured)
    })
  })
})
