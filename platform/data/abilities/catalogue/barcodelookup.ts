import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Barcode Lookup abilities.
 */
const abilities = {
  'barcodelookup/product/fetch': createFetchTemplate({
    provider: 'barcodelookup',
    icon: '@logo/barcodelookup.com',
    name: 'Get Product by Barcode',
    description:
      'Retrieve product information by barcode number (UPC, EAN, ISBN)',
    tags: ['barcode', 'product', 'upc', 'ean'],
    secret: '@barcodelookup',
    instruction: {
      method: 'GET',
      url: 'https://api.barcodelookup.com',
      path: ['/v3/products'],
      query: {
        barcode: field({
          name: 'barcode',
          description:
            'barcode number to search (7-14 digits, can use * for partial)',
        }),
        key: secret(),
      },
    },
  }),

  'barcodelookup/product/search': createFetchTemplate({
    provider: 'barcodelookup',
    icon: '@logo/barcodelookup.com',
    name: 'Search Products',
    description:
      'Search for products by various parameters like title, brand, category, or manufacturer',
    tags: ['barcode', 'product', 'search'],
    secret: '@barcodelookup',
    instruction: {
      method: 'GET',
      url: 'https://api.barcodelookup.com',
      path: ['/v3/products'],
      query: {
        search: field({
          name: 'query',
          description: 'general search query across all fields',
          optional: true,
        }),
        title: field({
          name: 'title',
          description: 'product title or name',
          optional: true,
        }),
        brand: field({
          name: 'brand',
          description: 'brand name (use quotes for exact match)',
          optional: true,
        }),
        category: field({
          name: 'category',
          description: 'product category',
          optional: true,
        }),
        manufacturer: field({
          name: 'manufacturer',
          description: 'manufacturer name (use quotes for exact match)',
          optional: true,
        }),
        mpn: field({
          name: 'mpn',
          description: 'manufacturer part number',
          optional: true,
        }),
        asin: field({
          name: 'asin',
          description: 'amazon standard identification number',
          optional: true,
        }),
        key: secret(),
      },
    },
  }),

  'barcodelookup/api/call': createFetchTemplate({
    provider: 'barcodelookup',
    icon: '@logo/barcodelookup.com',
    name: 'Call Barcodelookup API',
    description:
      'Make a generic API call to Barcodelookup. This is a flexible template that can be used to call any Barcodelookup API endpoint by specifying the method, URL, and request body.',
    tags: ['barcodelookup', 'product', 'api', 'call', 'generic'],
    secret: '@barcodelookup',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Barcodelookup API endpoint to call',
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
}

export default abilities
