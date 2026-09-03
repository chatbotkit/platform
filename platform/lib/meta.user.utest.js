const mockFetchPlusPlus = jest.fn()

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  fetchPlusPlus: mockFetchPlusPlus,
}))

describe('meta.user', () => {
  const accessToken = 'access-token-xyz'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // @note reset modules so the in-memory cache starts empty per test
    jest.resetModules()
  })

  describe('getMetaUserInfo', () => {
    it('fetches and returns the parsed Graph response', async () => {
      const { getMetaUserInfo } = await import('@/lib/meta.user')

      mockFetchPlusPlus.mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Jane Doe', username: 'janedoe' }),
      })

      const result = await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'name,username',
      })

      expect(result).toEqual({ name: 'Jane Doe', username: 'janedoe' })

      const calledWith = mockFetchPlusPlus.mock.calls[0][0]

      expect(calledWith).toContain('https://graph.facebook.com/v21.0/psid-1')
      expect(calledWith).toContain('fields=name%2Cusername')
      expect(calledWith).toContain('access_token=access-token-xyz')
    })

    it('caches results so repeat lookups hit the API once', async () => {
      const { getMetaUserInfo } = await import('@/lib/meta.user')

      mockFetchPlusPlus.mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'Jane Doe' }),
      })

      const first = await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'name,username',
      })
      const second = await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'name,username',
      })

      expect(first).toEqual(second)
      expect(mockFetchPlusPlus).toHaveBeenCalledTimes(1)
    })

    it('keys the cache by user id and field set', async () => {
      const { getMetaUserInfo } = await import('@/lib/meta.user')

      mockFetchPlusPlus.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      await getMetaUserInfo('psid-1', { accessToken, fields: 'name,username' })
      await getMetaUserInfo('psid-2', { accessToken, fields: 'name,username' })
      await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'first_name,last_name',
      })

      expect(mockFetchPlusPlus).toHaveBeenCalledTimes(3)
    })

    it('returns null and does not cache failures', async () => {
      const { getMetaUserInfo } = await import('@/lib/meta.user')

      mockFetchPlusPlus.mockResolvedValueOnce({ ok: false, status: 400 })

      const failed = await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'name,username',
      })

      expect(failed).toBeNull()

      // @note a later turn should retry rather than serve a cached failure
      mockFetchPlusPlus.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Jane Doe' }),
      })

      const recovered = await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'name,username',
      })

      expect(recovered).toEqual({ name: 'Jane Doe' })
      expect(mockFetchPlusPlus).toHaveBeenCalledTimes(2)
    })

    it('honours a custom api version', async () => {
      const { getMetaUserInfo } = await import('@/lib/meta.user')

      mockFetchPlusPlus.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      await getMetaUserInfo('psid-1', {
        accessToken,
        fields: 'name',
        version: 'v19.0',
      })

      expect(mockFetchPlusPlus.mock.calls[0][0]).toContain(
        'https://graph.facebook.com/v19.0/psid-1'
      )
    })
  })
})
