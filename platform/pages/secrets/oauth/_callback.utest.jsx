import Page from './callback'

import { render, screen } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/context.setup', () => ({ setupRequestContext: jest.fn() }))
jest.mock('@/lib/context.store', () => ({ executeInContext: jest.fn() }))
jest.mock('@/lib/host', () => ({ getExternalFrontendHostURL: jest.fn() }))
jest.mock('@/lib/jwt', () => ({ trySign: jest.fn(), tryVerify: jest.fn() }))
jest.mock('@/lib/oauth.authorization', () => ({
  getAuthorizationCodeGrantCredentials: jest.fn(),
}))
jest.mock('@/lib/oauth.pkce', () => ({ retrievePkceVerifier: jest.fn() }))
jest.mock('@/lib/secret.oauth', () => ({
  getNewSecretOAuthValue: jest.fn(),
  getSecretOAuthConfig: jest.fn(),
}))
jest.mock('@/layouts/Errata', () => ({
  __esModule: true,
  default: ({ children }) => children,
  fail: jest.fn(),
}))

describe('secret oauth callback page', () => {
  let postMessage
  let close

  beforeEach(() => {
    postMessage = jest.fn()
    close = jest.spyOn(window, 'close').mockImplementation(() => {})

    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: { postMessage },
    })
  })

  afterEach(() => {
    close.mockRestore()

    delete window.opener
  })

  it('should report success to the opener regardless of its origin', () => {
    render(<Page secretId="secret_1" />)

    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'oauth',
        params: {
          error: undefined,
          error_description: undefined,
          secretId: 'secret_1',
        },
      },
      '*'
    )

    expect(close).toHaveBeenCalledTimes(1)

    expect(screen.getByText('Success')).toBeTruthy()
  })

  it('should report an error to the opener and stay open', () => {
    render(
      <Page
        secretId="secret_1"
        error="access_denied"
        error_description="User declined"
      />
    )

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'oauth',
        params: {
          error: 'access_denied',
          error_description: 'User declined',
          secretId: 'secret_1',
        },
      },
      '*'
    )

    expect(close).not.toHaveBeenCalled()

    expect(screen.queryByText('Success')).toBeNull()
  })

  it('should not fail without an opener', () => {
    delete window.opener

    expect(() => render(<Page secretId="secret_1" />)).not.toThrow()

    expect(close).toHaveBeenCalledTimes(1)
  })
})
