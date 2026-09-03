import { THEME_AWARE_ICON_MAP, toThemeAwareIcon } from '@/lib/icon.theme'

describe('toThemeAwareIcon', () => {
  it('swaps a monochrome brand logo for its theme-aware variant', () => {
    expect(toThemeAwareIcon('@logo/chatbotkit.com')).toBe(
      THEME_AWARE_ICON_MAP['@logo/chatbotkit.com']
    )
  })

  it('leaves an unmapped icon string unchanged', () => {
    expect(toThemeAwareIcon('@logo/slack.com')).toBe('@logo/slack.com')
    expect(toThemeAwareIcon('@heroicons/sparkles')).toBe('@heroicons/sparkles')
  })

  it('returns non-string (component) icons unchanged', () => {
    const Component = () => null

    expect(toThemeAwareIcon(Component)).toBe(Component)
    expect(toThemeAwareIcon(undefined)).toBeUndefined()
    expect(toThemeAwareIcon(null)).toBeNull()
  })
})
