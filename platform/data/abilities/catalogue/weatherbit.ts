import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'weatherbit/current/fetch': createFetchTemplate({
    provider: 'weatherbit',
    icon: '@logo/weatherbit.io',
    name: 'Get Current Weather',
    description:
      'Fetch current weather conditions for a specific location using latitude and longitude coordinates',
    tags: ['weatherbit', 'weather', 'current', 'forecast'],
    secret: '@weatherbit',
    instruction: {
      method: 'GET',
      url: 'https://api.weatherbit.io',
      path: ['/v2.0/current'],
      query: {
        lat: field({
          name: 'latitude',
          description: 'Latitude of the location',
          placeholder: true,
        }),
        lon: field({
          name: 'longitude',
          description: 'Longitude of the location',
          placeholder: true,
        }),
        key: secret(),
      },
    },
  }),

  'weatherbit/forecast/daily': createFetchTemplate({
    provider: 'weatherbit',
    icon: '@logo/weatherbit.io',
    name: 'Get Daily Forecast',
    description:
      'Fetch daily weather forecast for up to 16 days for a specific location using latitude and longitude',
    tags: ['weatherbit', 'weather', 'forecast', 'daily'],
    secret: '@weatherbit',
    instruction: {
      method: 'GET',
      url: 'https://api.weatherbit.io',
      path: ['/v2.0/forecast/daily'],
      query: {
        lat: field({
          name: 'latitude',
          description: 'Latitude of the location',
          placeholder: true,
        }),
        lon: field({
          name: 'longitude',
          description: 'Longitude of the location',
          placeholder: true,
        }),
        days: field({
          name: 'days',
          description: 'Number of days for forecast (1-16)',
          type: 'number',
          optional: true,
          default: 7,
        }),
        units: field({
          name: 'units',
          description: 'Units for temperature',
          optional: true,
          enum: ['M', 'I', 'S'],
          default: 'M',
        }),
        key: secret(),
      },
    },
  }),

  'weatherbit/current/fetch[by-city]': createFetchTemplate({
    provider: 'weatherbit',
    icon: '@logo/weatherbit.io',
    name: 'Get Current Weather by City',
    description:
      'Fetch current weather conditions for a specific city by name and optional country code',
    tags: ['weatherbit', 'weather', 'current', 'city'],
    secret: '@weatherbit',
    instruction: {
      method: 'GET',
      url: 'https://api.weatherbit.io',
      path: ['/v2.0/current'],
      query: {
        city: field({
          name: 'city',
          description: 'City name',
          placeholder: true,
        }),
        country: field({
          name: 'country',
          description: 'Country code (e.g., US, GB, FR)',
          optional: true,
        }),
        key: secret(),
      },
    },
  }),

  'weatherbit/forecast/daily[by-city]': createFetchTemplate({
    provider: 'weatherbit',
    icon: '@logo/weatherbit.io',
    name: 'Get Daily Forecast by City',
    description:
      'Fetch daily weather forecast for up to 16 days for a specific city by name',
    tags: ['weatherbit', 'weather', 'forecast', 'daily', 'city'],
    secret: '@weatherbit',
    instruction: {
      method: 'GET',
      url: 'https://api.weatherbit.io',
      path: ['/v2.0/forecast/daily'],
      query: {
        city: field({
          name: 'city',
          description: 'City name',
          placeholder: true,
        }),
        country: field({
          name: 'country',
          description: 'Country code (e.g., US, GB, FR)',
          optional: true,
        }),
        days: field({
          name: 'days',
          description: 'Number of days for forecast (1-16)',
          type: 'number',
          optional: true,
          default: 7,
        }),
        units: field({
          name: 'units',
          description: 'Units for temperature',
          optional: true,
          enum: ['M', 'I', 'S'],
          default: 'M',
        }),
        key: secret(),
      },
    },
  }),

  'weatherbit/history/hourly': createFetchTemplate({
    provider: 'weatherbit',
    icon: '@logo/weatherbit.io',
    name: 'Get Historical Weather Data',
    description:
      'Fetch historical weather data at hourly or sub-hourly intervals for a specific location',
    tags: ['weatherbit', 'weather', 'history', 'historical'],
    secret: '@weatherbit',
    instruction: {
      method: 'GET',
      url: 'https://api.weatherbit.io',
      path: ['/v2.0/history/hourly'],
      query: {
        lat: field({
          name: 'latitude',
          description: 'Latitude of the location',
          placeholder: true,
        }),
        lon: field({
          name: 'longitude',
          description: 'Longitude of the location',
          placeholder: true,
        }),
        start_date: field({
          name: 'startDate',
          description: 'Start date (YYYY-MM-DD or YYYY-MM-DD:HH)',
          placeholder: true,
        }),
        end_date: field({
          name: 'endDate',
          description: 'End date (YYYY-MM-DD or YYYY-MM-DD:HH)',
          placeholder: true,
        }),
        key: secret(),
      },
    },
  }),

  'weatherbit/api/call': createFetchTemplate({
    provider: 'weatherbit',
    icon: '@logo/weatherbit.io',
    name: 'Call Weatherbit API',
    description:
      'Make a generic API call to Weatherbit. This is a flexible template that can be used to call any Weatherbit API endpoint by specifying the method, URL, and request body.',
    tags: ['weatherbit', 'api', 'call', 'generic'],
    secret: '@weatherbit',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Weatherbit API endpoint to call',
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
