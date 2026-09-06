/* eslint-disable @typescript-eslint/no-require-imports */
import NextRouter from 'next/dist/shared/lib/router/router'

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

describe('Auth sign-in callbacks', () => {
  const originalLocation = window.location

  beforeEach(() => {
    delete window.location
    window.location = {
      href: 'http://localhost:3000/signin',
      origin: 'http://localhost:3000',
      pathname: '/signin',
      assign: jest.fn(),
    }
  })

  afterEach(() => {
    window.location = originalLocation
  })

  it.each([
    [TRUSTED_SIGNIN_PROVIDER_ID, '/overview', undefined],
    [
      TRUSTED_SIGNIN_PROVIDER_ID,
      '/welcome?callbackUrl=%2Foverview',
      '/welcome',
    ],
    ['email', '/overview', undefined],
    ['email', '/welcome?callbackUrl=%2Foverview', '/welcome'],
  ])(
    'consumes the %s callback once and reaches %s with middleware enabled',
    async (provider, expectedDestination, intermediateURL) => {
      const signin = jest.fn().mockResolvedValue({ ok: true })
      const callbacks = []
      let destination

      // @note model the server's single-use callback: the first request sets a
      // session and redirects onward; replaying it redirects back with an error
      const visitCallback = (href) => {
        const url = new URL(href, window.location.origin)

        callbacks.push(url)
        destination =
          callbacks.length === 1
            ? url.searchParams.get('callbackUrl')
            : '/signin?error=Verification'
      }

      Object.defineProperty(window.location, 'href', {
        get: () => 'http://localhost:3000/signin',
        set: visitCallback,
      })
      window.location.assign.mockImplementation(visitCallback)

      // @note use Next's installed Pages Router navigation logic: with our
      // catch-all proxy it fetches route data before falling back to a document
      // navigation for an API URL, invoking the same callback twice
      const nextRouter = Object.assign(Object.create(NextRouter.prototype), {
        state: { asPath: '/signin' },
        components: {},
        sdc: {},
        sbc: {},
        isSsr: false,
        pageLoader: {
          getMiddleware: async () => [{ regexp: '.*' }],
          getDataHref: ({ href }) => {
            const url = new URL(href, window.location.origin)

            return `/_next/data/build${url.pathname}.json${url.search}`
          },
        },
      })
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (href) => {
          visitCallback(href)

          return new Response('{}', { status: 200 })
        })
      const push = jest.fn((href) => {
        const url = new URL(href)

        void nextRouter.getRouteInfo({
          route: url.pathname,
          pathname: url.pathname,
          query: Object.fromEntries(url.searchParams),
          as: href,
          resolvedAs: href,
          routeProps: {},
          hasMiddleware: true,
        })
      })

      require('@/hooks/useSignin').mockReturnValue({ signin })
      require('@/hooks/useRouter').mockReturnValue({ query: {}, push })

      try {
        const { container, findByLabelText } = render(
          <Auth providers={[provider]} intermediateURL={intermediateURL} />
        )
        const input = container.querySelector('input[name="email"]')

        // @note jsdom lacks the browser's named form-control properties used
        // by the email-code form; resolve them through its actual elements
        Object.defineProperties(input.form, {
          email: { get: () => input.form.elements.namedItem('email') },
          token: { get: () => input.form.elements.namedItem('token') },
        })

        fireEvent.change(input, { target: { value: 'alice@example.com' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        if (provider === 'email') {
          const pin = await findByLabelText('PIN field 1 of 6')

          // @note pasting a complete code exercises the real PinInput and
          // its automatic verification callback
          fireEvent.change(pin, { target: { value: '123abc' } })
        }

        await waitFor(() => expect(destination).toBeDefined())
        expect(destination).toBe(expectedDestination)
        expect(callbacks).toHaveLength(1)
        expect(callbacks[0].pathname).toBe(`/api/auth/callback/${provider}`)
        expect(callbacks[0].searchParams.get('email')).toBe('alice@example.com')
        expect(callbacks[0].searchParams.get('token')).toBe(
          provider === 'email' ? '123abc' : signin.mock.calls[0][1].trustedToken
        )
        expect(push).not.toHaveBeenCalled()
        expect(fetchSpy).not.toHaveBeenCalled()
      } finally {
        fetchSpy.mockRestore()
      }
    }
  )

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
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledTimes(1))

    const options = signin.mock.calls[0][1]

    expect(signin.mock.calls[0][0]).toBe(TRUSTED_SIGNIN_PROVIDER_ID)
    expect(options.email).toBe('alice@example.com')
    expect(options.trustedToken).toMatch(/^[0-9a-f-]{36}$/)

    const callback = new URL(window.location.assign.mock.calls[0][0])

    expect(callback.pathname).toBe(
      `/api/auth/callback/${TRUSTED_SIGNIN_PROVIDER_ID}`
    )
    expect(callback.searchParams.get('email')).toBe('alice@example.com')
    expect(callback.searchParams.get('token')).toBe(options.trustedToken)
    expect(push).not.toHaveBeenCalled()

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
