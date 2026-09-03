/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    return (parameters, headers) => fn({ user: { id: 'test-user-id' } }, parameters, headers)
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

// @note variable to hold the mock reference after module reset

let mockCall

// @note we test the driver classes directly by creating instances
// and verifying the correct API calls are made

describe('Attio SQL Handler - API Serialization', () => {
  const mockToken = 'Bearer test-token'

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    // @note re-require the mock after reset to get fresh reference
    mockCall = require('@/lib/call').default
  })

  describe('AttioRecordDriver SELECT', () => {
    it('should serialize SELECT to correct Attio query API URL', async () => {
      // @note first call is to describe columns (attributes) for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'name', type: 'text', is_writable: true },
              { api_slug: 'email_addresses', type: 'email', is_writable: true },
            ],
          }),
      })

      // @note second call is the actual query
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: '123' },
                values: {
                  name: [{ first_name: 'Ada', last_name: 'Lovelace' }],
                  email_addresses: [{ email_address: 'ada@example.com' }],
                },
              },
            ],
          }),
      })

      // @note import dynamically to ensure mocks are applied
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'SELECT name FROM attio.people' }, mockHeaders)

      // @note the query call is the second one
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.attio.com/v2/objects/people/records/query'
      )
      expect(mockCall.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: mockToken,
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('should fetch single record when ID is specified in WHERE clause', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ api_slug: 'name', type: 'text', is_writable: true }],
          }),
      })

      // @note second call fetches the single record
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: { record_id: 'record-123' },
              values: { name: [{ value: 'Test Company' }] },
            },
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        { sql: "SELECT * FROM attio.companies WHERE id = 'record-123'" },
        mockHeaders
      )

      // @note the fetch call is the second one
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.attio.com/v2/objects/companies/records/record-123'
      )
      expect(mockCall.mock.calls[1][1].method).toBeUndefined() // GET is default
    })

    it('should pluralize table names correctly (person -> people)', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ api_slug: 'name', type: 'text', is_writable: true }],
          }),
      })

      // @note second call is the actual query
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'SELECT * FROM attio.person' }, mockHeaders)

      // @note the query call is the second one - should use pluralized 'people'
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.attio.com/v2/objects/people/records/query'
      )
    })

    it('should handle company table correctly', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ api_slug: 'name', type: 'text', is_writable: true }],
          }),
      })

      // @note second call is the actual query
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'SELECT * FROM attio.company' }, mockHeaders)

      // @note the query call is the second one
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.attio.com/v2/objects/companies/records/query'
      )
    })

    it('should preserve OR filters when serializing WHERE clauses', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ api_slug: 'name', type: 'text', is_writable: true }],
          }),
      })

      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        {
          sql: "SELECT * FROM attio.people WHERE name = 'Ada' OR name = 'Grace'",
        },
        mockHeaders
      )

      const queryCall = mockCall.mock.calls[1]
      const body = JSON.parse(queryCall[1].body)

      expect(body.filter).toEqual({
        $or: [{ name: 'Ada' }, { name: 'Grace' }],
      })
    })
  })

  describe('AttioRecordDriver INSERT', () => {
    it('should serialize INSERT to correct POST API with values', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'name', type: 'text', is_writable: true, is_multiselect: false },
              { api_slug: 'domains', type: 'domain', is_writable: true, is_multiselect: true },
            ],
          }),
      })

      // @note second call is the actual insert
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: { record_id: 'new-123' } } }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        {
          sql: "INSERT INTO attio.companies (name, domains) VALUES ('Acme Inc', 'acme.com')",
        },
        mockHeaders
      )

      // @note the insert call is the second one
      const insertCall = mockCall.mock.calls[1]

      expect(insertCall[0]).toBe(
        'https://api.attio.com/v2/objects/companies/records'
      )
      expect(insertCall[1].method).toBe('POST')

      const body = JSON.parse(insertCall[1].body)

      // @note domains is multi-select so the scalar value gets wrapped in an array
      expect(body.data.values).toEqual({
        name: 'Acme Inc',
        domains: ['acme.com'],
      })
    })

    it('should leave non-multiselect scalar values unwrapped', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'name', type: 'text', is_writable: true, is_multiselect: false },
              { api_slug: 'description', type: 'text', is_writable: true, is_multiselect: false },
            ],
          }),
      })

      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: { record_id: 'new-456' } } }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        {
          sql: "INSERT INTO attio.companies (name, description) VALUES ('Test', 'A test company')",
        },
        mockHeaders
      )

      const insertCall = mockCall.mock.calls[1]
      const body = JSON.parse(insertCall[1].body)

      expect(body.data.values).toEqual({
        name: 'Test',
        description: 'A test company',
      })
    })
  })

  describe('AttioRecordDriver UPDATE', () => {
    it('should serialize UPDATE to PATCH with correct URL and values', async () => {
      // @note first call is to describe columns for update's validateColumns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'id', type: 'text', is_writable: false, is_multiselect: false },
              { api_slug: 'name', type: 'text', is_writable: true, is_multiselect: false },
            ],
          }),
      })

      // @note second call is to describe columns for select's validateColumns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'id', type: 'text', is_writable: false, is_multiselect: false },
              { api_slug: 'name', type: 'text', is_writable: true, is_multiselect: false },
            ],
          }),
      })

      // @note third call finds row to update (direct record fetch by ID)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: { record_id: '123' }, values: {} },
          }),
      })

      // @note fourth call performs the update (PATCH API)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        {
          sql: "UPDATE attio.companies SET name = 'New Name' WHERE id = '123'",
        },
        mockHeaders
      )

      // @note the patch call is the fourth one (after 2 describe columns + 1 query)
      const patchCall = mockCall.mock.calls[3]

      expect(patchCall[0]).toBe(
        'https://api.attio.com/v2/objects/companies/records/123'
      )
      expect(patchCall[1].method).toBe('PATCH')

      const body = JSON.parse(patchCall[1].body)

      expect(body.data.values).toEqual({ name: 'New Name' })
    })
  })

  describe('AttioRecordDriver DELETE', () => {
    it('should serialize DELETE to correct DELETE API call', async () => {
      // @note first call is to describe columns for select's validateColumns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ api_slug: 'id', type: 'text', is_writable: false }],
          }),
      })

      // @note second call finds row to delete (direct record fetch by ID)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: { record_id: '456' }, values: {} },
          }),
      })

      // @note third call performs the delete (DELETE API)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        { sql: "DELETE FROM attio.companies WHERE id = '456'" },
        mockHeaders
      )

      // @note the delete call is the third one (after 1 describe columns + 1 query)
      const deleteCall = mockCall.mock.calls[2]

      expect(deleteCall[0]).toBe(
        'https://api.attio.com/v2/objects/companies/records/456'
      )
      expect(deleteCall[1].method).toBe('DELETE')
    })
  })

  describe('AttioRecordDriver DESCRIBE', () => {
    it('should serialize DESCRIBE to attributes API call', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'name', type: 'text', is_writable: true },
              { api_slug: 'domains', type: 'domain', is_writable: true },
              { api_slug: 'revenue', type: 'number', is_writable: true },
              { api_slug: 'created_at', type: 'timestamp', is_writable: false },
            ],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'DESCRIBE attio.companies' }, mockHeaders)

      expect(mockCall).toHaveBeenCalledWith(
        'https://api.attio.com/v2/objects/companies/attributes',
        expect.objectContaining({
          headers: { Authorization: mockToken },
        })
      )
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const emptyHeaders = new Headers()

      await expect(
        handler({ sql: 'SELECT * FROM attio.people' }, emptyHeaders)
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('SHOW TABLES', () => {
    it('should list live Attio objects including custom objects', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'people' },
              { api_slug: 'companies' },
              { api_slug: 'projects' },
            ],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      const result = await handler({ sql: 'SHOW TABLES' }, mockHeaders)

      expect(mockCall).toHaveBeenCalledWith(
        'https://api.attio.com/v2/objects',
        expect.objectContaining({
          headers: { Authorization: mockToken },
        })
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          {
            DATABASE_NAME: 'attio',
            TABLE_NAME: 'people',
            FULL_NAME: 'attio.people',
          },
          {
            DATABASE_NAME: 'attio',
            TABLE_NAME: 'projects',
            FULL_NAME: 'attio.projects',
          },
        ])
      )
    })
  })

  describe('Row Mapping', () => {
    it('should correctly flatten Attio nested value structures', async () => {
      // @note first call is to describe columns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { api_slug: 'name', type: 'text', is_writable: true },
              { api_slug: 'email_addresses', type: 'email', is_writable: true },
              { api_slug: 'domains', type: 'domain', is_writable: true },
            ],
          }),
      })

      // @note second call returns records with nested value structures
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: { record_id: 'rec-1' },
                values: {
                  name: [{ first_name: 'John', last_name: 'Doe' }],
                  email_addresses: [
                    { email_address: 'john@example.com' },
                    { email_address: 'john@work.example' },
                  ],
                  domains: [{ domain: 'example.com' }, { domain: 'example.org' }],
                },
              },
            ],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/attio/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      const result = await handler(
        { sql: 'SELECT * FROM attio.people' },
        mockHeaders
      )

      // @note verify the flattened structure
      expect(result.result).toEqual([
        {
          row: {
            id: 'rec-1',
            name: 'John Doe',
            email_addresses: ['john@example.com', 'john@work.example'],
            domains: ['example.com', 'example.org'],
          },
        },
      ])
    })
  })
})
