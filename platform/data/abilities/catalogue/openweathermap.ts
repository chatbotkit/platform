import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of OpenWeatherMap abilities.
 */
const abilities = {
  'openweathermap/weather/current/fetch': createFetchTemplate({
    provider: 'openweathermap',
    icon: '@logo/openweathermap.org',
    name: 'Get Current Weather',
    description:
      'Get current weather conditions for a specific location by city name, coordinates, or zip code',
    tags: ['weather', 'openweathermap', 'current'],
    secret: '@openweathermap',
    instruction: {
      method: 'GET',
      url: 'https://api.openweathermap.org',
      path: ['/data/2.5/weather'],
      query: {
        q: field({
          name: 'location',
          description:
            'city name, state code, and country code divided by comma (e.g., "London,UK" or "New York,NY,US")',
          optional: true,
        }),
        lat: field({
          name: 'latitude',
          type: 'number',
          description: 'latitude coordinate',
          optional: true,
        }),
        lon: field({
          name: 'longitude',
          type: 'number',
          description: 'longitude coordinate',
          optional: true,
        }),
        zip: field({
          name: 'zipCode',
          description:
            'zip/post code and country code divided by comma (e.g., "10001,US")',
          optional: true,
        }),
        units: field({
          name: 'units',
          description: 'temperature units',
          enum: ['standard', 'metric', 'imperial'],
          default: 'metric',
          optional: true,
        }),
        lang: field({
          name: 'language',
          description: 'language code for weather description',
          optional: true,
        }),
        appid: secret(),
      },
    },
  }),

  'openweathermap/weather/forecast/fetch': createFetchTemplate({
    provider: 'openweathermap',
    icon: '@logo/openweathermap.org',
    name: 'Get Weather Forecast',
    description:
      'Get 5-day weather forecast with 3-hour intervals for a specific location',
    tags: ['weather', 'openweathermap', 'forecast'],
    secret: '@openweathermap',
    instruction: {
      method: 'GET',
      url: 'https://api.openweathermap.org',
      path: ['/data/2.5/forecast'],
      query: {
        q: field({
          name: 'location',
          description:
            'city name, state code, and country code divided by comma (e.g., "London,UK" or "New York,NY,US")',
          optional: true,
        }),
        lat: field({
          name: 'latitude',
          type: 'number',
          description: 'latitude coordinate',
          optional: true,
        }),
        lon: field({
          name: 'longitude',
          type: 'number',
          description: 'longitude coordinate',
          optional: true,
        }),
        zip: field({
          name: 'zipCode',
          description:
            'zip/post code and country code divided by comma (e.g., "10001,US")',
          optional: true,
        }),
        units: field({
          name: 'units',
          description: 'temperature units',
          enum: ['standard', 'metric', 'imperial'],
          default: 'metric',
          optional: true,
        }),
        cnt: field({
          name: 'count',
          type: 'number',
          description: 'number of timestamps to return (max 40)',
          optional: true,
        }),
        lang: field({
          name: 'language',
          description: 'language code for weather description',
          optional: true,
        }),
        appid: secret(),
      },
    },
  }),

  'openweathermap/air/pollution/fetch': createFetchTemplate({
    provider: 'openweathermap',
    icon: '@logo/openweathermap.org',
    name: 'Get Air Pollution Data',
    description:
      'Get current air pollution data including air quality index and pollutant concentrations',
    tags: ['weather', 'openweathermap', 'air-quality', 'pollution'],
    secret: '@openweathermap',
    instruction: {
      method: 'GET',
      url: 'https://api.openweathermap.org',
      path: ['/data/2.5/air_pollution'],
      query: {
        lat: field({
          name: 'latitude',
          type: 'number',
          description: 'latitude coordinate',
        }),
        lon: field({
          name: 'longitude',
          type: 'number',
          description: 'longitude coordinate',
        }),
        appid: secret(),
      },
    },
  }),

  'openweathermap/geocoding/direct': createFetchTemplate({
    provider: 'openweathermap',
    icon: '@logo/openweathermap.org',
    name: 'Geocode Location',
    description:
      'Convert city name to geographic coordinates (latitude and longitude)',
    tags: ['weather', 'openweathermap', 'geocoding'],
    secret: '@openweathermap',
    instruction: {
      method: 'GET',
      url: 'https://api.openweathermap.org',
      path: ['/geo/1.0/direct'],
      query: {
        q: field({
          name: 'location',
          description:
            'city name, state code, and country code divided by comma (e.g., "London,UK" or "New York,NY,US")',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of locations in response (max 5)',
          default: 1,
          optional: true,
        }),
        appid: secret(),
      },
    },
  }),

  'openweathermap/geocoding/reverse': createFetchTemplate({
    provider: 'openweathermap',
    icon: '@logo/openweathermap.org',
    name: 'Reverse Geocode',
    description:
      'Convert geographic coordinates (latitude and longitude) to location name',
    tags: ['weather', 'openweathermap', 'geocoding', 'reverse'],
    secret: '@openweathermap',
    instruction: {
      method: 'GET',
      url: 'https://api.openweathermap.org',
      path: ['/geo/1.0/reverse'],
      query: {
        lat: field({
          name: 'latitude',
          type: 'number',
          description: 'latitude coordinate',
        }),
        lon: field({
          name: 'longitude',
          type: 'number',
          description: 'longitude coordinate',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of locations in response (max 5)',
          default: 1,
          optional: true,
        }),
        appid: secret(),
      },
    },
  }),

  'openweathermap/api/call': createFetchTemplate({
    provider: 'openweathermap',
    icon: '@logo/openweathermap.org',
    name: 'Call Openweathermap API',
    description:
      'Make a generic API call to Openweathermap. This is a flexible template that can be used to call any Openweathermap API endpoint by specifying the method, URL, and request body.',
    tags: ['openweathermap', 'api', 'call', 'generic'],
    secret: '@openweathermap',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Openweathermap API endpoint to call',
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
