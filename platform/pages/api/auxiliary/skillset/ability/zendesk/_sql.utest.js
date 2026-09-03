/* eslint-disable @typescript-eslint/no-require-imports */
import handler from '@/pages/api/auxiliary/skillset/ability/zendesk/sql'

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

describe('Zendesk SQL Handler', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SELECT statements', () => {
    it('should serialize SELECT * to tickets list API', async () => {
      // @note first call fetches ticket fields for column validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket_fields: [
              { id: 1, title: 'Subject', type: 'text' },
              { id: 2, title: 'Status', type: 'text' },
            ],
          }),
      })

      // @note second call fetches tickets
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tickets: [
              {
                id: 123,
                subject: 'Test ticket',
                status: 'open',
                custom_fields: [],
              },
            ],
          }),
      })

      await handler(
        { sql: 'SELECT * FROM zendesk.ticket', domain: 'testcompany' },
        mockHeaders
      )

      expect(mockCall).toHaveBeenCalledWith(
        'https://testcompany.zendesk.com/api/v2/tickets.json',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      )
    })

    it('should serialize SELECT with WHERE id to single ticket API', async () => {
      // @note first call fetches ticket fields
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket_fields: [{ id: 1, title: 'Subject', type: 'text' }],
          }),
      })

      // @note second call fetches single ticket by ID
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket: { id: 456, subject: 'Specific ticket', status: 'pending' },
          }),
      })

      await handler(
        {
          sql: "SELECT * FROM zendesk.ticket WHERE id = '456'",
          domain: 'testcompany',
        },
        mockHeaders
      )

      expect(mockCall).toHaveBeenCalledWith(
        'https://testcompany.zendesk.com/api/v2/tickets/456.json',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      )
    })

    it('should use correct domain in API URL', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket_fields: [],
          }),
      })

      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tickets: [] }),
      })

      await handler(
        { sql: 'SELECT * FROM zendesk.ticket', domain: 'mycompany' },
        mockHeaders
      )

      expect(mockCall).toHaveBeenCalledWith(
        'https://mycompany.zendesk.com/api/v2/tickets.json',
        expect.any(Object)
      )
    })
  })

  describe('INSERT statements', () => {
    it('should serialize INSERT to tickets POST API', async () => {
      // @note doInsert calls POST API directly without fetching fields
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ticket: { id: 789 } }),
      })

      await handler(
        {
          sql: "INSERT INTO zendesk.ticket (subject, description) VALUES ('New issue', 'Details here')",
          domain: 'testcompany',
        },
        mockHeaders
      )

      const createCall = mockCall.mock.calls[0]

      expect(createCall[0]).toBe(
        'https://testcompany.zendesk.com/api/v2/tickets.json'
      )
      expect(createCall[1].method).toBe('POST')

      const body = JSON.parse(createCall[1].body)

      expect(body.ticket).toEqual({
        subject: 'New issue',
        description: 'Details here',
      })
    })
  })

  describe('UPDATE statements', () => {
    it('should serialize UPDATE to tickets PUT API', async () => {
      // @note first call fetches ticket fields
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket_fields: [{ id: 1, title: 'Status', type: 'text' }],
          }),
      })

      // @note second call is SELECT to find rows
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket: { id: 123, status: 'open' },
          }),
      })

      // @note third call is PUT to update
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await handler(
        {
          sql: "UPDATE zendesk.ticket SET status = 'solved' WHERE id = '123'",
          domain: 'testcompany',
        },
        mockHeaders
      )

      const updateCall = mockCall.mock.calls[2]

      expect(updateCall[0]).toBe(
        'https://testcompany.zendesk.com/api/v2/tickets/123.json'
      )
      expect(updateCall[1].method).toBe('PUT')

      const body = JSON.parse(updateCall[1].body)

      expect(body.ticket).toEqual({ status: 'solved' })
    })
  })

  describe('DELETE statements', () => {
    it('should serialize DELETE to tickets DELETE API', async () => {
      // @note first call fetches ticket fields
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket_fields: [],
          }),
      })

      // @note second call is SELECT to find rows
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket: { id: 999 },
          }),
      })

      // @note third call is DELETE
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await handler(
        {
          sql: "DELETE FROM zendesk.ticket WHERE id = '999'",
          domain: 'testcompany',
        },
        mockHeaders
      )

      const deleteCall = mockCall.mock.calls[2]

      expect(deleteCall[0]).toBe(
        'https://testcompany.zendesk.com/api/v2/tickets/999.json'
      )
      expect(deleteCall[1].method).toBe('DELETE')
    })
  })

  describe('DESCRIBE statements', () => {
    it('should serialize DESCRIBE to ticket_fields API', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ticket_fields: [
              { id: 1, title: 'Subject', type: 'text' },
              { id: 2, title: 'Priority', type: 'text' },
            ],
          }),
      })

      const result = await handler(
        { sql: 'DESCRIBE zendesk.ticket', domain: 'testcompany' },
        mockHeaders
      )

      expect(mockCall).toHaveBeenCalledWith(
        'https://testcompany.zendesk.com/api/v2/ticket_fields.json',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'subject', type: 'string' }),
          expect.objectContaining({ name: 'priority', type: 'string' }),
        ])
      )
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const emptyHeaders = new Headers()

      await expect(
        handler(
          { sql: 'SELECT * FROM zendesk.ticket', domain: 'test' },
          emptyHeaders
        )
      ).rejects.toThrow('Not authenticated')
    })
  })
})
