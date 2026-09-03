import { imageModels, languageModels } from '@/config/models'

import handler from './list'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor:
    (fn) =>
    async (req = {}) =>
      fn(req.query?.cursor || null, req),
}))

describe('/api/v1/platform/model/list', () => {
  it('returns empty items when cursor is provided', async () => {
    const response = await handler({ query: { cursor: 'next' } })

    expect(response).toEqual({ items: [] })
  })

  it('returns only visible models with mapped fields', async () => {
    const response = await handler({ query: {} })

    expect(Array.isArray(response.items)).toBe(true)
    expect(response.items.length).toBeGreaterThan(0)

    const visibleModelIds = Object.entries(languageModels)
      .filter(([, model]) => model.visible)
      .map(([id]) => id)

    expect(
      response.items.every((item) => visibleModelIds.includes(item.id))
    ).toBe(true)

    const firstVisible = languageModels[visibleModelIds[0]]
    const mapped = response.items.find((item) => item.id === visibleModelIds[0])

    expect(mapped).toMatchObject({
      id: visibleModelIds[0],
      type: 'language',
      description: firstVisible.description,
      provider: firstVisible.provider,
      family: firstVisible.family,
      maxTokens: firstVisible.maxTokens,
      maxInputTokens: firstVisible.maxInputTokens,
      maxOutputTokens: firstVisible.maxOutputTokens,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
  })

  it('returns the requested model type', async () => {
    const response = await handler({ query: { type: 'image' } })

    const visibleModelIds = Object.entries(imageModels)
      .filter(([, model]) => model.visible)
      .map(([id]) => id)

    expect(
      response.items.every(
        (item) => visibleModelIds.includes(item.id) && item.type === 'image'
      )
    ).toBe(true)
  })

  it('rejects an unknown model type', async () => {
    await expect(handler({ query: { type: 'nope' } })).rejects.toThrow()
  })
})
