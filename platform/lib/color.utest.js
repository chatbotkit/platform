import { isDarkColor } from '@/lib/color'

describe('isDarkColor', () => {
  it('should return true for dark colors', () => {
    expect(isDarkColor('#000000')).toBe(true)
    expect(isDarkColor('#333333')).toBe(true)
    expect(isDarkColor('#555555')).toBe(true)
  })

  it('should return false for light colors', () => {
    expect(isDarkColor('#FFFFFF')).toBe(false)
    expect(isDarkColor('#CCCCCC')).toBe(false)
    expect(isDarkColor('#AAAAAA')).toBe(false)
  })
})
