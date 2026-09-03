/* eslint-disable @typescript-eslint/no-require-imports */
import handler from '@/pages/api/auxiliary/skillset/ability/instantly/sql'

jest.mock('@/lib/auxiliary.sql', () => {
  return jest.fn((schema, tables, getDriver) => {
    // @note return a function that creates the driver and calls its methods
    return async function mockHandler(parameters, headers) {
      const { parseSingle } = require('@chatbotkit-dev/sql/parse')

      const parsedSQL = parseSingle(parameters.sql)

      const driver = await getDriver(parsedSQL.table, parameters, headers)

      switch (parsedSQL.type) {
        case 'show':
          return {
            sql: parameters.sql,
            result: tables.map((t) => ({
              DATABASE_NAME: t.database,
              TABLE_NAME: t.name,
              FULL_NAME: `${t.database}.${t.name}`,
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
  })
})

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

describe('Instantly SQL Handler', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Campaigns table', () => {
    describe('SELECT statements', () => {
      it('should serialize SELECT * to campaigns list API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: 'camp-1', name: 'Campaign 1', status: 1 }],
            }),
        })

        await handler({ sql: 'SELECT * FROM instantly.campaigns' }, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://api.instantly.ai/api/v2/campaigns',
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        )
      })

      it('should serialize SELECT with WHERE id to single campaign API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'camp-123',
              name: 'My Campaign',
              status: 1,
            }),
        })

        await handler(
          {
            sql: "SELECT * FROM instantly.campaigns WHERE id = 'camp-123'",
          },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          'https://api.instantly.ai/api/v2/campaigns/camp-123',
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        )
      })
    })

    describe('INSERT statements', () => {
      it('should serialize INSERT to campaigns POST API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'new-camp-1' }),
        })

        await handler(
          {
            sql: "INSERT INTO instantly.campaigns (name, daily_limit) VALUES ('New Campaign', 100)",
          },
          mockHeaders
        )

        const callArgs = mockCall.mock.calls[0]

        expect(callArgs[0]).toBe('https://api.instantly.ai/api/v2/campaigns')
        expect(callArgs[1].method).toBe('POST')

        const body = JSON.parse(callArgs[1].body)

        // @note SQL parsing returns all values as strings
        expect(body).toEqual({
          name: 'New Campaign',
          daily_limit: '100',
        })
      })
    })

    describe('UPDATE statements', () => {
      it('should serialize UPDATE to campaigns PATCH API', async () => {
        // @note first call is SELECT to find rows
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'camp-1',
              name: 'Old Name',
            }),
        })

        // @note second call is PATCH
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })

        await handler(
          {
            sql: "UPDATE instantly.campaigns SET name = 'New Name' WHERE id = 'camp-1'",
          },
          mockHeaders
        )

        const patchCall = mockCall.mock.calls[1]

        expect(patchCall[0]).toBe(
          'https://api.instantly.ai/api/v2/campaigns/camp-1'
        )
        expect(patchCall[1].method).toBe('PATCH')

        const body = JSON.parse(patchCall[1].body)

        expect(body).toEqual({ name: 'New Name' })
      })
    })

    describe('DELETE statements', () => {
      it('should serialize DELETE to campaigns DELETE API', async () => {
        // @note first call is SELECT to find rows
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'camp-del' }),
        })

        // @note second call is DELETE
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })

        await handler(
          {
            sql: "DELETE FROM instantly.campaigns WHERE id = 'camp-del'",
          },
          mockHeaders
        )

        const deleteCall = mockCall.mock.calls[1]

        expect(deleteCall[0]).toBe(
          'https://api.instantly.ai/api/v2/campaigns/camp-del'
        )
        expect(deleteCall[1].method).toBe('DELETE')
      })
    })
  })

  describe('Leads table', () => {
    describe('SELECT statements', () => {
      it('should serialize SELECT * to leads list API with POST', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                { id: 'lead-1', email: 'test@example.com', status: 'active' },
              ],
            }),
        })

        await handler({ sql: 'SELECT * FROM instantly.leads' }, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://api.instantly.ai/api/v2/leads/list',
          expect.objectContaining({
            method: 'POST',
            headers: {
              Authorization: 'Bearer test-token',
              'Content-Type': 'application/json',
            },
          })
        )
      })

      it('should serialize SELECT with WHERE id to single lead API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'lead-123',
              email: 'specific@example.com',
            }),
        })

        await handler(
          { sql: "SELECT * FROM instantly.leads WHERE id = 'lead-123'" },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          'https://api.instantly.ai/api/v2/leads/lead-123',
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        )
      })

      it('should pass campaign filter in leads list request', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        })

        await handler(
          {
            sql: "SELECT * FROM instantly.leads WHERE campaign = 'camp-abc'",
          },
          mockHeaders
        )

        const callArgs = mockCall.mock.calls[0]
        const body = JSON.parse(callArgs[1].body)

        expect(body.campaign).toBe('camp-abc')
      })
    })

    describe('INSERT statements', () => {
      it('should serialize INSERT to leads POST API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'new-lead-1' }),
        })

        await handler(
          {
            sql: "INSERT INTO instantly.leads (email, first_name, last_name) VALUES ('john@example.com', 'John', 'Doe')",
          },
          mockHeaders
        )

        const callArgs = mockCall.mock.calls[0]

        expect(callArgs[0]).toBe('https://api.instantly.ai/api/v2/leads')
        expect(callArgs[1].method).toBe('POST')

        const body = JSON.parse(callArgs[1].body)

        expect(body).toEqual({
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Doe',
        })
      })
    })
  })

  describe('Emails table', () => {
    describe('SELECT statements', () => {
      it('should serialize SELECT * to emails list API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: 'email-1', email: 'sender@example.com' }],
            }),
        })

        await handler({ sql: 'SELECT * FROM instantly.emails' }, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          'https://api.instantly.ai/api/v2/emails',
          expect.objectContaining({
            method: 'POST',
          })
        )
      })

      it('should serialize SELECT with WHERE id to single email API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'email-123',
              email: 'specific@example.com',
            }),
        })

        await handler(
          { sql: "SELECT * FROM instantly.emails WHERE id = 'email-123'" },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          'https://api.instantly.ai/api/v2/emails/email-123',
          expect.any(Object)
        )
      })
    })
  })

  describe('DESCRIBE statements', () => {
    it('should return static column definitions for campaigns', async () => {
      const result = await handler(
        { sql: 'DESCRIBE instantly.campaigns' },
        mockHeaders
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'string' }),
          expect.objectContaining({ name: 'name', type: 'string' }),
          expect.objectContaining({ name: 'status', type: 'number' }),
          expect.objectContaining({ name: 'daily_limit', type: 'number' }),
        ])
      )
    })

    it('should return static column definitions for leads', async () => {
      const result = await handler(
        { sql: 'DESCRIBE instantly.leads' },
        mockHeaders
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'string' }),
          expect.objectContaining({ name: 'email', type: 'string' }),
          expect.objectContaining({ name: 'first_name', type: 'string' }),
          expect.objectContaining({ name: 'last_name', type: 'string' }),
          expect.objectContaining({ name: 'campaign', type: 'string' }),
        ])
      )
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const emptyHeaders = new Headers()

      await expect(
        handler({ sql: 'SELECT * FROM instantly.campaigns' }, emptyHeaders)
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('Error handling', () => {
    it('should throw error for unsupported table', async () => {
      await expect(
        handler({ sql: 'SELECT * FROM instantly.unknown' }, mockHeaders)
      ).rejects.toThrow()
    })
  })
})
