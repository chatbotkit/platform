import provider, { assertConfigured, search } from './index'

// @note the community engine has no behaviour to test beyond the shape of the
// contract it satisfies. That is worth a test anyway: the empty result set is
// load bearing - callers rely on it being an array they can map over - and it
// is exactly the kind of thing a future "real" default would quietly change.

describe('community search engine', () => {
  it('finds nothing', async () => {
    await expect(search('anything')).resolves.toEqual([])
  })

  it('finds nothing for every result type', async () => {
    for (const type of ['web', 'news', 'images', 'videos']) {
      await expect(search('anything', { type })).resolves.toEqual([])
    }
  })

  it('needs no configuration', async () => {
    await expect(assertConfigured()).resolves.toBeUndefined()
  })

  it('exposes the provider as the default export', () => {
    expect(provider.search).toBe(search)
    expect(provider.assertConfigured).toBe(assertConfigured)
  })
})
