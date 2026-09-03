/* eslint-disable @typescript-eslint/no-require-imports */
import {
  addIssueLabels,
  assertAppCredentials,
  getAppSlug,
  getInstallationTokenForOwner,
  getInstallationTokenForRepo,
  githubRequest,
  mintInstallationToken,
} from './github.app'

jest.mock('@/lib/cache', () => ({
  ttlCache: jest.fn(async (_key, _ttl, fn) => await fn()),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  FetchError: class MockFetchError extends Error {
    constructor(message, code, meta) {
      super(message)
      this.name = 'FetchError'
      this.code = code
      this.meta = meta
    }
  },
}))

jest.mock('@/lib/response', () => ({
  statusToCodeMap: {
    401: 'NOT_AUTHORIZED',
    404: 'NOT_FOUND',
    500: 'INTERNAL_SERVER_ERROR',
  },
}))

jest.mock('crypto', () => ({
  createSign: jest.fn(() => ({
    update: jest.fn(),
    end: jest.fn(),
    sign: jest.fn(() => Buffer.from('signed-by-test')),
  })),
}))

describe('github.app', () => {
  const mockFetch = require('@/lib/fetch').default
  const { ttlCache } = require('@/lib/cache')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('githubRequest', () => {
    it('sends expected headers and JSON body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true }),
      })

      const data = await githubRequest('/repos/acme/demo/issues', {
        method: 'POST',
        body: { title: 'Hello' },
        token: 'token-1',
      })

      expect(data).toEqual({ ok: true })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/acme/demo/issues',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Hello' }),
          headers: expect.objectContaining({
            authorization: 'Bearer token-1',
            accept: 'application/vnd.github+json',
            'x-github-api-version': '2022-11-28',
            'user-agent': 'chatbotkit',
            'content-type': 'application/json',
          }),
        })
      )
    })

    it('returns null on 204 no content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      })

      const data = await githubRequest('/repos/acme/demo/labels/1', {
        method: 'DELETE',
        token: 'token-1',
      })

      expect(data).toBeNull()
    })

    it('throws FetchError with method/path/status details on failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('not found'),
      })

      await expect(
        githubRequest('/repos/acme/missing', {
          token: 'token-1',
        })
      ).rejects.toMatchObject({
        name: 'FetchError',
        message: expect.stringContaining('GET /repos/acme/missing failed: 404'),
        code: 'NOT_FOUND',
        meta: { method: 'GET', path: '/repos/acme/missing', status: 404 },
      })
    })
  })

  describe('credentials assertion', () => {
    it('asserts required app credentials', () => {
      expect(assertAppCredentials({ appId: '123', privateKey: 'key' })).toEqual(
        {
          appId: '123',
          privateKey: 'key',
        }
      )
      expect(() =>
        assertAppCredentials({ appId: null, privateKey: 'key' })
      ).toThrowErrorMatchingInlineSnapshot(
        `"GitHub integration is missing its App id / private key"`
      )
    })
  })

  describe('token minting and lookup', () => {
    it('mints installation token and caches by app+installation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ token: 'inst-token' }),
      })

      const token = await mintInstallationToken({
        appId: '123',
        privateKey: 'PRIVATE_KEY',
        installationId: '456',
      })

      expect(token).toBe('inst-token')
      expect(ttlCache).toHaveBeenCalledWith(
        'github:installation-token:123:456',
        3000,
        expect.any(Function)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/456/access_tokens',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('gets installation token for repo via installation lookup', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 777 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ token: 'repo-token' }),
        })

      const token = await getInstallationTokenForRepo({
        appId: '123',
        privateKey: 'PRIVATE_KEY',
        owner: 'acme',
        repo: 'demo',
      })

      expect(token).toBe('repo-token')
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/acme/demo/installation',
        expect.any(Object)
      )
    })

    it('falls back from org installation to user installation', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue('missing org installation'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ id: 888 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ token: 'owner-token' }),
        })

      const token = await getInstallationTokenForOwner({
        appId: '123',
        privateKey: 'PRIVATE_KEY',
        owner: 'jane',
      })

      expect(token).toBe('owner-token')
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/orgs/jane/installation',
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/users/jane/installation',
        expect.any(Object)
      )
    })
  })

  describe('helpers', () => {
    it('reads app slug through ttl cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ slug: 'chatbotkit-app' }),
      })

      const slug = await getAppSlug({
        appId: '123',
        privateKey: 'PRIVATE_KEY',
      })

      expect(slug).toBe('chatbotkit-app')
      expect(ttlCache).toHaveBeenCalledWith(
        'github:app-slug:123',
        86400,
        expect.any(Function)
      )
    })

    it('posts issue labels via githubRequest wrapper', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true }),
      })

      await addIssueLabels({
        token: 'token-1',
        owner: 'acme',
        repo: 'demo',
        issueNumber: 42,
        labels: ['triaged', 'bug'],
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/acme/demo/issues/42/labels',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ labels: ['triaged', 'bug'] }),
        })
      )
    })
  })
})
