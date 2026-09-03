import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName, getWhereProperties } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
  tenantId: z.string().optional(),
})

export type Schema = z.infer<typeof schema>

interface Row {
  [key: string]: unknown
}

interface XeroContact {
  ContactID: string
  Name: string
  FirstName?: string
  LastName?: string
  EmailAddress?: string
  ContactStatus?: string
  [key: string]: unknown
}

interface XeroInvoice {
  InvoiceID: string
  Type: string
  InvoiceNumber?: string
  Contact?: { ContactID: string; Name: string }
  Status?: string
  Total?: number
  [key: string]: unknown
}

interface XeroPayment {
  PaymentID: string
  Invoice?: { InvoiceID: string }
  Amount?: number
  [key: string]: unknown
}

interface XeroItem {
  ItemID: string
  Code: string
  Name?: string
  [key: string]: unknown
}

interface XeroAccount {
  AccountID: string
  Code: string
  Name: string
  Type: string
  [key: string]: unknown
}

/**
 * Driver for Xero Contacts.
 *
 * @see https://developer.xero.com/documentation/api/accounting/contacts
 */
class XeroContactDriver extends GenericDriver<Row> {
  #token: string
  #tenantId: string

  constructor({ token, tenantId }: { token: string; tenantId: string }) {
    super()

    this.#token = token
    this.#tenantId = tenantId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id', readOnly: true },
      { type: 'string', name: 'ContactID', readOnly: true },
      { type: 'string', name: 'Name' },
      { type: 'string', name: 'FirstName' },
      { type: 'string', name: 'LastName' },
      { type: 'string', name: 'EmailAddress' },
      { type: 'string', name: 'ContactStatus' },
      { type: 'string', name: 'AccountNumber' },
      { type: 'string', name: 'BankAccountDetails' },
      { type: 'string', name: 'TaxNumber' },
      { type: 'string', name: 'UpdatedDateUTC', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['ContactID']) {
      const url = new URL(
        `https://api.xero.com/api.xro/2.0/Contacts/${properties['ContactID']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Contacts: XeroContact[] }

      return result.Contacts.map((contact) => ({
        row: { ...contact, id: contact.ContactID },
      }))
    } else {
      const url = new URL('https://api.xero.com/api.xro/2.0/Contacts')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Contacts: XeroContact[] }

      return result.Contacts.map((contact) => ({
        row: { ...contact, id: contact.ContactID },
      }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.xero.com/api.xro/2.0/Contacts')

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Contacts: [parameters],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = (await response.json()) as { Contacts: XeroContact[] }

    return { id: result.Contacts[0]?.ContactID }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const contactId = row.ContactID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Contacts/${contactId}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Contacts: [{ ContactID: contactId, ...parameters }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    // @note xero doesn't support hard delete, only archiving via status update
    const contactId = row.ContactID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Contacts/${contactId}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Contacts: [{ ContactID: contactId, ContactStatus: 'ARCHIVED' }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

/**
 * Driver for Xero Invoices.
 *
 * @see https://developer.xero.com/documentation/api/accounting/invoices
 */
class XeroInvoiceDriver extends GenericDriver<Row> {
  #token: string
  #tenantId: string

  constructor({ token, tenantId }: { token: string; tenantId: string }) {
    super()

    this.#token = token
    this.#tenantId = tenantId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id', readOnly: true },
      { type: 'string', name: 'InvoiceID', readOnly: true },
      { type: 'string', name: 'InvoiceNumber' },
      { type: 'string', name: 'Type' },
      { type: 'string', name: 'ContactID' },
      { type: 'string', name: 'ContactName', readOnly: true },
      { type: 'string', name: 'Status' },
      { type: 'string', name: 'Date' },
      { type: 'string', name: 'DueDate' },
      { type: 'number', name: 'Total', readOnly: true },
      { type: 'number', name: 'AmountDue', readOnly: true },
      { type: 'number', name: 'AmountPaid', readOnly: true },
      { type: 'string', name: 'CurrencyCode' },
      { type: 'string', name: 'Reference' },
      { type: 'string', name: 'UpdatedDateUTC', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['InvoiceID']) {
      const url = new URL(
        `https://api.xero.com/api.xro/2.0/Invoices/${properties['InvoiceID']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Invoices: XeroInvoice[] }

      return result.Invoices.map((invoice) => ({
        row: this.#flattenInvoice(invoice),
      }))
    } else {
      const url = new URL('https://api.xero.com/api.xro/2.0/Invoices')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Invoices: XeroInvoice[] }

      return result.Invoices.map((invoice) => ({
        row: this.#flattenInvoice(invoice),
      }))
    }
  }

