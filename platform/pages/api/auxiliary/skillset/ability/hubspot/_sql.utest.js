/* eslint-disable @typescript-eslint/no-require-imports */

// @note mock auxiliary.handler to expose the inner function directly
jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    return (parameters, headers) => fn({ user: { id: 'test-user-id' } }, parameters, headers)
  }),
}))

// @note mock the call module before importing anything that uses it
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

// @note we test the driver classes directly by creating instances
// and verifying the correct API calls are made

describe('HubSpot SQL Handler - API Serialization', () => {
  const mockToken = 'Bearer test-token'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CRMObjectDriver SELECT', () => {
    it('should serialize SELECT to correct HubSpot search API URL', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ name: 'email', fieldType: 'string' }],
          }),
      })

      // @note second call is the actual search
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ id: '123', properties: { email: 'test@example.com' } }],
          }),
      })

      // @note import dynamically to ensure mocks are applied
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'SELECT email FROM crm.contact' }, mockHeaders)

      // @note the search call is the second one
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.hubapi.com/crm/v3/objects/contacts/search'
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

      const callArgs = mockCall.mock.calls[1]
      const body = JSON.parse(callArgs[1].body)

      expect(body.properties).toEqual(['email'])
    })

    it('should convert LIKE operator to CONTAINS_TOKEN in filterGroups', async () => {
      // @note first call is to describe columns for validation (SELECT * needs all columns)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ name: 'email', fieldType: 'string' }],
          }),
      })

      // @note second call is the actual search
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        { sql: "SELECT * FROM crm.contact WHERE email LIKE '%test%'" },
        mockHeaders
      )

      // @note the search call is the second one
      const callArgs = mockCall.mock.calls[1]
      const body = JSON.parse(callArgs[1].body)

      expect(body.filterGroups[0].filters[0]).toEqual({
        propertyName: 'email',
        operator: 'CONTAINS_TOKEN',
        value: 'test',
      })
    })

    it('should pluralize table names correctly (deal -> deals)', async () => {
      // @note first call is to describe columns for validation (SELECT * needs all columns)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ name: 'name', fieldType: 'string' }],
          }),
      })

      // @note second call is the actual search
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'SELECT * FROM crm.deal' }, mockHeaders)

      // @note the search call is the second one
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.hubapi.com/crm/v3/objects/deals/search'
      )
    })

    it('should handle company table correctly', async () => {
      // @note first call is to describe columns for validation (SELECT * needs all columns)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ name: 'name', fieldType: 'string' }],
          }),
      })

      // @note second call is the actual search
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'SELECT * FROM crm.company' }, mockHeaders)

      // @note the search call is the second one
      expect(mockCall.mock.calls[1][0]).toBe(
        'https://api.hubapi.com/crm/v3/objects/companies/search'
      )
    })
  })

  describe('CRMObjectDriver INSERT', () => {
    it('should serialize INSERT to correct POST API with properties', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { name: 'email', fieldType: 'string' },
              { name: 'firstname', fieldType: 'string' },
            ],
          }),
      })

      // @note second call is the actual insert
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-123' }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        {
          sql: "INSERT INTO crm.contact (email, firstname) VALUES ('test@example.com', 'John')",
        },
        mockHeaders
      )

      // @note the insert call is the second one
      const insertCall = mockCall.mock.calls[1]

      expect(insertCall[0]).toBe(
        'https://api.hubapi.com/crm/v3/objects/contacts'
      )
      expect(insertCall[1].method).toBe('POST')

      const body = JSON.parse(insertCall[1].body)

      expect(body.properties).toEqual({
        email: 'test@example.com',
        firstname: 'John',
      })
    })
  })

  describe('CRMObjectDriver UPDATE', () => {
    it('should serialize UPDATE to PATCH with correct URL and properties', async () => {
      // @note first call is to describe columns for update's validateColumns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { name: 'id', fieldType: 'number' },
              { name: 'firstname', fieldType: 'string' },
            ],
          }),
      })

      // @note second call is to describe columns for select's validateColumns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { name: 'id', fieldType: 'number' },
              { name: 'firstname', fieldType: 'string' },
            ],
          }),
      })

      // @note third call finds rows to update (search API)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ id: '123', properties: {} }],
          }),
      })

      // @note fourth call performs the update (PATCH API)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        {
          sql: "UPDATE crm.contact SET firstname = 'Jane' WHERE id = '123'",
        },
        mockHeaders
      )

      // @note the patch call is the fourth one (after 2 describe columns + 1 search)
      const patchCall = mockCall.mock.calls[3]

      expect(patchCall[0]).toBe(
        'https://api.hubapi.com/crm/v3/objects/contacts/123'
      )
      expect(patchCall[1].method).toBe('PATCH')

      const body = JSON.parse(patchCall[1].body)

      expect(body.properties).toEqual({ firstname: 'Jane' })
    })
  })

  describe('CRMObjectDriver DELETE', () => {
    it('should serialize DELETE to correct DELETE API call', async () => {
      // @note first call is to describe columns for select's validateColumns
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ name: 'id', fieldType: 'number' }],
          }),
      })

      // @note second call finds rows to delete (search API)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ id: '456', properties: {} }],
          }),
      })

      // @note third call performs the delete (DELETE API)
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler(
        { sql: "DELETE FROM crm.contact WHERE id = '456'" },
        mockHeaders
      )

      // @note the delete call is the third one (after 1 describe columns + 1 search)
      const deleteCall = mockCall.mock.calls[2]

      expect(deleteCall[0]).toBe(
        'https://api.hubapi.com/crm/v3/objects/contacts/456'
      )
      expect(deleteCall[1].method).toBe('DELETE')
    })
  })

  describe('CRMObjectDriver DESCRIBE', () => {
    it('should serialize DESCRIBE to properties API call', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { name: 'email', fieldType: 'string' },
              { name: 'firstname', fieldType: 'string' },
              { name: 'revenue', fieldType: 'number' },
            ],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await handler({ sql: 'DESCRIBE crm.contact' }, mockHeaders)

      expect(mockCall).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/properties/contact',
        expect.objectContaining({
          headers: { Authorization: mockToken },
        })
      )
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/hubspot/sql'
      )

      const emptyHeaders = new Headers()

      await expect(
        handler({ sql: 'SELECT * FROM crm.contact' }, emptyHeaders)
      ).rejects.toThrow('Not authenticated')
    })
  })
})
