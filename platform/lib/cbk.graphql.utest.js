/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: () => undefined,
  getContextRequestIpAddress: () => undefined,
  getContextTimezone: () => undefined,
}))

jest.mock('@/lib/header.assertion', () => ({
  getInternalAssertionHeaders: () => ({}),
}))

jest.mock('@/lib/host', () => ({
  getLocalAPIHostURL: (path) => `https://example.com${path}`,
}))

jest.mock('@/lib/session.temp', () => ({
  getTemporaryUserToken: jest.fn(),
  getTemporaryUserSessionToken: jest.fn(),
}))

jest.mock('@/graphql/v1/client', () => ({
  createClient: jest.fn(),
}))

const { getPlatformGraphQLClient } = require('./cbk.graphql')
const { getTemporaryUserToken } = require('@/lib/session.temp')
const { createClient } = require('@/graphql/v1/client')

describe('getPlatformGraphQLClient', () => {
  it('creates a client for the platform identity', async () => {
    const client = { request: jest.fn() }

    getTemporaryUserToken.mockResolvedValue('temporary-token')
    createClient.mockReturnValue(client)

    await expect(getPlatformGraphQLClient()).resolves.toBe(client)

    expect(getTemporaryUserToken).toHaveBeenCalledWith('_platform')
    expect(createClient).toHaveBeenCalledWith({
      secret: 'temporary-token',
      endpoint: 'https://example.com/api/v1/graphql',
      headers: {},
    })
  })
})