  #flattenInvoice(invoice: XeroInvoice): Row {
    return {
      ...invoice,
      id: invoice.InvoiceID,
      ContactID: invoice.Contact?.ContactID,
      ContactName: invoice.Contact?.Name,
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.xero.com/api.xro/2.0/Invoices')

    // @note format contact reference for Xero API
    const invoiceData: Record<string, unknown> = { ...parameters }

    if (parameters.ContactID) {
      invoiceData.Contact = { ContactID: parameters.ContactID }
      delete invoiceData.ContactID
    }

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Invoices: [invoiceData],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = (await response.json()) as { Invoices: XeroInvoice[] }

    return { id: result.Invoices[0]?.InvoiceID }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const invoiceId = row.InvoiceID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`
    )

    const invoiceData: Record<string, unknown> = {
      InvoiceID: invoiceId,
      ...parameters,
    }

    if (parameters.ContactID) {
      invoiceData.Contact = { ContactID: parameters.ContactID }
      delete invoiceData.ContactID
    }

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Invoices: [invoiceData],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    // @note xero doesn't support hard delete, only voiding
    const invoiceId = row.InvoiceID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Invoices: [{ InvoiceID: invoiceId, Status: 'VOIDED' }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

/**
 * Driver for Xero Payments.
 *
 * @see https://developer.xero.com/documentation/api/accounting/payments
 */
class XeroPaymentDriver extends GenericDriver<Row> {
  #token: string
  #tenantId: string

  constructor({ token, tenantId }: { token: string; tenantId: string }) {
    super()

    this.#token = token
    this.#tenantId = tenantId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id', readOnly: true },
      { type: 'string', name: 'PaymentID', readOnly: true },
      { type: 'string', name: 'InvoiceID' },
      { type: 'string', name: 'AccountID' },
      { type: 'number', name: 'Amount' },
      { type: 'string', name: 'Date' },
      { type: 'string', name: 'Reference' },
      { type: 'string', name: 'Status', readOnly: true },
      { type: 'string', name: 'UpdatedDateUTC', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['PaymentID']) {
      const url = new URL(
        `https://api.xero.com/api.xro/2.0/Payments/${properties['PaymentID']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Payments: XeroPayment[] }

      return result.Payments.map((payment) => ({
        row: this.#flattenPayment(payment),
      }))
    } else {
      const url = new URL('https://api.xero.com/api.xro/2.0/Payments')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Payments: XeroPayment[] }

