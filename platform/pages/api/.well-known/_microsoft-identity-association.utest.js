/**
 * @jest-environment node
 */
import handler from './microsoft-identity-association.json'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

describe('GET /.well-known/microsoft-identity-association.json', () => {
  const KEY = 'NEXTAUTH_AZURE_AD_CLIENT_ID'

  /** @type {string|undefined} */
  let saved

  beforeEach(() => {
    saved = process.env[KEY]
  })

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[KEY]
    } else {
      process.env[KEY] = saved
    }
  })

  it('serves the association for the configured application', async () => {
    process.env[KEY] = 'app-id-123'

    const response = await handler({})
    const body = JSON.parse(await response.text())

    expect(response.status).toBe(200)
    expect(body).toEqual({
      associatedApplications: [{ applicationId: 'app-id-123' }],
    })
  })

  it('serves nothing when Microsoft sign-in is not configured', async () => {
    delete process.env[KEY]

    const response = await handler({})

    expect(response.status).toBe(404)
  })
})
