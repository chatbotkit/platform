import { clamp } from './index'

describe('minmax', () => {
  it('should return the number if it is within the range', () => {
    expect(clamp(5, 1, 10)).toBe(5)
  })

  it('should return the minimum if the number is less than the range', () => {
    expect(clamp(0, 1, 10)).toBe(1)
  })

  it('should return the maximum if the number is greater than the range', () => {
    expect(clamp(15, 1, 10)).toBe(10)
  })
})