      return result.Payments.map((payment) => ({
        row: this.#flattenPayment(payment),
      }))
    }
  }

  #flattenPayment(payment: XeroPayment): Row {
    return {
      ...payment,
      id: payment.PaymentID,
      InvoiceID: payment.Invoice?.InvoiceID,
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.xero.com/api.xro/2.0/Payments')

    // @note format invoice and account references for Xero API
    const paymentData: Record<string, unknown> = { ...parameters }

    if (parameters.InvoiceID) {
      paymentData.Invoice = { InvoiceID: parameters.InvoiceID }
      delete paymentData.InvoiceID
    }

    if (parameters.AccountID) {
      paymentData.Account = { AccountID: parameters.AccountID }
      delete paymentData.AccountID
    }

    const response = await call(url.href, {
      method: 'PUT',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Payments: [paymentData],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = (await response.json()) as { Payments: XeroPayment[] }

    return { id: result.Payments[0]?.PaymentID }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    // @note xero payments can only be updated for status changes (deletion)
    const paymentId = row.PaymentID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Payments/${paymentId}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Payments: [{ PaymentID: paymentId, ...parameters }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const paymentId = row.PaymentID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Payments/${paymentId}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Payments: [{ PaymentID: paymentId, Status: 'DELETED' }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

/**
 * Driver for Xero Items (products/services).
 *
 * @see https://developer.xero.com/documentation/api/accounting/items
 */
class XeroItemDriver extends GenericDriver<Row> {
  #token: string
  #tenantId: string

  constructor({ token, tenantId }: { token: string; tenantId: string }) {
    super()

    this.#token = token
    this.#tenantId = tenantId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id', readOnly: true },
      { type: 'string', name: 'ItemID', readOnly: true },
      { type: 'string', name: 'Code' },
      { type: 'string', name: 'Name' },
      { type: 'string', name: 'Description' },
      { type: 'number', name: 'PurchaseUnitPrice' },
      { type: 'number', name: 'SalesUnitPrice' },
      { type: 'boolean', name: 'IsSold' },
      { type: 'boolean', name: 'IsPurchased' },
      { type: 'string', name: 'UpdatedDateUTC', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['ItemID']) {
      const url = new URL(
        `https://api.xero.com/api.xro/2.0/Items/${properties['ItemID']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Items: XeroItem[] }

      return result.Items.map((item) => ({
        row: { ...item, id: item.ItemID },
      }))
    } else {
      const url = new URL('https://api.xero.com/api.xro/2.0/Items')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Items: XeroItem[] }

      return result.Items.map((item) => ({
        row: { ...item, id: item.ItemID },
      }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.xero.com/api.xro/2.0/Items')

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Items: [parameters],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = (await response.json()) as { Items: XeroItem[] }

    return { id: result.Items[0]?.ItemID }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const itemId = row.ItemID || row.id

    const url = new URL(`https://api.xero.com/api.xro/2.0/Items/${itemId}`)

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Items: [{ ItemID: itemId, ...parameters }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const itemId = row.ItemID || row.id

    const url = new URL(`https://api.xero.com/api.xro/2.0/Items/${itemId}`)

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

/**
 * Driver for Xero Accounts (chart of accounts).
 *
 * @see https://developer.xero.com/documentation/api/accounting/accounts
 */
class XeroAccountDriver extends GenericDriver<Row> {
  #token: string
  #tenantId: string

  constructor({ token, tenantId }: { token: string; tenantId: string }) {
    super()

    this.#token = token
    this.#tenantId = tenantId
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id', readOnly: true },
      { type: 'string', name: 'AccountID', readOnly: true },
      { type: 'string', name: 'Code' },
      { type: 'string', name: 'Name' },
      { type: 'string', name: 'Type' },
      { type: 'string', name: 'Status' },
      { type: 'string', name: 'Description' },
      { type: 'string', name: 'TaxType' },
      { type: 'string', name: 'Class', readOnly: true },
      { type: 'boolean', name: 'EnablePaymentsToAccount' },
      { type: 'string', name: 'UpdatedDateUTC', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['AccountID']) {
      const url = new URL(
        `https://api.xero.com/api.xro/2.0/Accounts/${properties['AccountID']}`
      )

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Accounts: XeroAccount[] }

      return result.Accounts.map((account) => ({
        row: { ...account, id: account.AccountID },
      }))
    } else {
      const url = new URL('https://api.xero.com/api.xro/2.0/Accounts')

      const response = await call(url.href, {
        headers: {
          Authorization: this.#token,
          'Xero-Tenant-Id': this.#tenantId,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw await getCallError(response)
      }

      const result = (await response.json()) as { Accounts: XeroAccount[] }

      return result.Accounts.map((account) => ({
        row: { ...account, id: account.AccountID },
      }))
    }
  }

  async doInsert(parameters: Record<string, unknown>) {
    const url = new URL('https://api.xero.com/api.xro/2.0/Accounts')

    const response = await call(url.href, {
      method: 'PUT',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Accounts: [parameters],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const result = (await response.json()) as { Accounts: XeroAccount[] }

    return { id: result.Accounts[0]?.AccountID }
  }

  async doUpdate({ row }: { row: Row }, parameters: Record<string, unknown>) {
    const accountId = row.AccountID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Accounts/${accountId}`
    )

    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        Accounts: [{ AccountID: accountId, ...parameters }],
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }

  async doDelete({ row }: { row: Row }) {
    const accountId = row.AccountID || row.id

    const url = new URL(
      `https://api.xero.com/api.xro/2.0/Accounts/${accountId}`
    )

    const response = await call(url.href, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
        'Xero-Tenant-Id': this.#tenantId,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

const supportedTables = [
  { database: 'xero', name: 'contacts' },
  { database: 'xero', name: 'invoices' },
  { database: 'xero', name: 'payments' },
  { database: 'xero', name: 'items' },
  { database: 'xero', name: 'accounts' },
]

export default handler(
  schema,
  supportedTables,
  async (table, parameters, headers) => {
    const token = headers.get('x-access-token')
    const tenantId = parameters.tenantId || headers.get('x-xero-tenant-id')

    if (!token) {
      return throwNotAuthenticated()
    }

    if (!tenantId) {
      throw new Error(
        'Missing Xero Tenant ID. Provide it via tenantId parameter or X-Xero-Tenant-Id header.'
      )
    }

    const tableName = getTableName(table)

    switch (tableName) {
      case 'xero.contacts': {
        return new XeroContactDriver({ token, tenantId })
      }

      case 'xero.invoices': {
        return new XeroInvoiceDriver({ token, tenantId })
      }

      case 'xero.payments': {
        return new XeroPaymentDriver({ token, tenantId })
      }

      case 'xero.items': {
        return new XeroItemDriver({ token, tenantId })
      }

      case 'xero.accounts': {
        return new XeroAccountDriver({ token, tenantId })
      }
    }

    throw new Error(`No driver found for table ${tableName}`)
  }
)
