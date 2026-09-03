import { isInExperiment, shouldRunExperiment } from './experiment'

jest.mock('@/config/experiments', () => ({
  default: {
    'test-experiment': 20,
    'full-rollout': 100,
    disabled: 0,
  },
  __esModule: true,
}))

describe('experiment', () => {
  describe('shouldRunExperiment', () => {
    it('should return false for empty identifier', async () => {
      expect(await shouldRunExperiment('test', '', 50)).toBe(false)
    })

    it('should return false when percentage is 0', async () => {
      expect(await shouldRunExperiment('test', 'user-123', 0)).toBe(false)
    })

    it('should return false when percentage is negative', async () => {
      expect(await shouldRunExperiment('test', 'user-123', -10)).toBe(false)
    })

    it('should return true when percentage is 100', async () => {
      expect(await shouldRunExperiment('test', 'user-123', 100)).toBe(true)
    })

    it('should return true when percentage is over 100', async () => {
      expect(await shouldRunExperiment('test', 'user-123', 150)).toBe(true)
    })

    it('should be deterministic for the same inputs', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          shouldRunExperiment('chunking', 'user-123', 20)
        )
      )

      expect(new Set(results).size).toBe(1)
    })

    it('should produce different results for different identifiers', async () => {
      // @note with 20% rollout, we expect roughly 20% true in a large sample
      const results = await Promise.all(
        Array.from({ length: 1000 }, (_, i) =>
          shouldRunExperiment('chunking', `user-${i}`, 20)
        )
      )

      const trueCount = results.filter(Boolean).length

      // @note allow some variance (15-25% range for 20% target)
      expect(trueCount).toBeGreaterThan(150)
      expect(trueCount).toBeLessThan(250)
    })

    it('should respect percentage parameter', async () => {
      const results = await Promise.all(
        Array.from({ length: 1000 }, (_, i) =>
          shouldRunExperiment('test-50', `user-${i}`, 50)
        )
      )

      const trueCount = results.filter(Boolean).length

      // @note allow some variance (45-55% range for 50% target)
      expect(trueCount).toBeGreaterThan(450)
      expect(trueCount).toBeLessThan(550)
    })

    it('should produce different buckets for different experiment names', async () => {
      // @note same user should potentially be in different experiments
      const resultA = await shouldRunExperiment('experiment-a', 'user-123', 50)
      const resultB = await shouldRunExperiment('experiment-b', 'user-123', 50)

      // @note we can't guarantee they're different, but we can verify they're
      // both deterministic
      const resultA2 = await shouldRunExperiment('experiment-a', 'user-123', 50)
      const resultB2 = await shouldRunExperiment('experiment-b', 'user-123', 50)

      expect(resultA).toBe(resultA2)
      expect(resultB).toBe(resultB2)
    })
  })

  describe('isInExperiment', () => {
    it('should return false for empty identifier', async () => {
      expect(await isInExperiment('test-experiment', '')).toBe(false)
    })

    it('should use configured percentage from experiments config', async () => {
      // @note test-experiment is mocked at 20%
      const results = await Promise.all(
        Array.from({ length: 1000 }, (_, i) =>
          isInExperiment('test-experiment', `user-${i}`)
        )
      )

      const trueCount = results.filter(Boolean).length

      // @note allow some variance (15-25% range for 20% target)
      expect(trueCount).toBeGreaterThan(150)
      expect(trueCount).toBeLessThan(250)
    })

    it('should be deterministic for the same identifier', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          isInExperiment('test-experiment', 'user-123')
        )
      )

      expect(new Set(results).size).toBe(1)
    })

    it('should return true for all when percentage is 100', async () => {
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          isInExperiment('full-rollout', `user-${i}`)
        )
      )

      expect(results.every(Boolean)).toBe(true)
    })

    it('should return false for all when percentage is 0', async () => {
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          isInExperiment('disabled', `user-${i}`)
        )
      )

      expect(results.every((v) => !v)).toBe(true)
    })
  })
})
