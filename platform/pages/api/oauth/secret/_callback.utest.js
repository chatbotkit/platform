/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './callback'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: jest.fn((path) => `https://app.example.com${path}`),
}))

jest.mock('@/lib/response', () => ({
  redirect: jest.fn((url) => ({ status: 302, location: url.toString() })),
}))

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('GET /api/oauth/secret/callback', () => {
  const getGetExternalHostURL = () => require('@/lib/host').getExternalHostURL
  const getRedirect = () => require('@/lib/response').redirect

  beforeEach(() => {
    jest.clearAllMocks()
    getGetExternalHostURL().mockImplementation(
      (path) => `https://app.example.com${path}`
    )
    getRedirect().mockImplementation((url) => ({
      status: 302,
      location: url.toString(),
    }))
  })

  it('should redirect to the frontend secrets oauth callback page', async () => {
    const req = {
      url: 'https://platform.example.com/api/oauth/secret/callback',
    }

    await handler(req)

    expect(getRedirect()).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://app.example.com/secrets/oauth/callback',
      })
    )
  })

  it('should forward query params from the incoming request to the redirect URL', async () => {
    const req = {
      url: 'https://platform.example.com/api/oauth/secret/callback?code=auth_code_123&state=xyz',
    }

    await handler(req)

    expect(getGetExternalHostURL()).toHaveBeenCalledWith(
      '/secrets/oauth/callback?code=auth_code_123&state=xyz'
    )
  })

  it('should pass the full external URL with query params to redirect', async () => {
    const req = {
      url: 'https://platform.example.com/api/oauth/secret/callback?code=abc&state=def&scope=read',
    }

    getGetExternalHostURL().mockReturnValue(
      'https://app.example.com/secrets/oauth/callback?code=abc&state=def&scope=read'
    )

    await handler(req)

    expect(getRedirect()).toHaveBeenCalledWith(
      new URL(
        'https://app.example.com/secrets/oauth/callback?code=abc&state=def&scope=read'
      )
    )
  })

  it('should work with no query params', async () => {
    const req = {
      url: 'https://platform.example.com/api/oauth/secret/callback',
    }

    await handler(req)

    expect(getGetExternalHostURL()).toHaveBeenCalledWith(
      '/secrets/oauth/callback'
    )
  })

  it('should return the redirect response', async () => {
    const req = {
      url: 'https://platform.example.com/api/oauth/secret/callback?code=token',
    }

    const result = await handler(req)

    expect(result).toEqual(
      expect.objectContaining({
        status: 302,
      })
    )
  })

  it('should call getExternalHostURL to resolve the final redirect destination', async () => {
    const req = {
      url: '/api/oauth/secret/callback?provider=google&code=googlecode',
    }

    await handler(req)

    expect(getGetExternalHostURL()).toHaveBeenCalledWith(
      '/secrets/oauth/callback?provider=google&code=googlecode'
    )
  })
})
