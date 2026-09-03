import {
  MAX_THINKING_LOADING_MESSAGES,
  THINKING_LOADING_MESSAGES,
  THINKING_STATUS,
  composeThinkingLoadingMessages,
} from '@/lib/messaging.thinking'

describe('messaging.thinking', () => {
  describe('constants', () => {
    it('exposes a non-empty status verb and default loader lines within the cap', () => {
      expect(THINKING_STATUS).toBeTruthy()

      expect(THINKING_LOADING_MESSAGES.length).toBeGreaterThan(0)

      expect(THINKING_LOADING_MESSAGES.length).toBeLessThanOrEqual(
        MAX_THINKING_LOADING_MESSAGES
      )
    })
  })

  describe('composeThinkingLoadingMessages', () => {
    it('returns the shared defaults when given no extras', () => {
      expect(composeThinkingLoadingMessages()).toEqual([
        ...THINKING_LOADING_MESSAGES,
      ])
    })

    it('appends channel/integration extras after the defaults', () => {
      const result = composeThinkingLoadingMessages(['Custom line...'], {
        base: ['a...', 'b...'],
      })

      expect(result).toEqual(['a...', 'b...', 'Custom line...'])
    })

    // @note the shared defaults are sized to fill a channel's whole ceiling on
    // their own, so a naive append-then-truncate would drop the caller's line
    it('keeps caller extras when the defaults already fill the cap', () => {
      const result = composeThinkingLoadingMessages(['Custom line...'])

      expect(result).toHaveLength(MAX_THINKING_LOADING_MESSAGES)

      expect(result).toContain('Custom line...')

      // @note the tail of the progression yields, not its opening lines
      expect(result[0]).toBe(THINKING_LOADING_MESSAGES[0])

      expect(result[result.length - 1]).toBe('Custom line...')
    })

    it('caps extras themselves when they alone exceed the maximum', () => {
      const many = Array.from({ length: 20 }, (_, i) => `Extra ${i}...`)

      const result = composeThinkingLoadingMessages(many)

      expect(result).toHaveLength(MAX_THINKING_LOADING_MESSAGES)

      // @note no room left for any default
      expect(result[0]).toBe('Extra 0...')
    })

    it('trims whitespace and drops empty entries', () => {
      const result = composeThinkingLoadingMessages(
        ['  Spaced...  ', '   ', ''],
        { base: [] }
      )

      expect(result).toEqual(['Spaced...'])
    })

    it('de-duplicates within and across the base and extras', () => {
      const result = composeThinkingLoadingMessages(['Dup...', 'Dup...'], {
        base: ['Dup...', 'Base...'],
      })

      // @note the base copy yields to the extra rather than appearing twice
      expect(result).toEqual(['Base...', 'Dup...'])
    })

    it('caps the result at the configured maximum', () => {
      const many = Array.from({ length: 20 }, (_, i) => `Line ${i}...`)

      const result = composeThinkingLoadingMessages(many, { base: [], max: 10 })

      expect(result).toHaveLength(10)

      expect(result[0]).toBe('Line 0...')
    })

    it('honours a caller-supplied base ahead of extras', () => {
      const result = composeThinkingLoadingMessages(['b...'], {
        base: ['a...'],
      })

      expect(result).toEqual(['a...', 'b...'])
    })
  })
})
