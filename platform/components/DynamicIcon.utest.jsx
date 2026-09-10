import useHydrated from '@/hooks/useHydrated'
import useTheme from '@/hooks/useTheme'

import DynamicIcon, { dynamicIconToUrl } from './DynamicIcon'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@/hooks/useHydrated', () => ({
  __esModule: true,
  default: jest.fn(() => true),
}))

jest.mock('@/hooks/useTheme', () => ({
  __esModule: true,
  default: jest.fn(() => ({ theme: 'light' })),
}))

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

describe('DynamicIcon theme variants', () => {
  const icon = '/icon.png;/icon.png#filter=invertGrayscale'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the light variant on the first client pass even in dark mode', () => {
    useTheme.mockReturnValue({ theme: 'dark' })
    useHydrated.mockReturnValue(false)

    const { getByRole } = render(<DynamicIcon icon={icon} alt="Logo" />)

    expect(getByRole('img')).not.toHaveStyle({
      filter: 'invert(1) grayscale(1)',
    })
  })

  it('renders the dark variant once hydrated', () => {
    useTheme.mockReturnValue({ theme: 'dark' })
    useHydrated.mockReturnValue(true)

    const { getByRole } = render(<DynamicIcon icon={icon} alt="Logo" />)

    expect(getByRole('img')).toHaveStyle({ filter: 'invert(1) grayscale(1)' })
  })

  it('keeps the light variant when hydrated in light mode', () => {
    useTheme.mockReturnValue({ theme: 'light' })
    useHydrated.mockReturnValue(true)

    const { getByRole } = render(<DynamicIcon icon={icon} alt="Logo" />)

    expect(getByRole('img')).not.toHaveStyle({
      filter: 'invert(1) grayscale(1)',
    })
  })
})
