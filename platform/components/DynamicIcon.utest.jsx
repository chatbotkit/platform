import { dynamicIconToUrl } from './DynamicIcon'

describe('dynamicIconToUrl', () => {
  it('returns direct URLs unchanged', () => {
    const url = 'https://example.com/icon.svg'

    expect(dynamicIconToUrl(url)).toBe(url)
  })

  it('builds logo URL from @logo shorthand', () => {
    expect(dynamicIconToUrl('@logo/chatbotkit.com')).toBe(
      'https://google.com/s2/favicons?domain=chatbotkit.com&sz=256'
    )
  })

  it('builds favicon URL from @favicon shorthand', () => {
    expect(dynamicIconToUrl('@favicon/chatbotkit.com')).toBe(
      'https://google.com/s2/favicons?domain=chatbotkit.com&sz=256'
    )
  })

  it('returns null for invalid logo input', () => {
    expect(dynamicIconToUrl('@logo/%%%%')).toBeNull()
  })

  it('returns generated heroicons url for unqualified heroicons path', () => {
    expect(dynamicIconToUrl('@heroicons/star')).toBe(
      'https://cdn.jsdelivr.net/npm/heroicons@2.1.1/24/outline/star.svg'
    )
  })

  it('returns generated google provider URL', () => {
    expect(dynamicIconToUrl('@google/example.com')).toBe(
      'https://www.google.com/s2/favicons?domain=example.com&sz=256'
    )
  })
})
