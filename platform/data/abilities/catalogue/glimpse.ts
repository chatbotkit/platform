import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Glimpse search trend abilities.
 *
 * @see https://meetglimpse.com/google-trends-api/
 */
const abilities = {
  'glimpse/interest/fetch': createFetchTemplate({
    provider: 'glimpse',
    icon: '@logo/meetglimpse.com',
    name: 'Get Search Interest Over Time',
    description:
      'Retrieve normalized search interest (0-100 scale) over time for any keyword, matching Google Trends data',
    tags: ['glimpse', 'trends', 'search', 'interest', 'google-trends'],
    secret: '@glimpse',
    instruction: {
      method: 'GET',
      url: 'https://enterprise.meetglimpse.com/v1/interest',
      query: {
        keyword: field({
          name: 'keyword',
          description: 'The keyword or topic to retrieve search interest for',
        }),
        geo: field({
          name: 'geo',
          description:
            'Two-letter country code (e.g., US, GB). Leave empty for worldwide data.',
          optional: true,
        }),
        resolution: field({
          name: 'resolution',
          description: 'Time resolution: daily, weekly, or monthly',
          optional: true,
          enum: ['daily', 'weekly', 'monthly'],
          default: 'weekly',
        }),
        phrase_match: field({
          name: 'phrase_match',
          description:
            'When true, matches searches containing the exact phrase',
          type: 'boolean',
          optional: true,
          default: false,
        }),
      },
      headers: {
        apikey: secret(),
        accept: 'application/json',
      },
    },
  }),

  'glimpse/search-volume/fetch': createFetchTemplate({
    provider: 'glimpse',
    icon: '@logo/meetglimpse.com',
    name: 'Get Search Volume Over Time',
    description:
      'Retrieve absolute monthly search volume over time for any keyword, with year-over-year growth metrics',
    tags: ['glimpse', 'trends', 'search', 'volume', 'seo', 'keyword'],
    secret: '@glimpse',
    instruction: {
      method: 'GET',
      url: 'https://enterprise.meetglimpse.com/v1/interest_enriched',
      query: {
        keyword: field({
          name: 'keyword',
          description:
            'The keyword or topic to retrieve absolute search volume for',
        }),
        geo: field({
          name: 'geo',
          description:
            'Two-letter country code (e.g., US, GB). Leave empty for worldwide data.',
          optional: true,
        }),
        resolution: field({
          name: 'resolution',
          description: 'Time resolution: daily, weekly, or monthly',
          optional: true,
          enum: ['daily', 'weekly', 'monthly'],
          default: 'weekly',
        }),
        phrase_match: field({
          name: 'phrase_match',
          description:
            'When true, matches searches containing the exact phrase',
          type: 'boolean',
          optional: true,
          default: false,
        }),
      },
      headers: {
        apikey: secret(),
        accept: 'application/json',
      },
    },
  }),

  'glimpse/api/call': createFetchTemplate({
    provider: 'glimpse',
    icon: '@logo/meetglimpse.com',
    name: 'Call Glimpse API',
    description:
      'Make a generic API call to Glimpse. This is a flexible template that can be used to call any Glimpse API endpoint by specifying the method, URL, and request body.',
    tags: ['glimpse', 'trends', 'search', 'api', 'call', 'generic'],
    secret: '@glimpse',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Glimpse API endpoint to call',
      }),
      headers: {
        apikey: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'The request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),
}

export default abilities
