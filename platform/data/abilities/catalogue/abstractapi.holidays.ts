import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'abstractapi/holidays/list': createFetchTemplate({
    provider: 'abstractapi',
    icon: '@logo/abstractapi.com',
    name: 'List Holidays',
    description:
      'Get a list of holidays for a specific country and year including dates, names, and types',
    tags: ['abstractapi', 'holidays', 'calendar'],
    secret: '@abstractapi',
    instruction: {
      method: 'GET',
      url: 'https://holidays.abstractapi.com',
      path: ['/v1'],
      query: {
        api_key: secret(),
        country: field({
          name: 'country',
          description: 'the two-letter ISO 3166-1 alpha-2 country code',
        }),
        year: field({
          name: 'year',
          type: 'number',
          description: 'the year to get holidays for',
        }),
        month: field({
          name: 'month',
          type: 'number',
          optional: true,
          description: 'optional month to filter holidays (1-12)',
        }),
        day: field({
          name: 'day',
          type: 'number',
          optional: true,
          description: 'optional day to filter holidays (1-31)',
        }),
      },
    },
  }),
}

export default abilities
