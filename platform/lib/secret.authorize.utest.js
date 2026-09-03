/**
 * @jest-environment node
 */
import { getSecretManager } from '@/lib/secret.manager'

import {
  authorizationRequiredResponse,
  getSecretAuthorizationUrl,
  jsonResponse,
} from './secret.authorize'

jest.mock('@/lib/scope.server', () => ({}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: () => ({ log: () => {} }),
}))

jest.mock('@/lib/secret.manager', () => ({
  __esModule: true,
  getSecretManager: jest.fn(),
}))

const secret = { id: 'secret-1', userId: 'user-1' }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('jsonResponse', () => {
  it('builds a JSON Response with the given status', async () => {
    const res = jsonResponse(409, { error: 'nope' })

    expect(res.status).toBe(409)
    expect(res.headers.get('content-type')).toBe('application/json')
    await expect(res.json()).resolves.toEqual({ error: 'nope' })
  })
})

describe('getSecretAuthorizationUrl', () => {
  it('returns the authorize url from the secret manager', async () => {
    const getAuthUrl = jest
      .fn()
      .mockResolvedValue(new URL('https://chatbotkit.com/secrets/s1/authenticate'))

    getSecretManager.mockReturnValue({ getAuthUrl })

    const url = await getSecretAuthorizationUrl(secret, { contact: null })

    expect(url).toBe('https://chatbotkit.com/secrets/s1/authenticate')
    expect(getAuthUrl).toHaveBeenCalledWith(secret, { raw: true })
  })

  it('passes contact and namespace through to getSecretManager', async () => {
    const contact = { id: 'contact-1' }

    getSecretManager.mockReturnValue({
      getAuthUrl: jest.fn().mockResolvedValue(new URL('https://x.test/auth')),
    })

    await getSecretAuthorizationUrl(secret, { contact, namespace: 'ns-1' })

    expect(getSecretManager).toHaveBeenCalledWith(secret, {
      contact,
      namespace: 'ns-1',
    })
  })

  it('returns null when there is no secret manager', async () => {
    getSecretManager.mockReturnValue(null)

    await expect(getSecretAuthorizationUrl(secret)).resolves.toBeNull()
  })

  it('returns null when the manager cannot produce an auth url', async () => {
    getSecretManager.mockReturnValue({ getValue: jest.fn() }) // no getAuthUrl

    await expect(getSecretAuthorizationUrl(secret)).resolves.toBeNull()
  })

  it('returns null (does not throw) when getAuthUrl fails', async () => {
    getSecretManager.mockReturnValue({
      getAuthUrl: jest.fn().mockRejectedValue(new Error('boom')),
    })

    await expect(getSecretAuthorizationUrl(secret)).resolves.toBeNull()
  })
})

describe('authorizationRequiredResponse', () => {
  it('returns 409 with the message and url when resolvable', async () => {
    getSecretManager.mockReturnValue({
      getAuthUrl: jest
        .fn()
        .mockResolvedValue(new URL('https://chatbotkit.com/auth')),
    })

    const res = await authorizationRequiredResponse(secret, {}, 'please auth')

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: 'authorization_required',
      message: 'please auth',
      url: 'https://chatbotkit.com/auth',
    })
  })

  it('omits the url when it cannot be resolved', async () => {
    getSecretManager.mockReturnValue(null)

    const res = await authorizationRequiredResponse(secret, {}, 'no contact')

    expect(res.status).toBe(409)

    const body = await res.json()

    expect(body).toEqual({
      error: 'authorization_required',
      message: 'no contact',
    })
    expect(body.url).toBeUndefined()
  })
})
