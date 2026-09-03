/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    capturedHandlerFn = (parameters, headers) =>
      fn({ user: { id: 'test-user-id' } }, parameters, headers)

    return jest.fn()
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

jest.mock('@/lib/auxiliary.duckdb', () => ({
  introspectDatabase: jest.fn(async () => ({})),
  lockDownDuckDB: jest.fn(),
  runReadOnlyDuckDBQuery: jest.fn(async () => ({
    getRowObjectsJson: jest.fn(() => [{ value: 'safe' }]),
  })),
}))

// @note the cache is bypassed so that every table goes through the loader,
// which is where the URL is fetched
jest.mock('@/lib/fs.cache', () => ({
  ttlFileLocation: jest.fn(async ({ loader }) => {
    const { meta } = await loader()

    return { location: '/tmp/unused', meta }
  }),
}))

const mockConnection = {
  run: jest.fn(),
  runAndReadAll: jest.fn(),
}

jest.mock('@duckdb/node-api', () => ({
  DuckDBInstance: {
    create: jest.fn(async () => ({
      connect: jest.fn(async () => mockConnection),
    })),
  },
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/url/sql')

const fetch = require('@/lib/egress.fetch')
const {
  lockDownDuckDB,
  runReadOnlyDuckDBQuery,
} = require('@/lib/auxiliary.duckdb')

describe('auxiliary/skillset/ability/chatbotkit/url/sql', () => {
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should export a handler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  it('locks down DuckDB before executing caller SQL through the read-only runner', async () => {
    const result = await capturedHandlerFn(
      { sql: 'SELECT 1 AS value', tables: {} },
      mockHeaders
    )

    expect(lockDownDuckDB).toHaveBeenCalledWith(mockConnection)
    expect(runReadOnlyDuckDBQuery).toHaveBeenCalledWith(
      mockConnection,
      'SELECT 1 AS value'
    )
    expect(mockConnection.runAndReadAll).not.toHaveBeenCalled()
    expect(result).toEqual({ rows: [{ value: 'safe' }] })
  })

  describe('egress boundary', () => {
    it('refuses a private-IP literal table URL before any connection is attempted', async () => {
      let captured

      fetch.mockImplementation((...args) =>
        jest
          .requireActual('@/lib/egress.fetch')
          .default(...args)
          .catch((e) => {
            captured = e

            throw e
          })
      )

      const result = await capturedHandlerFn(
        {
          sql: 'SELECT * FROM t',
          tables: { t: { url: 'http://127.0.0.1/data.csv' } },
        },
        mockHeaders
      )

      expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/data.csv')
      expect(String(captured?.cause?.message)).toMatch(
        /egress to 127\.0\.0\.1 is not allowed: not a public address/
      )
      expect(result).toMatchObject({
        error: expect.objectContaining({ message: expect.any(String) }),
      })
      expect(mockConnection.run).not.toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE')
      )
    })
  })
})
