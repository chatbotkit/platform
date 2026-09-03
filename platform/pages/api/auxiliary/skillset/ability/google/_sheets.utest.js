/* eslint-disable @typescript-eslint/no-require-imports */
import handlers, {
  SHEET_CREATE_HANDLER_NAME,
  SHEET_DELETE_HANDLER_NAME,
  SPREADSHEET_CREATE_HANDLER_NAME,
  SPREADSHEET_FETCH_HANDLER_NAME,
  VALUES_APPEND_HANDLER_NAME,
  VALUES_CLEAR_HANDLER_NAME,
  VALUES_READ_HANDLER_NAME,
  VALUES_UPDATE_HANDLER_NAME,
  sheetCreateSchema,
  sheetDeleteSchema,
  spreadsheetCreateSchema,
  spreadsheetFetchSchema,
  valuesAppendSchema,
  valuesClearSchema,
  valuesReadSchema,
  valuesUpdateSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/sheets'

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlersMap) => {
    // @note return an object with the handler functions for direct testing
    const result = {}

    for (const [name, handler] of Object.entries(handlersMap)) {
      // @note every auxiliary route is authenticated; bind a mock session so
      // the tests keep calling the inner function as (parameters, headers)
      result[name] = (parameters, headers) =>
        handler.fn({ user: { id: 'test-user-id' } }, parameters, headers)
    }

    return result
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

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

describe('Google Sheets Handlers', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()

    mockCall.mockReset()
  })

  describe('Handler Names', () => {
    it('should export correct handler names', () => {
      expect(SPREADSHEET_CREATE_HANDLER_NAME).toBe('spreadsheet/create')
      expect(SPREADSHEET_FETCH_HANDLER_NAME).toBe('spreadsheet/fetch')
      expect(VALUES_READ_HANDLER_NAME).toBe('values/read')
      expect(VALUES_UPDATE_HANDLER_NAME).toBe('values/update')
      expect(VALUES_APPEND_HANDLER_NAME).toBe('values/append')
      expect(VALUES_CLEAR_HANDLER_NAME).toBe('values/clear')
      expect(SHEET_CREATE_HANDLER_NAME).toBe('sheet/create')
      expect(SHEET_DELETE_HANDLER_NAME).toBe('sheet/delete')
    })

    it('should register all handlers', () => {
      expect(handlers).toHaveProperty(SPREADSHEET_CREATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(SPREADSHEET_FETCH_HANDLER_NAME)
      expect(handlers).toHaveProperty(VALUES_READ_HANDLER_NAME)
      expect(handlers).toHaveProperty(VALUES_UPDATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(VALUES_APPEND_HANDLER_NAME)
      expect(handlers).toHaveProperty(VALUES_CLEAR_HANDLER_NAME)
      expect(handlers).toHaveProperty(SHEET_CREATE_HANDLER_NAME)
      expect(handlers).toHaveProperty(SHEET_DELETE_HANDLER_NAME)
    })
  })

  describe('Schemas', () => {
    describe('spreadsheetCreateSchema', () => {
      it('should accept valid create parameters', () => {
        const result = spreadsheetCreateSchema.safeParse({
          title: 'My Spreadsheet',
        })

        expect(result.success).toBe(true)
      })

      it('should accept optional sheetTitles', () => {
        const result = spreadsheetCreateSchema.safeParse({
          title: 'My Spreadsheet',
          sheetTitles: 'Sheet1, Sheet2, Sheet3',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing title', () => {
        const result = spreadsheetCreateSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('spreadsheetFetchSchema', () => {
      it('should accept valid fetch parameters', () => {
        const result = spreadsheetFetchSchema.safeParse({
          spreadsheetId: 'abc123',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing spreadsheetId', () => {
        const result = spreadsheetFetchSchema.safeParse({})

        expect(result.success).toBe(false)
      })
    })

    describe('valuesReadSchema', () => {
      it('should accept valid read parameters', () => {
        const result = valuesReadSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:D10',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing spreadsheetId', () => {
        const result = valuesReadSchema.safeParse({
          range: 'Sheet1!A1:D10',
        })

        expect(result.success).toBe(false)
      })

      it('should reject missing range', () => {
        const result = valuesReadSchema.safeParse({
          spreadsheetId: 'abc123',
        })

        expect(result.success).toBe(false)
      })
    })

    describe('valuesUpdateSchema', () => {
      it('should accept valid update parameters', () => {
        const result = valuesUpdateSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:B2',
          values: [
            ['Name', 'Age'],
            ['Alice', '30'],
          ],
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing values', () => {
        const result = valuesUpdateSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:B2',
        })

        expect(result.success).toBe(false)
      })

      it('should reject non-array values', () => {
        const result = valuesUpdateSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:B2',
          values: 'not an array',
        })

        expect(result.success).toBe(false)
      })

      it('should accept stringified JSON array for values', () => {
        const result = valuesUpdateSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:B2',
          values: '[["Name","Age"],["Alice","30"]]',
        })

        expect(result.success).toBe(true)
        expect(result.data.values).toEqual([
          ['Name', 'Age'],
          ['Alice', '30'],
        ])
      })

      it('should reject non-JSON string values', () => {
        const result = valuesUpdateSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:B2',
          values: 'not valid json',
        })

        expect(result.success).toBe(false)
      })
    })

    describe('valuesAppendSchema', () => {
      it('should accept valid append parameters', () => {
        const result = valuesAppendSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A:D',
          values: [['Alice', '30', 'Engineer', 'NYC']],
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing values', () => {
        const result = valuesAppendSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A:D',
        })

        expect(result.success).toBe(false)
      })

      it('should accept stringified JSON array for values', () => {
        const result = valuesAppendSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A:D',
          values: '[["Alice","30","Engineer","NYC"]]',
        })

        expect(result.success).toBe(true)
        expect(result.data.values).toEqual([['Alice', '30', 'Engineer', 'NYC']])
      })
    })

    describe('valuesClearSchema', () => {
      it('should accept valid clear parameters', () => {
        const result = valuesClearSchema.safeParse({
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:D10',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing spreadsheetId', () => {
        const result = valuesClearSchema.safeParse({
          range: 'Sheet1!A1:D10',
        })

        expect(result.success).toBe(false)
      })

      it('should reject missing range', () => {
        const result = valuesClearSchema.safeParse({
          spreadsheetId: 'abc123',
        })

        expect(result.success).toBe(false)
      })
    })

    describe('sheetCreateSchema', () => {
      it('should accept valid create parameters', () => {
        const result = sheetCreateSchema.safeParse({
          spreadsheetId: 'abc123',
          title: 'New Tab',
        })

        expect(result.success).toBe(true)
      })

      it('should reject missing title', () => {
        const result = sheetCreateSchema.safeParse({
          spreadsheetId: 'abc123',
        })

        expect(result.success).toBe(false)
      })

      it('should reject missing spreadsheetId', () => {
        const result = sheetCreateSchema.safeParse({
          title: 'New Tab',
        })

        expect(result.success).toBe(false)
      })
    })

    describe('sheetDeleteSchema', () => {
      it('should accept valid delete parameters', () => {
        const result = sheetDeleteSchema.safeParse({
          spreadsheetId: 'abc123',
          sheetId: 0,
        })

        expect(result.success).toBe(true)
      })

      it('should reject non-numeric sheetId', () => {
        const result = sheetDeleteSchema.safeParse({
          spreadsheetId: 'abc123',
          sheetId: 'not-a-number',
        })

        expect(result.success).toBe(false)
      })

      it('should reject missing sheetId', () => {
        const result = sheetDeleteSchema.safeParse({
          spreadsheetId: 'abc123',
        })

        expect(result.success).toBe(false)
      })
    })
  })

  describe('Authentication', () => {
    it('should throw error when access token is missing', async () => {
      const headersWithoutToken = new Headers()

      await expect(
        handlers[SPREADSHEET_FETCH_HANDLER_NAME](
          { spreadsheetId: 'abc123' },
          headersWithoutToken
        )
      ).rejects.toThrow('Not authenticated')
    })

    it('should use access token from headers', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          spreadsheetId: 'abc123',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc123',
          properties: { title: 'Test Sheet', locale: 'en_US' },
          sheets: [],
        }),
      })

      await handlers[SPREADSHEET_FETCH_HANDLER_NAME](
        { spreadsheetId: 'abc123' },
        mockHeaders
      )

      expect(mockCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })
  })

  describe('Spreadsheet Handlers', () => {
    describe('spreadsheet/create', () => {
      it('should create a spreadsheet with title', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'new-id',
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-id',
            properties: { title: 'My Spreadsheet' },
            sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
          }),
        })

        const result = await handlers[SPREADSHEET_CREATE_HANDLER_NAME](
          { title: 'My Spreadsheet' },
          mockHeaders
        )

        expect(result.spreadsheetId).toBe('new-id')
        expect(result.title).toBe('My Spreadsheet')
        expect(result.sheets).toHaveLength(1)
        expect(result.sheets[0].title).toBe('Sheet1')

        expect(mockCall).toHaveBeenCalledWith(
          'https://sheets.googleapis.com/v4/spreadsheets',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"title":"My Spreadsheet"'),
          })
        )
      })

      it('should create a spreadsheet with custom sheet titles', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'new-id',
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-id',
            properties: { title: 'Multi Sheet' },
            sheets: [
              { properties: { sheetId: 0, title: 'Revenue' } },
              { properties: { sheetId: 1, title: 'Expenses' } },
            ],
          }),
        })

        const result = await handlers[SPREADSHEET_CREATE_HANDLER_NAME](
          { title: 'Multi Sheet', sheetTitles: 'Revenue, Expenses' },
          mockHeaders
        )

        expect(result.sheets).toHaveLength(2)
        expect(result.sheets[0].title).toBe('Revenue')
        expect(result.sheets[1].title).toBe('Expenses')

        const body = JSON.parse(mockCall.mock.calls[0][1].body)

        expect(body.sheets).toEqual([
          { properties: { title: 'Revenue' } },
          { properties: { title: 'Expenses' } },
        ])
      })

      it('should throw on API error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 403,
        })

        await expect(
          handlers[SPREADSHEET_CREATE_HANDLER_NAME](
            { title: 'Fail' },
            mockHeaders
          )
        ).rejects.toThrow('API Error: 403')
      })
    })

    describe('spreadsheet/fetch', () => {
      it('should fetch spreadsheet metadata', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'abc123',
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc123',
            properties: { title: 'Test', locale: 'en_US' },
            sheets: [
              {
                properties: {
                  sheetId: 0,
                  title: 'Sheet1',
                  sheetType: 'GRID',
                  gridProperties: { rowCount: 1000, columnCount: 26 },
                },
              },
            ],
          }),
        })

        const result = await handlers[SPREADSHEET_FETCH_HANDLER_NAME](
          { spreadsheetId: 'abc123' },
          mockHeaders
        )

        expect(result.spreadsheetId).toBe('abc123')
        expect(result.title).toBe('Test')
        expect(result.locale).toBe('en_US')
        expect(result.sheets).toHaveLength(1)
        expect(result.sheets[0]).toEqual({
          sheetId: 0,
          title: 'Sheet1',
          type: 'GRID',
          rowCount: 1000,
          columnCount: 26,
        })
      })

      it('should encode spreadsheetId in URL', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'id/with/slashes',
            spreadsheetUrl: 'https://example.com',
            properties: { title: 'Test', locale: 'en' },
            sheets: [],
          }),
        })

        await handlers[SPREADSHEET_FETCH_HANDLER_NAME](
          { spreadsheetId: 'id/with/slashes' },
          mockHeaders
        )

        expect(mockCall.mock.calls[0][0]).toContain(
          encodeURIComponent('id/with/slashes')
        )
      })
    })
  })

  describe('Values Handlers', () => {
    describe('values/read', () => {
      it('should read values from a range', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            range: 'Sheet1!A1:B2',
            majorDimension: 'ROWS',
            values: [
              ['Name', 'Age'],
              ['Alice', '30'],
            ],
          }),
        })

        const result = await handlers[VALUES_READ_HANDLER_NAME](
          { spreadsheetId: 'abc123', range: 'Sheet1!A1:B2' },
          mockHeaders
        )

        expect(result.range).toBe('Sheet1!A1:B2')
        expect(result.values).toEqual([
          ['Name', 'Age'],
          ['Alice', '30'],
        ])
      })

      it('should return empty array when no values', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            range: 'Sheet1!A1:B2',
            majorDimension: 'ROWS',
          }),
        })

        const result = await handlers[VALUES_READ_HANDLER_NAME](
          { spreadsheetId: 'abc123', range: 'Sheet1!A1:B2' },
          mockHeaders
        )

        expect(result.values).toEqual([])
      })
    })

    describe('values/update', () => {
      it('should update values in a range', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'abc123',
            updatedRange: 'Sheet1!A1:B2',
            updatedRows: 2,
            updatedColumns: 2,
            updatedCells: 4,
          }),
        })

        const result = await handlers[VALUES_UPDATE_HANDLER_NAME](
          {
            spreadsheetId: 'abc123',
            range: 'Sheet1!A1:B2',
            values: [
              ['Name', 'Age'],
              ['Alice', '30'],
            ],
          },
          mockHeaders
        )

        expect(result.updatedCells).toBe(4)
        expect(result.updatedRows).toBe(2)

        const url = mockCall.mock.calls[0][0]

        expect(url).toContain('valueInputOption=USER_ENTERED')
      })

      it('should send values with ROWS major dimension', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'abc123',
            updatedRange: 'Sheet1!A1',
            updatedRows: 1,
            updatedColumns: 1,
            updatedCells: 1,
          }),
        })

        await handlers[VALUES_UPDATE_HANDLER_NAME](
          {
            spreadsheetId: 'abc123',
            range: 'Sheet1!A1',
            values: [['test']],
          },
          mockHeaders
        )

        const body = JSON.parse(mockCall.mock.calls[0][1].body)

        expect(body.majorDimension).toBe('ROWS')
      })
    })

    describe('values/append', () => {
      it('should append rows to a range', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'abc123',
            updates: {
              updatedRange: 'Sheet1!A3:B3',
              updatedRows: 1,
              updatedColumns: 2,
              updatedCells: 2,
            },
          }),
        })

        const result = await handlers[VALUES_APPEND_HANDLER_NAME](
          {
            spreadsheetId: 'abc123',
            range: 'Sheet1!A:B',
            values: [['Bob', '25']],
          },
          mockHeaders
        )

        expect(result.updatedRows).toBe(1)
        expect(result.updatedCells).toBe(2)

        const url = mockCall.mock.calls[0][0]

        expect(url).toContain(':append')
        expect(url).toContain('valueInputOption=USER_ENTERED')
        expect(url).toContain('insertDataOption=INSERT_ROWS')
      })

      it('should use POST method', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'abc123',
            updates: {},
          }),
        })

        await handlers[VALUES_APPEND_HANDLER_NAME](
          {
            spreadsheetId: 'abc123',
            range: 'Sheet1!A:A',
            values: [['test']],
          },
          mockHeaders
        )

        expect(mockCall.mock.calls[0][1].method).toBe('POST')
      })
    })

    describe('values/clear', () => {
      it('should clear values in a range', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            spreadsheetId: 'abc123',
            clearedRange: 'Sheet1!A1:D10',
          }),
        })

        const result = await handlers[VALUES_CLEAR_HANDLER_NAME](
          { spreadsheetId: 'abc123', range: 'Sheet1!A1:D10' },
          mockHeaders
        )

        expect(result.clearedRange).toBe('Sheet1!A1:D10')

        const url = mockCall.mock.calls[0][0]

        expect(url).toContain(':clear')
      })

      it('should throw on API error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        await expect(
          handlers[VALUES_CLEAR_HANDLER_NAME](
            { spreadsheetId: 'abc123', range: 'Sheet1!A1:D10' },
            mockHeaders
          )
        ).rejects.toThrow('API Error: 404')
      })
    })
  })

  describe('Sheet Tab Handlers', () => {
    describe('sheet/create', () => {
      it('should create a new sheet tab', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            replies: [
              {
                addSheet: {
                  properties: { sheetId: 42, title: 'New Tab' },
                },
              },
            ],
          }),
        })

        const result = await handlers[SHEET_CREATE_HANDLER_NAME](
          { spreadsheetId: 'abc123', title: 'New Tab' },
          mockHeaders
        )

        expect(result.sheetId).toBe(42)
        expect(result.title).toBe('New Tab')

        const body = JSON.parse(mockCall.mock.calls[0][1].body)

        expect(body.requests[0].addSheet.properties.title).toBe('New Tab')

        const url = mockCall.mock.calls[0][0]

        expect(url).toContain(':batchUpdate')
      })

      it('should throw on API error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 400,
        })

        await expect(
          handlers[SHEET_CREATE_HANDLER_NAME](
            { spreadsheetId: 'abc123', title: 'Duplicate' },
            mockHeaders
          )
        ).rejects.toThrow('API Error: 400')
      })
    })

    describe('sheet/delete', () => {
      it('should delete a sheet tab', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            replies: [{}],
          }),
        })

        const result = await handlers[SHEET_DELETE_HANDLER_NAME](
          { spreadsheetId: 'abc123', sheetId: 42 },
          mockHeaders
        )

        expect(result.sheetId).toBe(42)

        const body = JSON.parse(mockCall.mock.calls[0][1].body)

        expect(body.requests[0].deleteSheet.sheetId).toBe(42)
      })

      it('should throw on API error', async () => {
        mockCall.mockResolvedValueOnce({
          ok: false,
          status: 400,
        })

        await expect(
          handlers[SHEET_DELETE_HANDLER_NAME](
            { spreadsheetId: 'abc123', sheetId: 999 },
            mockHeaders
          )
        ).rejects.toThrow('API Error: 400')
      })
    })
  })
})
