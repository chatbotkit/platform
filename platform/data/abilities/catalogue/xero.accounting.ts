import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/xero/accounting/sql'

/**
 * Catalogue of Xero accounting abilities.
 *
 * @see https://developer.xero.com/documentation/api/accounting/overview
 */
const abilities = {
  // SQL Interface
  'xero/accounting/sql/exec': createAuxiliaryTemplate<Schema>({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Execute Xero Accounting SQL Query',
    description:
      'Execute a simple SQL query against Xero Accounting. Known tables include xero.contacts, xero.invoices, xero.payments, xero.items, xero.accounts. Joining tables and other complex queries are not supported.',
    tags: ['accounting', 'xero', 'sql', 'beta'],
    path: '/api/auxiliary/skillset/ability/xero/accounting/sql',
    secret: '@platform/xero/accounting',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - describe, select, insert, update, delete are supported',
        placeholder: true,
      }),
      tenantId: field({
        name: 'tenantId',
        description:
          'the Xero tenant ID (organisation ID) to execute the query against',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // Contacts
  'xero/accounting/contact/list': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'List Xero Contacts',
    description:
      'Retrieve a list of contacts from Xero including customers and suppliers',
    tags: ['xero', 'contact', 'list', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Contacts',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number for pagination',
          optional: true,
          default: 1,
        }),
        where: field({
          name: 'where',
          description:
            'filter contacts using Xero filter expressions - e.g., "ContactStatus==ACTIVE"',
          optional: true,
        }),
      },
    },
  }),

  'xero/accounting/contact/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Contact',
    description: 'Retrieve details of a specific contact by their ID',
    tags: ['xero', 'contact', 'get', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Contacts/',
        field({
          name: 'contactId',
          description: 'the Xero contact ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
    },
  }),

  'xero/accounting/contact/create': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Create Xero Contact',
    description: 'Create a new contact in Xero',
    tags: ['xero', 'contact', 'create', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'POST',
      url: 'https://api.xero.com/api.xro/2.0/Contacts',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        Contacts: [
          {
            Name: field({
              name: 'name',
              description: 'the contact name (required)',
            }),
            FirstName: field({
              name: 'firstName',
              description: 'the contact first name',
              optional: true,
            }),
            LastName: field({
              name: 'lastName',
              description: 'the contact last name',
              optional: true,
            }),
            EmailAddress: field({
              name: 'email',
              description: 'the contact email address',
              optional: true,
            }),
            AccountNumber: field({
              name: 'accountNumber',
              description: 'the account number for the contact',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  'xero/accounting/contact/update': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Update Xero Contact',
    description: 'Update an existing contact in Xero',
    tags: ['xero', 'contact', 'update', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'POST',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Contacts/',
        field({
          name: 'contactId',
          description: 'the Xero contact ID to update',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        Contacts: [
          {
            Name: field({
              name: 'name',
              description: 'the contact name',
              optional: true,
            }),
            FirstName: field({
              name: 'firstName',
              description: 'the contact first name',
              optional: true,
            }),
            LastName: field({
              name: 'lastName',
              description: 'the contact last name',
              optional: true,
            }),
            EmailAddress: field({
              name: 'email',
              description: 'the contact email address',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  // Invoices
  'xero/accounting/invoice/list': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'List Xero Invoices',
    description: 'Retrieve a list of invoices from Xero',
    tags: ['xero', 'invoice', 'list', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Invoices',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number for pagination',
          optional: true,
          default: 1,
        }),
        where: field({
          name: 'where',
          description:
            'filter invoices using Xero filter expressions - e.g., "Status==AUTHORISED"',
          optional: true,
        }),
        Statuses: field({
          name: 'statuses',
          description:
            'filter by comma-separated statuses - e.g., "DRAFT,AUTHORISED"',
          optional: true,
        }),
      },
    },
  }),

  'xero/accounting/invoice/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Invoice',
    description: 'Retrieve details of a specific invoice by its ID',
    tags: ['xero', 'invoice', 'get', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Invoices/',
        field({
          name: 'invoiceId',
          description: 'the Xero invoice ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
    },
  }),

  'xero/accounting/invoice/create': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Create Xero Invoice',
    description: 'Create a new invoice in Xero',
    tags: ['xero', 'invoice', 'create', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'POST',
      url: 'https://api.xero.com/api.xro/2.0/Invoices',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        Invoices: [
          {
            Type: field({
              name: 'type',
              description:
                'the invoice type - "ACCREC" for sales invoice or "ACCPAY" for bill',
              enum: ['ACCREC', 'ACCPAY'],
            }),
            Contact: {
              ContactID: field({
                name: 'contactId',
                description: 'the contact ID for this invoice',
              }),
            },
            Date: field({
              name: 'date',
              description: 'the invoice date in YYYY-MM-DD format',
              optional: true,
            }),
            DueDate: field({
              name: 'dueDate',
              description: 'the due date in YYYY-MM-DD format',
              optional: true,
            }),
            Reference: field({
              name: 'reference',
              description: 'a reference for the invoice',
              optional: true,
            }),
            Status: field({
              name: 'status',
              description: 'the invoice status',
              enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED'],
              optional: true,
              default: 'DRAFT',
            }),
            LineItems: field({
              name: 'lineItems',
              description:
                'array of line items - each with Description, Quantity, UnitAmount, AccountCode',
            }),
          },
        ],
      },
    },
  }),

  'xero/accounting/invoice/update': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Update Xero Invoice',
    description: 'Update an existing invoice in Xero',
    tags: ['xero', 'invoice', 'update', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'POST',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Invoices/',
        field({
          name: 'invoiceId',
          description: 'the Xero invoice ID to update',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        Invoices: [
          {
            Reference: field({
              name: 'reference',
              description: 'a reference for the invoice',
              optional: true,
            }),
            DueDate: field({
              name: 'dueDate',
              description: 'the due date in YYYY-MM-DD format',
              optional: true,
            }),
            Status: field({
              name: 'status',
              description: 'the invoice status',
              enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'VOIDED'],
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  // Payments
  'xero/accounting/payment/list': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'List Xero Payments',
    description: 'Retrieve a list of payments from Xero',
    tags: ['xero', 'payment', 'list', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Payments',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        where: field({
          name: 'where',
          description: 'filter payments using Xero filter expressions',
          optional: true,
        }),
      },
    },
  }),

  'xero/accounting/payment/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Payment',
    description: 'Retrieve details of a specific payment by its ID',
    tags: ['xero', 'payment', 'get', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Payments/',
        field({
          name: 'paymentId',
          description: 'the Xero payment ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
    },
  }),

  'xero/accounting/payment/create': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Create Xero Payment',
    description: 'Create a new payment in Xero to record invoice payment',
    tags: ['xero', 'payment', 'create', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'PUT',
      url: 'https://api.xero.com/api.xro/2.0/Payments',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        Payments: [
          {
            Invoice: {
              InvoiceID: field({
                name: 'invoiceId',
                description: 'the invoice ID to apply the payment to',
              }),
            },
            Account: {
              AccountID: field({
                name: 'accountId',
                description: 'the bank account ID to receive the payment',
              }),
            },
            Amount: field({
              name: 'amount',
              type: 'number',
              description: 'the payment amount',
            }),
            Date: field({
              name: 'date',
              description: 'the payment date in YYYY-MM-DD format',
              optional: true,
            }),
            Reference: field({
              name: 'reference',
              description: 'a reference for the payment',
              optional: true,
            }),
          },
        ],
      },
    },
  }),

  // Accounts
  'xero/accounting/account/list': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'List Xero Accounts',
    description: 'Retrieve a list of accounts from the chart of accounts',
    tags: ['xero', 'account', 'list', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Accounts',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        where: field({
          name: 'where',
          description:
            'filter accounts using Xero filter expressions - e.g., "Type==BANK"',
          optional: true,
        }),
      },
    },
  }),

  'xero/accounting/account/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Account',
    description: 'Retrieve details of a specific account by its ID',
    tags: ['xero', 'account', 'get', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Accounts/',
        field({
          name: 'accountId',
          description: 'the Xero account ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
    },
  }),

  // Items
  'xero/accounting/item/list': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'List Xero Items',
    description: 'Retrieve a list of items (products/services) from Xero',
    tags: ['xero', 'item', 'list', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Items',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        where: field({
          name: 'where',
          description: 'filter items using Xero filter expressions',
          optional: true,
        }),
      },
    },
  }),

  'xero/accounting/item/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Item',
    description: 'Retrieve details of a specific item by its ID',
    tags: ['xero', 'item', 'get', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0',
      path: [
        '/Items/',
        field({
          name: 'itemId',
          description: 'the Xero item ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
    },
  }),

  'xero/accounting/item/create': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Create Xero Item',
    description: 'Create a new item (product/service) in Xero',
    tags: ['xero', 'item', 'create', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'POST',
      url: 'https://api.xero.com/api.xro/2.0/Items',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        Items: [
          {
            Code: field({
              name: 'code',
              description: 'the item code (required, must be unique)',
            }),
            Name: field({
              name: 'name',
              description: 'the item name',
              optional: true,
            }),
            Description: field({
              name: 'description',
              description: 'the item description',
              optional: true,
            }),
            PurchaseDetails: {
              UnitPrice: field({
                name: 'purchasePrice',
                type: 'number',
                description: 'the purchase price',
                optional: true,
              }),
            },
            SalesDetails: {
              UnitPrice: field({
                name: 'salesPrice',
                type: 'number',
                description: 'the sales price',
                optional: true,
              }),
            },
          },
        ],
      },
    },
  }),

  // Organisation
  'xero/accounting/organisation/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Organisation',
    description: 'Retrieve organisation details from Xero',
    tags: ['xero', 'organisation', 'get', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Organisation',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
    },
  }),

  // Reports
  'xero/accounting/report/profit-and-loss/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Profit and Loss Report',
    description: 'Retrieve the profit and loss report from Xero',
    tags: ['xero', 'report', 'profit-loss', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        fromDate: field({
          name: 'fromDate',
          description: 'start date in YYYY-MM-DD format',
          optional: true,
        }),
        toDate: field({
          name: 'toDate',
          description: 'end date in YYYY-MM-DD format',
          optional: true,
        }),
      },
    },
  }),

  'xero/accounting/report/balance-sheet/fetch': createFetchTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Get Xero Balance Sheet Report',
    description: 'Retrieve the balance sheet report from Xero',
    tags: ['xero', 'report', 'balance-sheet', 'accounting'],
    secret: '@platform/xero/accounting',
    instruction: {
      method: 'GET',
      url: 'https://api.xero.com/api.xro/2.0/Reports/BalanceSheet',
      headers: {
        Authorization: secret(),
        'Xero-Tenant-Id': field({
          name: 'tenantId',
          description: 'the Xero tenant ID (organisation ID)',
        }),
        Accept: 'application/json',
      },
      query: {
        date: field({
          name: 'date',
          description: 'report date in YYYY-MM-DD format',
          optional: true,
        }),
      },
    },
  }),

  'pack/xero': createPackTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Install Xero Tools',
    description:
      'Installs Xero tools into the conversation. You can manage contacts, invoices, payments, accounts, and view financial reports.',
    tags: ['xero', 'pack', 'beta'],
    secret: '@platform/xero/accounting',
    instruction: {
      abilities: [
        'xero/accounting/contact/list',
        'xero/accounting/contact/fetch',
        'xero/accounting/contact/create',
        'xero/accounting/contact/update',
        'xero/accounting/invoice/list',
        'xero/accounting/invoice/fetch',
        'xero/accounting/invoice/create',
        'xero/accounting/invoice/update',
        'xero/accounting/payment/list',
        'xero/accounting/payment/fetch',
        'xero/accounting/payment/create',
        'xero/accounting/account/list',
        'xero/accounting/account/fetch',
        'xero/accounting/item/list',
        'xero/accounting/item/fetch',
        'xero/accounting/item/create',
        'xero/accounting/organisation/fetch',
        'xero/accounting/report/profit-and-loss/fetch',
        'xero/accounting/report/balance-sheet/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/xero[read-only]': createPackTemplate({
    provider: 'xero',
    icon: '@logo/xero.com',
    name: 'Install Xero Search Tools',
    description:
      'Installs read-only Xero tools into the conversation. You can list and fetch contacts, invoices, payments, and view reports without modification.',
    tags: ['xero', 'pack', 'beta'],
    secret: '@platform/xero/accounting',
    instruction: {
      abilities: [
        'xero/accounting/contact/list',
        'xero/accounting/contact/fetch',
        'xero/accounting/invoice/list',
        'xero/accounting/invoice/fetch',
        'xero/accounting/payment/list',
        'xero/accounting/payment/fetch',
        'xero/accounting/account/list',
        'xero/accounting/account/fetch',
        'xero/accounting/item/list',
        'xero/accounting/item/fetch',
        'xero/accounting/organisation/fetch',
        'xero/accounting/report/profit-and-loss/fetch',
        'xero/accounting/report/balance-sheet/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
