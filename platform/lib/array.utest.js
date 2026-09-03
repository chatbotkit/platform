import { allTrue, distributed } from '@/lib/array'

describe('allTrue', () => {
  it('must correctly validate condition', () => {
    expect(allTrue([])).toBeTruthy()

    expect(allTrue([true])).toBeTruthy()
    expect(allTrue([true, true])).toBeTruthy()
    expect(allTrue([true, true, true])).toBeTruthy()

    expect(allTrue([false])).not.toBeTruthy()
    expect(allTrue([false, false])).not.toBeTruthy()
    expect(allTrue([false, false, false])).not.toBeTruthy()

    expect(allTrue([true, false])).not.toBeTruthy()
    expect(allTrue([false, true])).not.toBeTruthy()
  })
})

describe('distributed', () => {
  test('returns empty array when input array is empty', () => {
    expect(distributed([], 3)).toEqual([])
  })

  test('returns empty array when n is zero or negative', () => {
    expect(distributed([1, 2, 3, 4, 5], 0)).toEqual([])
    expect(distributed([1, 2, 3, 4, 5], -1)).toEqual([])
  })

  test('returns entire array when n >= array length', () => {
    const arr = [1, 2, 3, 4, 5]

    expect(distributed(arr, 5)).toEqual(arr)
    expect(distributed(arr, 6)).toEqual(arr)
  })

  test('returns first element when n = 1', () => {
    expect(distributed([1, 2, 3, 4, 5], 1)).toEqual([1])
  })

  test('returns first and last elements when n = 2', () => {
    expect(distributed([1, 2, 3, 4, 5], 2)).toEqual([1, 5])
  })

  test('returns first, middle and last elements when n = 3', () => {
    expect(distributed([1, 2, 3, 4, 5], 3)).toEqual([1, 3, 5])
    expect(distributed([1, 2, 3, 4], 3)).toEqual([1, 3, 4])
  })

  test('properly distributes elements for other values of n', () => {
    expect(distributed([1, 2, 3, 4, 5, 6, 7], 4)).toEqual([1, 3, 5, 7])
    expect(distributed([1, 2, 3, 4, 5, 6, 7, 8, 9], 5)).toEqual([1, 3, 5, 7, 9])
  })

  test('handles arrays with different types', () => {
    expect(distributed(['a', 'b', 'c', 'd', 'e'], 3)).toEqual(['a', 'c', 'e'])
    expect(distributed([true, false, true, false], 2)).toEqual([true, false])
  })

  test('does not modify the original array', () => {
    const original = [1, 2, 3, 4, 5]
    const originalCopy = [...original]

    distributed(original, 3)

    expect(original).toEqual(originalCopy)
  })
})
