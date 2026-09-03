import { runOncePerKey } from '@/lib/concurrency'
import { getRandomId } from '@/lib/string'

describe('runOncePerKey', () => {
  it('should execute a function with a given key', async () => {
    const key = getRandomId('key-')
    const expectedResult = 'result'

    async function testFn() {
      return expectedResult
    }

    const result = await runOncePerKey(key, testFn)

    expect(result).toBe(expectedResult)
  })

  it('should not execute the function again while it is already running with the same key', async () => {
    const key = getRandomId('key-')

    let executionCount = 0

    async function testFn() {
      executionCount++

      return new Promise((resolve) =>
        setTimeout(() => resolve(executionCount), 100)
      )
    }

    const promise1 = runOncePerKey(key, testFn)
    const promise2 = runOncePerKey(key, testFn)

    const result1 = await promise1
    const result2 = await promise2

    expect(result1).toBe(1)
    expect(result2).toBe(1)
    expect(executionCount).toBe(1)
  })

  it('should execute the function separately for different keys', async () => {
    const results = {}

    async function testFn(key) {
      return new Promise((resolve) => setTimeout(() => resolve(key), 50))
    }

    const promise1 = runOncePerKey(getRandomId('key-'), () => testFn('result1'))
    const promise2 = runOncePerKey(getRandomId('key-'), () => testFn('result2'))

    results['result1'] = await promise1
    results['result2'] = await promise2

    expect(results['result1']).toBe('result1')
    expect(results['result2']).toBe('result2')
  })

  it('should handle errors in the function and allow retries for the same key', async () => {
    const key = getRandomId('key-')

    let attempts = 0

    async function testFn() {
      attempts++

      if (attempts === 1) {
        throw new Error('Fail')
      }

      return 'Success'
    }

    await expect(runOncePerKey(key, testFn)).rejects.toThrow('Fail')

    const result = await runOncePerKey(key, testFn)

    expect(result).toBe('Success')
  })
})
