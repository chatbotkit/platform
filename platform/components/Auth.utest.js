/* eslint-disable @typescript-eslint/no-require-imports */
import { TRUSTED_SIGNIN_PROVIDER_ID } from '@/lib/auth.trusted.consts'

import Auth from './Auth'

import '@testing-library/jest-dom'
import { fireEvent, render, waitFor } from '@testing-library/react'

jest.mock('@/config/site', () => ({ siteUrl: 'https://chatbotkit.com' }))

jest.mock('@/hooks/useRouter', () =>
  jest.fn(() => ({
    query: {},
    asPath: '/signin',
    push: jest.fn(),
    locale: 'en',
    defaultLocale: 'en',
    locales: ['en'],
    resolveHref: jest.fn((x) => x),
  }))
)

jest.mock('@/hooks/useSession', () =>
  jest.fn(() => ({ status: 'unauthenticated' }))
)
jest.mock('@/hooks/useIsTop', () => jest.fn(() => true))
jest.mock('@/hooks/useSignin', () => jest.fn(() => ({ signin: jest.fn() })))
jest.mock('@/hooks/useSignout', () => jest.fn(() => ({ signout: jest.fn() })))
jest.mock('@/hooks/useHostname', () => jest.fn(() => 'chatbotkit.com'))
jest.mock('@/lib/error', () => ({ captureException: jest.fn() }))
jest.mock('@/lib/toast', () => ({ success: jest.fn() }))
jest.mock('@/lib/email.validation', () => ({
  isValidEmail: jest.fn(() => true),
}))

jest.mock(
  '@/components/Link',
  () =>
    function Link({ href, children, ...props }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }
)

jest.mock('@/components/PartnerBanner', () => () => null)

jest.mock('@/components/PinInput', () => () => null)

describe('Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('callbackUrl handling', () => {
    it('should render without crashing when no callbackUrl is provided', () => {
      const useRouter = require('@/hooks/useRouter')

      useRouter.mockReturnValue({
        query: {},
        asPath: '/signin',
        push: jest.fn(),
        locale: 'en',
        defaultLocale: 'en',
        locales: ['en'],
        resolveHref: jest.fn((x) => x),
      })

      expect(() => render(<Auth />)).not.toThrow()
    })

    it('should render without crashing when callbackUrl is a valid path', () => {
      const useRouter = require('@/hooks/useRouter')

      useRouter.mockReturnValue({
        query: { callbackUrl: '/dashboard' },
        asPath: '/signin',
        push: jest.fn(),
        locale: 'en',
        defaultLocale: 'en',
        locales: ['en'],
        resolveHref: jest.fn((x) => x),
      })

      expect(() => render(<Auth />)).not.toThrow()
    })

    it('should not throw when callbackUrl is a malformed absolute URL like http://', () => {
      const useRouter = require('@/hooks/useRouter')

      // Simulates a bot request like: /signin?callbackUrl=http://
      // new URL('http://', siteUrl) throws TypeError: Invalid URL
      useRouter.mockReturnValue({
        query: { callbackUrl: 'http://' },
        asPath: '/signin',
        push: jest.fn(),
        locale: 'en',
        defaultLocale: 'en',
        locales: ['en'],
        resolveHref: jest.fn((x) => x),
      })

      expect(() => render(<Auth />)).not.toThrow()
    })

    it('should not throw when callbackUrl is https:// with no host', () => {
      const useRouter = require('@/hooks/useRouter')

      useRouter.mockReturnValue({
        query: { callbackUrl: 'https://' },
        asPath: '/signin',
        push: jest.fn(),
        locale: 'en',
        defaultLocale: 'en',
        locales: ['en'],
        resolveHref: jest.fn((x) => x),
      })

      expect(() => render(<Auth />)).not.toThrow()
    })

    it('should not throw when callbackUrl is an absolute external URL', () => {
      const useRouter = require('@/hooks/useRouter')

      useRouter.mockReturnValue({
        query: { callbackUrl: 'https://evil.example/steal' },
        asPath: '/signin',
        push: jest.fn(),
        locale: 'en',
        defaultLocale: 'en',
        locales: ['en'],
        resolveHref: jest.fn((x) => x),
      })

      expect(() => render(<Auth />)).not.toThrow()
    })
  })
})

describe('Auth trusted sign-in', () => {
  it('normalizes the email and uses a fresh token for each attempt', async () => {
    const signin = jest.fn().mockResolvedValue({ ok: true })
    const push = jest.fn()

    require('@/hooks/useSignin').mockReturnValue({ signin })
    require('@/hooks/useRouter').mockReturnValue({ query: {}, push })

    const { container } = render(
      <Auth providers={['email', TRUSTED_SIGNIN_PROVIDER_ID]} />
    )
    const input = container.querySelector('input[name="email"]')

    fireEvent.change(input, { target: { value: 'Alice@Example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))

    const options = signin.mock.calls[0][1]

    expect(signin.mock.calls[0][0]).toBe(TRUSTED_SIGNIN_PROVIDER_ID)
    expect(options.email).toBe('alice@example.com')
    expect(options.trustedToken).toMatch(/^[0-9a-f-]{36}$/)

    const callback = new URL(push.mock.calls[0][0])

    expect(callback.pathname).toBe(
      `/api/auth/callback/${TRUSTED_SIGNIN_PROVIDER_ID}`
    )
    expect(callback.searchParams.get('email')).toBe('alice@example.com')
    expect(callback.searchParams.get('token')).toBe(options.trustedToken)

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(signin).toHaveBeenCalledTimes(2))
    expect(signin.mock.calls[1][1].trustedToken).not.toBe(options.trustedToken)
  })

  it('does not verify a rejected sign-in even when the HTTP response is OK', async () => {
    const signin = jest
      .fn()
      .mockResolvedValue({ ok: true, error: 'InvalidEmail' })
    const push = jest.fn()
    const replace = jest.fn()

    require('@/hooks/useSignin').mockReturnValue({ signin })
    require('@/hooks/useRouter').mockReturnValue({ query: {}, push, replace })

    const { container } = render(
      <Auth providers={[TRUSTED_SIGNIN_PROVIDER_ID]} />
    )
    const input = container.querySelector('input[name="email"]')

    fireEvent.change(input, { target: { value: 'alice@example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(replace).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
    expect(new URL(replace.mock.calls[0][0]).searchParams.get('error')).toBe(
      'InvalidEmail'
    )
  })

  it('renders the trusted form instead of the email code form', () => {
    const { container, queryByText } = render(
      <Auth providers={['email', TRUSTED_SIGNIN_PROVIDER_ID]} />
    )

    expect(queryByText('Sign in as')).toBeInTheDocument()
    expect(queryByText('Login with email')).not.toBeInTheDocument()

    // @note trusted is not an OAuth provider and must not get a button
    expect(
      queryByText(`Sign in with ${TRUSTED_SIGNIN_PROVIDER_ID}`)
    ).not.toBeInTheDocument()

    expect(container.querySelector('input[name="email"]')).not.toBeNull()
  })

  it('keeps the email code form when trusted sign-in is off', () => {
    const { queryByText } = render(<Auth providers={['email']} />)

    expect(queryByText('Login with email')).toBeInTheDocument()
    expect(queryByText('Sign in as')).not.toBeInTheDocument()
  })
})
