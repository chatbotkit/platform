/* eslint-disable @typescript-eslint/no-require-imports */
import handler from '@/pages/api/auxiliary/skillset/ability/gohighlevel/sql'

jest.mock('@/lib/auxiliary.sql', () => ({
  makeHandler2: jest.fn((schema, tables) => {
    // @note return a function that creates the driver and calls its methods
    return async function mockHandler(parameters, headers) {
      const { parseSingle, getTableName } = require('@chatbotkit-dev/sql/parse')
      const pluralize = require('pluralize')

      const parsedSQL = parseSingle(parameters.sql)
      const tableName = getTableName(parsedSQL.table)

      const table = tables.find(
        (t) => pluralize(tableName, 1) === pluralize(t.name, 1)
      )

      if (!table) {
        throw new Error(`Unknown table ${tableName}`)
      }

      const driver = await table.getDriver(parameters, headers)

      switch (parsedSQL.type) {
        case 'show':
          return {
            sql: parameters.sql,
            result: tables.map((t) => ({
              DATABASE_NAME: t.database,
              TABLE_NAME: t.name,
              FULL_NAME: t.database ? `${t.database}.${t.name}` : t.name,
            })),
          }

        case 'describe':
          return {
            sql: parameters.sql,
            result: await driver.describeColumns(),
          }

        case 'select':
          return {
            sql: parameters.sql,
            result: await driver.doSelect(parsedSQL.columns, parsedSQL.where),
          }

        case 'insert':
          return {
            sql: parameters.sql,
            result: await driver.doInsert(parsedSQL.parameters),
          }

        case 'update': {
          const rows = await driver.doSelect(['id'], parsedSQL.where)

          for (const row of rows) {
            await driver.doUpdate(row, parsedSQL.parameters)
          }

          return { sql: parameters.sql, result: { updated: rows.length } }
        }

        case 'delete': {
          const rows = await driver.doSelect(['id'], parsedSQL.where)

          for (const row of rows) {
            await driver.doDelete(row)
          }

          return { sql: parameters.sql, result: { deleted: rows.length } }
        }
      }
    }
  }),
}))

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

const mockCall = require('@/lib/call').default

describe('GoHighLevel SQL Handler', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SELECT statements', () => {
    it('should serialize SELECT * to contacts list API', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            contacts: [
              { id: 'contact-1', email: 'test@example.com' },
              { id: 'contact-2', email: 'other@example.com' },
            ],
          }),
      })

      await handler({ sql: 'SELECT * FROM contact' }, mockHeaders)

      expect(mockCall).toHaveBeenCalledWith(
        'https://services.leadconnectorhq.com/contacts/',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token',
            Version: '2021-07-28',
          },
        })
      )
    })

    it('should serialize SELECT with WHERE id to single contact API', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'contact-123',
            email: 'specific@example.com',
          }),
      })

      await handler(
        { sql: "SELECT * FROM contact WHERE id = 'contact-123'" },
        mockHeaders
      )

      expect(mockCall).toHaveBeenCalledWith(
        'https://services.leadconnectorhq.com/contacts/contact-123',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token',
            Version: '2021-07-28',
          },
        })
      )
    })

    it('should include Version header in all requests', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ contacts: [] }),
      })

      await handler({ sql: 'SELECT * FROM contact' }, mockHeaders)

      const callArgs = mockCall.mock.calls[0]

      expect(callArgs[1].headers.Version).toBe('2021-07-28')
    })
  })

  describe('DESCRIBE statements', () => {
    it('should return static column definitions for contacts', async () => {
      const result = await handler({ sql: 'DESCRIBE contact' }, mockHeaders)

      expect(result.result).toEqual([
        { type: 'string', name: 'id' },
        { type: 'string', name: 'email' },
      ])
    })
  })

  describe('INSERT statements', () => {
    it('should throw not implemented error', async () => {
      await expect(
        handler(
          { sql: "INSERT INTO contact (email) VALUES ('test@example.com')" },
          mockHeaders
        )
      ).rejects.toThrow('Not implemented')
    })
  })

  describe('UPDATE statements', () => {
    it('should throw not implemented error', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'contact-1',
            email: 'test@example.com',
          }),
      })

      await expect(
        handler(
          {
            sql: "UPDATE contact SET email = 'new@example.com' WHERE id = 'contact-1'",
          },
          mockHeaders
        )
      ).rejects.toThrow('Not implemented')
    })
  })

  describe('DELETE statements', () => {
    it('should throw not implemented error', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'contact-1',
            email: 'test@example.com',
          }),
      })

      await expect(
        handler(
          { sql: "DELETE FROM contact WHERE id = 'contact-1'" },
          mockHeaders
        )
      ).rejects.toThrow('Not implemented')
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const emptyHeaders = new Headers()

      await expect(
        handler({ sql: 'SELECT * FROM contact' }, emptyHeaders)
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('Error handling', () => {
    it('should throw error for unsupported table', async () => {
      await expect(
        handler({ sql: 'SELECT * FROM unknown_table' }, mockHeaders)
      ).rejects.toThrow('Unknown table')
    })
  })
})
