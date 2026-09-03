/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    capturedHandlerFn = (parameters, headers) =>
      fn({ user: { id: 'test-user-id' } }, parameters, headers)

    return jest.fn()
  }),
}))

jest.mock('@/lib/auxiliary.duckdb', () => ({
  introspectDatabase: jest.fn(async () => ({})),
  lockDownDuckDB: jest.fn(),
  runReadOnlyDuckDBQuery: jest.fn(async () => ({
    getRowObjectsJson: jest.fn(() => [{ value: 'safe' }]),
  })),
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(async () => ({})),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

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

require('@/pages/api/auxiliary/skillset/ability/chatbotkit/file/sql')

const {
  lockDownDuckDB,
  runReadOnlyDuckDBQuery,
} = require('@/lib/auxiliary.duckdb')

describe('auxiliary/skillset/ability/chatbotkit/file/sql', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('locks down DuckDB before executing caller SQL through the read-only runner', async () => {
    const result = await capturedHandlerFn(
      { sql: 'SELECT 1 AS value', tables: {} },
      new Headers()
    )

    expect(lockDownDuckDB).toHaveBeenCalledWith(mockConnection)
    expect(runReadOnlyDuckDBQuery).toHaveBeenCalledWith(
      mockConnection,
      'SELECT 1 AS value'
    )
    expect(mockConnection.runAndReadAll).not.toHaveBeenCalled()
    expect(result).toEqual({ rows: [{ value: 'safe' }] })
  })
})
