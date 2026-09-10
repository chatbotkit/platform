import { getInstallDetails } from './index'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://build.example${path}`),
}))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))

describe('recall getInstallDetails', () => {
  it('builds the webhook with the runtime builder the page passes', () => {
    const getAPIURL = jest.fn(
      (path) => `http://cbk-api.localhost:3000${path}`
    )

    const { endpoints } = getInstallDetails({
      integration: { id: 'recall_1' },
      getAPIURL,
    })

    // @note the build-time builder knows nothing of the request host
    expect(endpoints[0].url).toBe(
      'http://cbk-api.localhost:3000/v1/integration/recall/recall_1/webhook'
    )
  })

  it('serves requestless callers from the build-time builder', () => {
    const { endpoints } = getInstallDetails({ integration: { id: 'recall_1' } })

    expect(endpoints[0].url).toBe(
      'https://build.example/v1/integration/recall/recall_1/webhook'
    )
  })
})
