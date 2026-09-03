/**
 * @jest-environment node
 */
import handler from './api-catalog'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://api.chatbotkit.com${path}`),
  getExternalFrontendHostURL: jest.fn(
    (path) => `https://chatbotkit.com${path}`
  ),
}))

describe('GET /.well-known/api-catalog', () => {
  it('returns a linkset that advertises the public API', async () => {
    const response = await handler({})
    const body = JSON.parse(await response.text())

    expect(response.headers.get('content-type')).toContain(
      'application/linkset+json'
    )

    expect(body).toEqual({
      linkset: [
        {
          anchor: 'https://api.chatbotkit.com/v1',
          'service-desc': [
            expect.objectContaining({
              href: 'https://api.chatbotkit.com/v1/spec',
            }),
          ],
          'service-doc': [
            expect.objectContaining({
              href: 'https://docs.cbk.ai/spec/v1',
            }),
          ],
          status: [
            expect.objectContaining({
              href: 'https://api.chatbotkit.com/v1/status/ping',
            }),
          ],
        },
      ],
    })
  })
})
