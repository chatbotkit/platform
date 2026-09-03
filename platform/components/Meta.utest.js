import { getStartOfDay } from '@chatbotkit-dev/time'

import Meta from '@/components/Meta'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@chatbotkit-dev/observability', () => ({
  __esModule: true,
  default: {
    startSpan: jest.fn(() => ({
      finish: jest.fn(),
      setAttribute: jest.fn(),
    })),
  },
}))

jest.mock('next/head', () => {
  return function Head({ children }) {
    return <>{children}</>
  }
})

jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn() },
  })),
}))

jest.mock('@/hooks/useRouter', () => {
  return jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn() },
  }))
})

jest.mock('@/hooks/useUrl', () => {
  return jest.fn(() => 'https://chatbotkit.com/')
})

jest.mock('@/components/StructuredData', () => {
  return function MockStructuredData() {
    return null
  }
})

let mockIsDevelopment = false
let mockIsStaging = false

jest.mock('@/lib/env', () => ({
  get isDevelopment() {
    return mockIsDevelopment
  },
  get isStaging() {
    return mockIsStaging
  },
}))

jest.mock('@/lib/og', () => ({
  getLocale: jest.fn(() => 'en'),
}))

jest.mock('@/lib/url', () => ({
  withPathnamePrefix: jest.fn((url) => url),
}))

describe('Meta', () => {
  beforeEach(() => {
    mockIsDevelopment = false
    mockIsStaging = false
  })

  describe('last-modified meta tag', () => {
    it('should render meta last-modified with a valid ISO date string', () => {
      const { container } = render(
        <Meta title="Test Page" description="Test description" />
      )

      const lastModifiedMeta = document.head.querySelector(
        'meta[name="last-modified"]'
      )

      expect(lastModifiedMeta).toBeInTheDocument()

      const content = lastModifiedMeta?.getAttribute('content')

      expect(content).toBeTruthy()
      expect(() => new Date(content).toISOString()).not.toThrow()
    })
  })

  describe('canonical', () => {
    it('defaults the canonical link to this page', () => {
      const { container } = render(
        <Meta title="Test" description="Test" thisUrl="https://chatbotkit.com/" />
      )

      const canonical = document.head.querySelector('link[rel="canonical"]')

      expect(canonical).toHaveAttribute('href', 'https://chatbotkit.com/')
    })

    it('points the canonical link elsewhere when overridden', () => {
      const { container } = render(
        <Meta
          title="Test"
          description="Test"
          thisUrl="https://chatbotkit.com/ai/widgets/slack"
          canonical="https://chatbotkit.com/ai/agents/slack"
        />
      )

      const canonical = document.head.querySelector('link[rel="canonical"]')

      expect(canonical).toHaveAttribute(
        'href',
        'https://chatbotkit.com/ai/agents/slack'
      )
    })
  })

  describe('robots', () => {
    it('is index,follow by default', () => {
      const { container } = render(<Meta title="Test" description="Test" />)

      const robots = document.head.querySelector('meta[name="robots"]')

      expect(robots).toHaveAttribute('content', 'index,follow')
    })

    it('is noindex,follow when noindex is set', () => {
      const { container } = render(
        <Meta title="Test" description="Test" noindex={true} />
      )

      const robots = document.head.querySelector('meta[name="robots"]')

      expect(robots).toHaveAttribute('content', 'noindex,follow')
    })

    it('is noindex in development', () => {
      mockIsDevelopment = true

      render(<Meta title="Test" description="Test" />)

      const robots = document.head.querySelector('meta[name="robots"]')

      expect(robots).toHaveAttribute('content', 'noindex')
    })

    it('is noindex in staging', () => {
      mockIsStaging = true

      render(<Meta title="Test" description="Test" />)

      const robots = document.head.querySelector('meta[name="robots"]')

      expect(robots).toHaveAttribute('content', 'noindex')
    })
  })
})

describe('getStartOfDay timezone sensitivity', () => {
  it('should return midnight in the local timezone (timezone-dependent)', () => {
    // This test documents the root cause of Sentry hydration errors (issues 54 and 58):
    //
    // getStartOfDay() internally calls date.setHours(0, 0, 0, 0) which sets time to
    // midnight in the LOCAL timezone. When:
    //   - Server (Node.js/Vercel) runs in UTC → midnight = 2024-01-01T00:00:00.000Z
    //   - Client in UTC-8 → midnight = 2024-01-01T08:00:00.000Z
    //
    // React 18 detects this mismatch and throws: "There was an error while hydrating"
    // then re-renders the entire page on the client.
    //
    // Fix: Add suppressHydrationWarning to the <meta name="last-modified"> tag in Meta.jsx
    // This tells React to accept the timezone-based mismatch for that element only.

    const startOfDay = getStartOfDay()

    // getStartOfDay must return a Date object
    expect(startOfDay).toBeInstanceOf(Date)

    // Hours, minutes, seconds, and milliseconds should all be 0 (midnight in local timezone)
    expect(startOfDay.getHours()).toBe(0)
    expect(startOfDay.getMinutes()).toBe(0)
    expect(startOfDay.getSeconds()).toBe(0)
    expect(startOfDay.getMilliseconds()).toBe(0)

    // The ISO string will differ between server (UTC) and client (non-UTC timezone)
    // because getTime() returns the absolute UTC epoch time, which is offset-dependent
    const isoString = startOfDay.toISOString()

    // In UTC environment (CI/server): "2024-01-01T00:00:00.000Z" (midnight UTC)
    // In UTC-8 timezone (most US clients): "2024-01-01T08:00:00.000Z" (midnight local = 8am UTC)
    // These differ, causing the hydration mismatch
    expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('demonstrates that different UTC offsets produce different toISOString values for midnight', () => {
    // Direct simulation: two dates at "midnight" in different timezone interpretations
    const utcMidnight = new Date('2024-06-15T00:00:00.000Z') // Server (UTC)
    const utcMinus8Midnight = new Date('2024-06-15T08:00:00.000Z') // Client (UTC-8)

    // Server renders the UTC midnight ISO string
    const serverRendered = utcMidnight.toISOString()
    // Client (UTC-8 user) renders their local midnight ISO string
    const clientRendered = utcMinus8Midnight.toISOString()

    // These are different - causing React hydration mismatch without suppressHydrationWarning
    expect(serverRendered).not.toBe(clientRendered)
    expect(serverRendered).toBe('2024-06-15T00:00:00.000Z')
    expect(clientRendered).toBe('2024-06-15T08:00:00.000Z')
  })
})
