import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'mapbox/forward-geocode': createFetchTemplate({
    provider: 'mapbox',
    icon: '@logo/mapbox.com',
    name: 'Forward Geocode with Mapbox',
    description: 'Convert an address to coordinates using Mapbox API',
    tags: ['mapbox', 'geocode', 'forward'],
    secret: '@mapbox',
    instruction: {
      method: 'GET',
      url: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
      path: ['/', field({ name: 'address', description: 'Address' }), '.json'],
      query: {
        access_token: secret(),
      },
    },
  }),

  'mapbox/reverse-geocode': createFetchTemplate({
    provider: 'mapbox',
    icon: '@logo/mapbox.com',
    name: 'Reverse Geocode with Mapbox',
    description: 'Convert coordinates to an address using Mapbox API',
    tags: ['mapbox', 'geocode', 'reverse'],
    secret: '@mapbox',
    instruction: {
      method: 'GET',
      url: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
      path: [
        '/',
        field({ name: 'longitude', description: 'Longitude' }),
        ',',
        field({ name: 'latitude', description: 'Latitude' }),
        '.json',
      ],
      query: {
        access_token: secret(),
      },
    },
  }),

  'mapbox/api/call': createFetchTemplate({
    provider: 'mapbox',
    icon: '@logo/mapbox.com',
    name: 'Call Mapbox API',
    description:
      'Make a generic API call to Mapbox. This is a flexible template that can be used to call any Mapbox API endpoint by specifying the method, URL, and request body.',
    tags: ['mapbox', 'api', 'call', 'generic'],
    secret: '@mapbox',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Mapbox API endpoint to call',
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
