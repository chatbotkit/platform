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

describe('Xero SQL Handler - API Serialization', () => {
  const mockToken = 'Bearer test-token'
  const mockTenantId = 'test-tenant-id'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('XeroContactDriver SELECT', () => {
    it('should serialize SELECT to correct Xero Contacts API URL', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Contacts: [
              {
                ContactID: '123',
                Name: 'Test Contact',
                EmailAddress: 'test@example.com',
              },
            ],
          }),
      })

      // @note import dynamically to ensure mocks are applied
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        { sql: 'SELECT * FROM xero.contacts', tenantId: mockTenantId },
        mockHeaders
      )

      expect(mockCall.mock.calls[0][0]).toBe(
        'https://api.xero.com/api.xro/2.0/Contacts'
      )
      expect(mockCall.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          headers: {
            Authorization: mockToken,
            'Xero-Tenant-Id': mockTenantId,
            Accept: 'application/json',
          },
        })
      )
    })

    it('should fetch single contact by ContactID', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Contacts: [
              {
                ContactID: '456',
                Name: 'Specific Contact',
              },
            ],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        {
          sql: "SELECT * FROM xero.contacts WHERE ContactID = '456'",
          tenantId: mockTenantId,
        },
        mockHeaders
      )

      expect(mockCall.mock.calls[0][0]).toBe(
        'https://api.xero.com/api.xro/2.0/Contacts/456'
      )
    })
  })

  describe('XeroInvoiceDriver SELECT', () => {
    it('should serialize SELECT to correct Xero Invoices API URL', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Invoices: [
              {
                InvoiceID: 'inv-123',
                Type: 'ACCREC',
                InvoiceNumber: 'INV-001',
                Contact: { ContactID: 'c123', Name: 'Customer' },
                Status: 'AUTHORISED',
              },
            ],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        { sql: 'SELECT * FROM xero.invoices', tenantId: mockTenantId },
        mockHeaders
      )

      expect(mockCall.mock.calls[0][0]).toBe(
        'https://api.xero.com/api.xro/2.0/Invoices'
      )
    })
  })

  describe('XeroContactDriver INSERT', () => {
    it('should serialize INSERT to correct POST API with Contacts array', async () => {
      // @note first call is to describe columns for validation
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Contacts: [{ ContactID: 'new-123', Name: 'New Contact' }],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        {
          sql: "INSERT INTO xero.contacts (Name, EmailAddress) VALUES ('Test Company', 'test@company.com')",
          tenantId: mockTenantId,
        },
        mockHeaders
      )

      const insertCall = mockCall.mock.calls[0]

      expect(insertCall[0]).toBe('https://api.xero.com/api.xro/2.0/Contacts')
      expect(insertCall[1].method).toBe('POST')
      expect(insertCall[1].headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(insertCall[1].body)

      expect(body.Contacts).toBeDefined()
      expect(body.Contacts[0].Name).toBe('Test Company')
      expect(body.Contacts[0].EmailAddress).toBe('test@company.com')
    })
  })

  describe('XeroContactDriver UPDATE', () => {
    it('should serialize UPDATE to POST with ContactID in body', async () => {
      // @note first call finds rows to update
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Contacts: [{ ContactID: '789', Name: 'Old Name' }],
          }),
      })

      // @note second call performs the update
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Contacts: [{ ContactID: '789', Name: 'New Name' }],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        {
          sql: "UPDATE xero.contacts SET Name = 'New Name' WHERE ContactID = '789'",
          tenantId: mockTenantId,
        },
        mockHeaders
      )

      // @note the update call is the second one (after 1 select)
      const updateCall = mockCall.mock.calls[1]

      expect(updateCall[0]).toBe(
        'https://api.xero.com/api.xro/2.0/Contacts/789'
      )
      expect(updateCall[1].method).toBe('POST')

      const body = JSON.parse(updateCall[1].body)

      expect(body.Contacts[0].ContactID).toBe('789')
      expect(body.Contacts[0].Name).toBe('New Name')
    })
  })

  describe('XeroContactDriver DELETE', () => {
    it('should archive contact (set status to ARCHIVED) instead of hard delete', async () => {
      // @note first call finds rows to delete
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Contacts: [{ ContactID: '999', Name: 'To Delete' }],
          }),
      })

      // @note second call archives the contact
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        {
          sql: "DELETE FROM xero.contacts WHERE ContactID = '999'",
          tenantId: mockTenantId,
        },
        mockHeaders
      )

      // @note the archive call is the second one (after 1 select)
      const archiveCall = mockCall.mock.calls[1]

      expect(archiveCall[0]).toBe(
        'https://api.xero.com/api.xro/2.0/Contacts/999'
      )
      expect(archiveCall[1].method).toBe('POST')

      const body = JSON.parse(archiveCall[1].body)

      expect(body.Contacts[0].ContactStatus).toBe('ARCHIVED')
    })
  })

  describe('XeroItemDriver DELETE', () => {
    it('should use DELETE method for items', async () => {
      // @note first call finds rows to delete
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [{ ItemID: 'item-123', Code: 'ITEM001' }],
          }),
      })

      // @note second call deletes the item
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        {
          sql: "DELETE FROM xero.items WHERE ItemID = 'item-123'",
          tenantId: mockTenantId,
        },
        mockHeaders
      )

      // @note the delete call is the second one (after 1 select)
      const deleteCall = mockCall.mock.calls[1]

      expect(deleteCall[0]).toBe(
        'https://api.xero.com/api.xro/2.0/Items/item-123'
      )
      expect(deleteCall[1].method).toBe('DELETE')
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const emptyHeaders = new Headers()

      await expect(
        handler(
          { sql: 'SELECT * FROM xero.contacts', tenantId: mockTenantId },
          emptyHeaders
        )
      ).rejects.toThrow('Not authenticated')
    })

    it('should throw error when no tenant ID provided', async () => {
      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)

      await expect(
        handler({ sql: 'SELECT * FROM xero.contacts' }, mockHeaders)
      ).rejects.toThrow('Missing Xero Tenant ID')
    })
  })

  describe('XeroPaymentDriver INSERT', () => {
    it('should format Invoice and Account as nested objects', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Payments: [{ PaymentID: 'pay-123', Amount: 100 }],
          }),
      })

      const { default: handler } = await import(
        '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'
      )

      const mockHeaders = new Headers()

      mockHeaders.set('x-access-token', mockToken)
      mockHeaders.set('x-xero-tenant-id', mockTenantId)

      await handler(
        {
          sql: "INSERT INTO xero.payments (InvoiceID, AccountID, Amount) VALUES ('inv-123', 'acc-456', 100)",
          tenantId: mockTenantId,
        },
        mockHeaders
      )

      const insertCall = mockCall.mock.calls[0]

      expect(insertCall[0]).toBe('https://api.xero.com/api.xro/2.0/Payments')
      expect(insertCall[1].method).toBe('PUT')

      const body = JSON.parse(insertCall[1].body)

      expect(body.Payments[0].Invoice).toEqual({ InvoiceID: 'inv-123' })
      expect(body.Payments[0].Account).toEqual({ AccountID: 'acc-456' })
      // @note SQL parser converts numeric values to strings
      expect(body.Payments[0].Amount).toBe('100')
    })
  })
})
