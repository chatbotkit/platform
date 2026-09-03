// @ts-nocheck

import { iterationLimitReached } from '@/lib/conv.iteration'

// @note this is the single between-iteration gate the provider drivers consult
// to decide whether the agentic loop recurses. Pure + dependency-free, so the
// real decision (incl. the soft-yield short-circuit wired for messaging
// supersede) is unit-tested here in isolation from the env-heavy driver module.

describe('iterationLimitReached', () => {
  describe('iteration limit', () => {
    test('false when no limit is set, regardless of count', () => {
      expect(iterationLimitReached({ currentIterations: 0 })).toBe(false)
      expect(iterationLimitReached({ currentIterations: 1_000 })).toBe(false)
    })

    test('true when the NEXT iteration would reach the limit', () => {
      // 0 + 1 >= 1
      expect(
        iterationLimitReached({ currentIterations: 0, maxIterations: 1 })
      ).toBe(true)
      // 4 + 1 >= 5
      expect(
        iterationLimitReached({ currentIterations: 4, maxIterations: 5 })
      ).toBe(true)
    })

    test('false while still below the limit', () => {
      // 0 + 1 < 5
      expect(
        iterationLimitReached({ currentIterations: 0, maxIterations: 5 })
      ).toBe(false)
      // 3 + 1 < 5
      expect(
        iterationLimitReached({ currentIterations: 3, maxIterations: 5 })
      ).toBe(false)
    })
  })

  describe('soft-yield (yieldSignal)', () => {
    test('false when the signal exists but is not aborted', () => {
      const controller = new AbortController()

      expect(
        iterationLimitReached({
          yieldSignal: controller.signal,
          currentIterations: 0,
          maxIterations: 10,
        })
      ).toBe(false)
    })

    test('true once aborted, even with no iteration limit set', () => {
      const controller = new AbortController()

      controller.abort()

      expect(
        iterationLimitReached({
          yieldSignal: controller.signal,
          currentIterations: 0,
        })
      ).toBe(true)
    })

    test('takes precedence over an as-yet-unreached iteration limit', () => {
      const controller = new AbortController()

      controller.abort()

      // @note on the limit alone this is false (0 + 1 < 5); the soft-yield is
      // what forces the stop. This is the messaging-supersede path.
      expect(
        iterationLimitReached({
          yieldSignal: controller.signal,
          currentIterations: 0,
          maxIterations: 5,
        })
      ).toBe(true)
    })

    test('an aborted signal stops the loop at any iteration count', () => {
      const controller = new AbortController()

      controller.abort()

      expect(
        iterationLimitReached({
          yieldSignal: controller.signal,
          currentIterations: 999,
          maxIterations: 100_000,
        })
      ).toBe(true)
    })
  })
})
