/* eslint-disable @typescript-eslint/no-require-imports */
import Auth from './Auth'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

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
jest.mock('@/lib/toast', () => jest.fn())
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
