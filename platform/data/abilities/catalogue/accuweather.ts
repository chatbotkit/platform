import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'accuweather/location/search': createFetchTemplate({
    provider: 'accuweather',
    icon: '@logo/accuweather.com',
    name: 'Search Location',
    description:
      'Search for a location to get its location key for weather queries',
    tags: ['accuweather', 'location', 'search', 'weather'],
    secret: '@accuweather',
    instruction: {
      method: 'GET',
      url: 'http://dataservice.accuweather.com',
      path: ['/locations/v1/cities/search'],
      query: {
        apikey: secret(),
        q: field({
          name: 'query',
          description: 'Location search query - city name, postal code, etc.',
        }),
      },
    },
  }),

  'accuweather/conditions/current/fetch': createFetchTemplate({
    provider: 'accuweather',
    icon: '@logo/accuweather.com',
    name: 'Get Current Conditions',
    description:
      'Retrieve current weather conditions for a specific location using its location key',
    tags: ['accuweather', 'weather', 'current', 'conditions'],
    secret: '@accuweather',
    instruction: {
      method: 'GET',
      url: 'http://dataservice.accuweather.com',
      path: [
        '/currentconditions/v1/',
        field({
          name: 'locationKey',
          description:
            'The location key for the desired location - use location search to find this',
          placeholder: true,
        }),
      ],
      query: {
        apikey: secret(),
        details: field({
          name: 'details',
          type: 'boolean',
          description: 'Include additional details in the response',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'accuweather/forecast/daily/fetch': createFetchTemplate({
    provider: 'accuweather',
    icon: '@logo/accuweather.com',
    name: 'Get Daily Forecast',
    description: 'Get daily weather forecast for a specific location',
    tags: ['accuweather', 'weather', 'forecast', 'daily'],
    secret: '@accuweather',
    instruction: {
      method: 'GET',
      url: 'http://dataservice.accuweather.com',
      path: [
        '/forecasts/v1/daily/',
        field({
          name: 'days',
          type: 'number',
          description: 'Number of days to forecast, e.g. 1, 5, 10, or 15',
          enum: [1, 5, 10, 15],
          default: 5,
        }),
        'day/',
        field({
          name: 'locationKey',
          description: 'The location key for the desired location',
          placeholder: true,
        }),
      ],
      query: {
        apikey: secret(),
        details: field({
          name: 'details',
          type: 'boolean',
          description: 'Include additional details in the response',
          optional: true,
          default: false,
        }),
        metric: field({
          name: 'metric',
          type: 'boolean',
          description: 'Return values in metric units',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'accuweather/forecast/hourly': createFetchTemplate({
    provider: 'accuweather',
    icon: '@logo/accuweather.com',
    name: 'Get Hourly Forecast',
    description: 'Get hourly weather forecast for a specific location',
    tags: ['accuweather', 'weather', 'forecast', 'hourly'],
    secret: '@accuweather',
    instruction: {
      method: 'GET',
      url: 'http://dataservice.accuweather.com',
      path: [
        '/forecasts/v1/hourly/',
        field({
          name: 'hours',
          type: 'number',
          description:
            'Number of hours to forecast, e.g. 1, 12, 24, 72, or 120',
          enum: [1, 12, 24, 72, 120],
          default: 12,
        }),
        'hour/',
        field({
          name: 'locationKey',
          description: 'The location key for the desired location',
          placeholder: true,
        }),
      ],
      query: {
        apikey: secret(),
        details: field({
          name: 'details',
          type: 'boolean',
          description: 'Include additional details in the response',
          optional: true,
          default: false,
        }),
        metric: field({
          name: 'metric',
          type: 'boolean',
          description: 'Return values in metric units',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'accuweather/conditions/historical': createFetchTemplate({
    provider: 'accuweather',
    icon: '@logo/accuweather.com',
    name: 'Get Historical Weather',
    description:
      'Retrieve historical weather conditions for a specific location',
    tags: ['accuweather', 'weather', 'historical', 'past'],
    secret: '@accuweather',
    instruction: {
      method: 'GET',
      url: 'http://dataservice.accuweather.com',
      path: [
        '/currentconditions/v1/',
        field({
          name: 'locationKey',
          description: 'The location key for the desired location',
          placeholder: true,
        }),
        '/historical',
        field({
          name: 'hours',
          type: 'number',
          description: 'Number of hours to look back, e.g. 6 or 24',
          enum: [6, 24],
          optional: true,
        }),
      ],
      query: {
        apikey: secret(),
        details: field({
          name: 'details',
          type: 'boolean',
          description: 'Include additional details in the response',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'accuweather/api/call': createFetchTemplate({
    provider: 'accuweather',
    icon: '@logo/accuweather.com',
    name: 'Call Accuweather API',
    description:
      'Make a generic API call to Accuweather. This is a flexible template that can be used to call any Accuweather API endpoint by specifying the method, URL, and request body.',
    tags: ['accuweather', 'api', 'call', 'generic'],
    secret: '@accuweather',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Accuweather API endpoint to call',
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
