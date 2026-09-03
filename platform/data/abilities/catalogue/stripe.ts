import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'stripe/customer/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Customer',
    description:
      'Create a new customer in Stripe with contact information and optional payment details',
    tags: ['stripe', 'customer', 'create', 'payment'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/customers',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        name: field({
          name: 'name',
          description: "the customer's full name or business name",
          optional: true,
        }),
        email: field({
          name: 'email',
          description: "the customer's email address",
          optional: true,
        }),
        phone: field({
          name: 'phone',
          description: "the customer's phone number",
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'an optional description of the customer',
          optional: true,
        }),
      },
    },
  }),

  'stripe/customer/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Customers',
    description:
      'Retrieve a list of customers from Stripe, optionally filtered by email or creation date',
    tags: ['stripe', 'customer', 'list', 'search'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/customers',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of customers to return',
          optional: true,
          default: 10,
        }),
        email: field({
          name: 'email',
          description: 'filter customers by email address (case-sensitive)',
          optional: true,
        }),
      },
    },
  }),

  'stripe/customer/fetch': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Get Stripe Customer',
    description: 'Retrieve details of a specific customer by their ID',
    tags: ['stripe', 'customer', 'get', 'details'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1',
      path: [
        '/customers/',
        field({ name: 'customerId', description: 'the stripe customer ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/payment-intent/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Payment Intent',
    description:
      'Create a new payment intent in Stripe to initiate a payment process',
    tags: ['stripe', 'payment', 'create'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/payment_intents',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        amount: field({
          name: 'amount',
          type: 'number',
          description: 'payment amount in cents (e.g., 1000 for $10.00)',
        }),
        currency: field({
          name: 'currency',
          description: 'three-letter ISO currency code (e.g., usd, eur, gbp)',
        }),
        'payment_method_types[]': 'card',
      },
    },
  }),

  'stripe/payment-intent/fetch': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Get Stripe Payment Intent',
    description:
      'Retrieve details of a specific payment intent by its ID to check payment status',
    tags: ['stripe', 'payment', 'get', 'details'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1',
      path: [
        '/payment_intents/',
        field({
          name: 'paymentIntentId',
          description: 'the payment intent ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/payment-intent/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Payment Intents',
    description:
      'Retrieve a list of payment intents, optionally filtered by customer',
    tags: ['stripe', 'payment', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/payment_intents',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of payment intents to return',
          optional: true,
          default: 10,
        }),
        customer: field({
          name: 'customerId',
          description: 'filter by customer ID',
          optional: true,
        }),
      },
    },
  }),

  'stripe/refund/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Refund',
    description:
      'Create a refund for a charge or payment intent, either full or partial amount',
    tags: ['stripe', 'refund', 'create'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/refunds',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        charge: field({
          name: 'chargeId',
          description: 'the charge ID to refund',
          optional: true,
        }),
        payment_intent: field({
          name: 'paymentIntentId',
          description: 'the payment intent ID to refund',
          optional: true,
        }),
        amount: field({
          name: 'amount',
          type: 'number',
          description: 'refund amount in cents (leave empty for full refund)',
          optional: true,
        }),
        reason: field({
          name: 'reason',
          enum: ['duplicate', 'fraudulent', 'requested_by_customer'],
          description:
            'reason for the refund: duplicate, fraudulent, or requested_by_customer',
          optional: true,
        }),
      },
    },
  }),

  'stripe/refund/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Refunds',
    description: 'Retrieve a list of refunds, optionally filtered by charge',
    tags: ['stripe', 'refund', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/refunds',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of refunds to return',
          optional: true,
          default: 10,
        }),
        charge: field({
          name: 'chargeId',
          description: 'filter by charge ID',
          optional: true,
        }),
      },
    },
  }),

  'stripe/invoice/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Invoices',
    description:
      'Retrieve a list of invoices, optionally filtered by customer or status',
    tags: ['stripe', 'invoice', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/invoices',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of invoices to return',
          optional: true,
          default: 10,
        }),
        customer: field({
          name: 'customerId',
          description: 'filter by customer ID',
          optional: true,
        }),
        status: field({
          name: 'status',
          enum: ['draft', 'open', 'paid', 'uncollectible', 'void'],
          description: 'filter by invoice status',
          optional: true,
        }),
      },
    },
  }),

  'stripe/invoice/fetch': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Get Stripe Invoice',
    description: 'Retrieve details of a specific invoice by its ID',
    tags: ['stripe', 'invoice', 'get', 'details'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1',
      path: [
        '/invoices/',
        field({ name: 'invoiceId', description: 'the invoice ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/charge/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Charges',
    description:
      'Retrieve a list of charges, optionally filtered by customer or payment intent',
    tags: ['stripe', 'charge', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/charges',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of charges to return',
          optional: true,
          default: 10,
        }),
        customer: field({
          name: 'customerId',
          description: 'filter by customer ID',
          optional: true,
        }),
        payment_intent: field({
          name: 'paymentIntentId',
          description: 'filter by payment intent ID',
          optional: true,
        }),
      },
    },
  }),

  'stripe/customer/update': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Update Stripe Customer',
    description: 'Update details of an existing customer',
    tags: ['stripe', 'customer', 'update'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1',
      path: [
        '/customers/',
        field({ name: 'customerId', description: 'the stripe customer ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        name: field({
          name: 'name',
          description: "the customer's full name or business name",
          optional: true,
        }),
        email: field({
          name: 'email',
          description: "the customer's email address",
          optional: true,
        }),
        phone: field({
          name: 'phone',
          description: "the customer's phone number",
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'an optional description of the customer',
          optional: true,
        }),
      },
    },
  }),

  'stripe/customer/delete': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Delete Stripe Customer',
    description: 'Permanently delete a customer',
    tags: ['stripe', 'customer', 'delete'],
    secret: '@stripe',
    instruction: {
      method: 'DELETE',
      url: 'https://api.stripe.com/v1',
      path: [
        '/customers/',
        field({ name: 'customerId', description: 'the stripe customer ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/customer/search': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Search Stripe Customers',
    description: 'Search for customers using a query string',
    tags: ['stripe', 'customer', 'search'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/customers/search',
      headers: {
        Authorization: secret(),
      },
      query: {
        query: field({
          name: 'query',
          description:
            'search query string (e.g., "email:\'customer@example.com\'" or "name:\'John\'")',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of results to return',
          optional: true,
          default: 10,
        }),
      },
    },
  }),

  'stripe/product/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Product',
    description: 'Create a new product in Stripe',
    tags: ['stripe', 'product', 'create'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/products',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        name: field({
          name: 'name',
          description:
            "the product's name meant to be displayable to the customer",
        }),
        description: field({
          name: 'description',
          description: "the product's description",
          optional: true,
        }),
        active: field({
          name: 'active',
          type: 'boolean',
          description:
            'whether the product is currently available for purchase',
          optional: true,
          default: true,
        }),
      },
    },
  }),

  'stripe/product/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Products',
    description: 'Retrieve a list of products',
    tags: ['stripe', 'product', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/products',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of products to return',
          optional: true,
          default: 10,
        }),
        active: field({
          name: 'active',
          type: 'boolean',
          description: 'filter by active status',
          optional: true,
        }),
      },
    },
  }),

  'stripe/product/fetch': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Get Stripe Product',
    description: 'Retrieve details of a specific product by ID',
    tags: ['stripe', 'product', 'get'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1',
      path: [
        '/products/',
        field({ name: 'productId', description: 'the stripe product ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/product/update': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Update Stripe Product',
    description: 'Update details of an existing product',
    tags: ['stripe', 'product', 'update'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1',
      path: [
        '/products/',
        field({ name: 'productId', description: 'the stripe product ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        name: field({
          name: 'name',
          description: "the product's name",
          optional: true,
        }),
        description: field({
          name: 'description',
          description: "the product's description",
          optional: true,
        }),
        active: field({
          name: 'active',
          type: 'boolean',
          description:
            'whether the product is currently available for purchase',
          optional: true,
        }),
      },
    },
  }),

  'stripe/price/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Price',
    description: 'Create a new price for a product',
    tags: ['stripe', 'price', 'create'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/prices',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        product: field({
          name: 'productId',
          description: 'the ID of the product this price belongs to',
        }),
        unit_amount: field({
          name: 'unitAmount',
          type: 'number',
          description: 'price amount in cents (e.g., 1000 for $10.00)',
        }),
        currency: field({
          name: 'currency',
          description: 'three-letter ISO currency code (e.g., "usd")',
          default: 'usd',
        }),
        recurring: field({
          name: 'recurringInterval',
          description:
            'billing frequency (e.g., "month", "year") - leave empty for one-time payment',
          optional: true,
        }),
      },
    },
  }),

  'stripe/price/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Prices',
    description: 'Retrieve a list of prices',
    tags: ['stripe', 'price', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/prices',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of prices to return',
          optional: true,
          default: 10,
        }),
        product: field({
          name: 'productId',
          description: 'filter by product ID',
          optional: true,
        }),
        active: field({
          name: 'active',
          type: 'boolean',
          description: 'filter by active status',
          optional: true,
        }),
      },
    },
  }),

  'stripe/price/fetch': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Get Stripe Price',
    description: 'Retrieve details of a specific price by ID',
    tags: ['stripe', 'price', 'get'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1',
      path: [
        '/prices/',
        field({ name: 'priceId', description: 'the stripe price ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/subscription/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Subscription',
    description:
      'Create a new subscription for a customer with one or more prices',
    tags: ['stripe', 'subscription', 'create'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/subscriptions',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        customer: field({
          name: 'customerId',
          description: 'the ID of the customer to subscribe',
        }),
        'items[0][price]': field({
          name: 'priceId',
          description: 'the ID of the price to subscribe to',
        }),
        description: field({
          name: 'description',
          description: 'optional description for the subscription',
          optional: true,
        }),
      },
    },
  }),

  'stripe/subscription/list': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'List Stripe Subscriptions',
    description: 'Retrieve a list of subscriptions',
    tags: ['stripe', 'subscription', 'list'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1/subscriptions',
      headers: {
        Authorization: secret(),
      },
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of subscriptions to return',
          optional: true,
          default: 10,
        }),
        customer: field({
          name: 'customerId',
          description: 'filter by customer ID',
          optional: true,
        }),
        status: field({
          name: 'status',
          description:
            'filter by status (e.g., "active", "canceled", "incomplete")',
          optional: true,
        }),
      },
    },
  }),

  'stripe/subscription/fetch': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Get Stripe Subscription',
    description: 'Retrieve details of a specific subscription by ID',
    tags: ['stripe', 'subscription', 'get'],
    secret: '@stripe',
    instruction: {
      method: 'GET',
      url: 'https://api.stripe.com/v1',
      path: [
        '/subscriptions/',
        field({
          name: 'subscriptionId',
          description: 'the stripe subscription ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/subscription/update': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Update Stripe Subscription',
    description: 'Update details of an existing subscription',
    tags: ['stripe', 'subscription', 'update'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1',
      path: [
        '/subscriptions/',
        field({
          name: 'subscriptionId',
          description: 'the stripe subscription ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        description: field({
          name: 'description',
          description: 'optional description for the subscription',
          optional: true,
        }),
        'metadata[key]': field({
          name: 'metadataValue',
          description: 'optional metadata key-value pair',
          optional: true,
        }),
      },
    },
  }),

  'stripe/subscription/cancel': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Cancel Stripe Subscription',
    description: 'Cancel a subscription immediately or at period end',
    tags: ['stripe', 'subscription', 'cancel'],
    secret: '@stripe',
    instruction: {
      method: 'DELETE',
      url: 'https://api.stripe.com/v1',
      path: [
        '/subscriptions/',
        field({
          name: 'subscriptionId',
          description: 'the stripe subscription ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/invoice/create': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Create Stripe Invoice',
    description: 'Create a new invoice for a customer',
    tags: ['stripe', 'invoice', 'create'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1/invoices',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        customer: field({
          name: 'customerId',
          description: 'the ID of the customer to invoice',
        }),
        description: field({
          name: 'description',
          description: 'optional description for the invoice',
          optional: true,
        }),
        collection_method: field({
          name: 'collectionMethod',
          description:
            'payment collection method: "charge_automatically" or "send_invoice"',
          optional: true,
          default: 'charge_automatically',
        }),
      },
    },
  }),

  'stripe/invoice/update': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Update Stripe Invoice',
    description: 'Update details of a draft invoice',
    tags: ['stripe', 'invoice', 'update'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1',
      path: [
        '/invoices/',
        field({ name: 'invoiceId', description: 'the stripe invoice ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        description: field({
          name: 'description',
          description: 'optional description for the invoice',
          optional: true,
        }),
        'metadata[key]': field({
          name: 'metadataValue',
          description: 'optional metadata key-value pair',
          optional: true,
        }),
      },
    },
  }),

  'stripe/invoice/finalize': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Finalize Stripe Invoice',
    description: 'Finalize a draft invoice to make it ready for payment',
    tags: ['stripe', 'invoice', 'finalize'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1',
      path: [
        '/invoices/',
        field({ name: 'invoiceId', description: 'the stripe invoice ID' }),
        '/finalize',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {},
    },
  }),

  'stripe/invoice/send': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Send Stripe Invoice',
    description: 'Send an invoice to the customer via email',
    tags: ['stripe', 'invoice', 'send'],
    secret: '@stripe',
    instruction: {
      method: 'POST',
      url: 'https://api.stripe.com/v1',
      path: [
        '/invoices/',
        field({ name: 'invoiceId', description: 'the stripe invoice ID' }),
        '/send',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {},
    },
  }),

  'stripe/invoice/delete': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Delete Stripe Invoice',
    description: 'Delete a draft invoice',
    tags: ['stripe', 'invoice', 'delete'],
    secret: '@stripe',
    instruction: {
      method: 'DELETE',
      url: 'https://api.stripe.com/v1',
      path: [
        '/invoices/',
        field({ name: 'invoiceId', description: 'the stripe invoice ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'stripe/api/call': createFetchTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Call Stripe API',
    description:
      'Make a generic API call to Stripe. This is a flexible template that can be used to call any Stripe API endpoint by specifying the method, URL, and request body.',
    tags: ['stripe', 'api', 'call', 'generic'],
    secret: '@stripe',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Stripe API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),

  'pack/stripe': createPackTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Install Stripe Tools',
    description:
      'Installs Stripe tools into the conversation. You can manage customers, payments, subscriptions, invoices, products, and prices.',
    tags: ['stripe', 'pack', 'beta'],
    secret: '@stripe',
    instruction: {
      abilities: [
        'stripe/customer/create',
        'stripe/customer/list',
        'stripe/customer/fetch',
        'stripe/customer/update',
        'stripe/customer/delete',
        'stripe/customer/search',
        'stripe/payment-intent/create',
        'stripe/payment-intent/fetch',
        'stripe/payment-intent/list',
        'stripe/refund/create',
        'stripe/refund/list',
        'stripe/invoice/list',
        'stripe/invoice/fetch',
        'stripe/invoice/create',
        'stripe/invoice/update',
        'stripe/invoice/finalize',
        'stripe/invoice/send',
        'stripe/invoice/delete',
        'stripe/charge/list',
        'stripe/product/create',
        'stripe/product/list',
        'stripe/product/fetch',
        'stripe/product/update',
        'stripe/price/create',
        'stripe/price/list',
        'stripe/price/fetch',
        'stripe/subscription/create',
        'stripe/subscription/list',
        'stripe/subscription/fetch',
        'stripe/subscription/update',
        'stripe/subscription/cancel',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/stripe[read-only]': createPackTemplate({
    provider: 'stripe',
    icon: '@logo/stripe.com',
    name: 'Install Stripe Search Tools',
    description:
      'Installs read-only Stripe tools into the conversation. You can list and fetch customers, payments, subscriptions, and invoices without modification.',
    tags: ['stripe', 'pack', 'beta'],
    secret: '@stripe',
    instruction: {
      abilities: [
        'stripe/customer/list',
        'stripe/customer/fetch',
        'stripe/customer/search',
        'stripe/payment-intent/fetch',
        'stripe/payment-intent/list',
        'stripe/refund/list',
        'stripe/invoice/list',
        'stripe/invoice/fetch',
        'stripe/charge/list',
        'stripe/product/list',
        'stripe/product/fetch',
        'stripe/price/list',
        'stripe/price/fetch',
        'stripe/subscription/list',
        'stripe/subscription/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
