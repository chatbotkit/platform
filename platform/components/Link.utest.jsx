import Link from './Link'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

const mockPrefetch = jest.fn()
const mockRouter = {
  normalizeHref: jest.fn((href) => (href?.pathname ? href.pathname : href)),
  resolveHref: jest.fn((href) => (href?.pathname ? href.pathname : href)),
  isKnownHref: jest.fn(() => false),
  prefetch: mockPrefetch,
  pathname: '/home',
  locale: 'en',
  defaultLocale: 'en',
  isAppHostname: false,
  isAppPathname: false,
}

jest.mock('next/link', () => {
  return function NextLink({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

jest.mock('@/components/CopyButton', () => {
  return function CopyButton({ text, children, ...props }) {
    return (
      <button
        type="button"
        data-testid="copy-button"
        data-text={text}
        {...props}
      >
        {children}
      </button>
    )
  }
})

jest.mock('@/hooks/useRouter', () => ({
  __esModule: true,
  default: jest.fn(() => mockRouter),
}))

jest.mock('@/hooks/useScopedQuerySessionOption', () => ({
  __esModule: true,
  default: jest.fn(() => undefined),
}))

describe('Link', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders as native anchor when target is _self', () => {
    render(
      <Link href="/docs" target="_self">
        Docs
      </Link>
    )

    const link = screen.getByRole('link', { name: 'Docs' })

    expect(link).toHaveAttribute('href', '/docs')
  })

  it('renders mailto links via CopyButton', () => {
    render(<Link href="mailto:test@example.com">Email us</Link>)

    const button = screen.getByTestId('copy-button')

    expect(button).toHaveAttribute('data-text', 'test@example.com')
    expect(button).toHaveTextContent('Email us')
  })

  it('prevents navigation when disabled', () => {
    render(
      <Link href="/billing" target="_self" disabled>
        Billing
      </Link>
    )

    const link = screen.getByRole('link', { name: 'Billing' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })

    link.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(link).toHaveAttribute('tabindex', '-1')
  })

  it('forces prefetch immediately and on interval', () => {
    render(
      <Link href="/support" forcePrefetch forcePrefetchInterval={60000}>
        Support
      </Link>
    )

    expect(mockPrefetch).toHaveBeenCalled()

    const before = mockPrefetch.mock.calls.length

    jest.advanceTimersByTime(60000)

    expect(mockPrefetch.mock.calls.length).toBeGreaterThan(before)
  })
})
