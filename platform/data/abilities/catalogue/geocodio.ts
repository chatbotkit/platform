import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'geocodio/address/fetch': createFetchTemplate({
    provider: 'geocodio',
    icon: '@logo/geocod.io',
    name: 'Geocode Address',
    description:
      'Convert an address or location into geographic coordinates (latitude/longitude)',
    tags: ['geocodio', 'geocoding', 'location', 'coordinates'],
    secret: '@geocodio',
    instruction: {
      method: 'GET',
      url: 'https://api.geocod.io',
      path: ['/v1.9/geocode'],
      query: {
        q: field({
          name: 'address',
          description: 'the address to geocode',
        }),
        country: field({
          name: 'country',
          description: 'the country (USA or Canada)',
          optional: true,
          default: 'USA',
          enum: ['USA', 'Canada'],
        }),
        api_key: secret(),
      },
    },
  }),

  'geocodio/coordinates/fetch': createFetchTemplate({
    provider: 'geocodio',
    icon: '@logo/geocod.io',
    name: 'Reverse Geocode Coordinates',
    description:
      'Convert geographic coordinates (latitude/longitude) into an address',
    tags: ['geocodio', 'reverse-geocoding', 'location', 'address'],
    secret: '@geocodio',
    instruction: {
      method: 'GET',
      url: 'https://api.geocod.io',
      path: ['/v1.9/reverse'],
      query: {
        q: field({
          name: 'coordinates',
          description:
            'the coordinates to reverse geocode in format "latitude,longitude"',
        }),
        api_key: secret(),
      },
    },
  }),

  'geocodio/api/call': createFetchTemplate({
    provider: 'geocodio',
    icon: '@logo/geocod.io',
    name: 'Call Geocodio API',
    description:
      'Make a generic API call to Geocodio. This is a flexible template that can be used to call any Geocodio API endpoint by specifying the method, URL, and request body.',
    tags: ['geocodio', 'api', 'call', 'generic'],
    secret: '@geocodio',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Geocodio API endpoint to call',
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
