import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

// @note search console path-based endpoints require the siteUrl to be URL-encoded

const abilities = {
  'google/searchconsole/site/list': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Search Console Sites',
    description:
      'List verified Google Search Console properties available to the authenticated user.',
    tags: ['google', 'searchconsole', 'site', 'list', 'seo'],
    secret: '@platform/google/searchconsole',
    instruction: {
      method: 'GET',
      url: 'https://searchconsole.googleapis.com/webmasters/v3/sites',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/searchconsole/sitemap/list': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Search Console Sitemaps',
    description:
      'List submitted sitemaps for a verified Google Search Console property.',
    tags: ['google', 'searchconsole', 'sitemap', 'list', 'seo'],
    secret: '@platform/google/searchconsole',
    instruction: {
      method: 'GET',
      url: 'https://searchconsole.googleapis.com/webmasters/v3/sites',
      path: [
        '/',
        field({
          name: 'siteUrlEncoded',
          description:
            'the URL-encoded Search Console property, for example https%3A%2F%2Fexample.com%2F or sc-domain%3Aexample.com',
          placeholder: true,
        }),
        '/sitemaps',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'google/searchconsole/search-analytics/search': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Search Google Search Console Analytics',
    description:
      'Query Search Console performance data for clicks, impressions, CTR, and average position.',
    tags: ['google', 'searchconsole', 'analytics', 'search', 'seo'],
    secret: '@platform/google/searchconsole',
    instruction: {
      method: 'POST',
      url: 'https://searchconsole.googleapis.com/webmasters/v3/sites',
      path: [
        '/',
        field({
          name: 'siteUrlEncoded',
          description:
            'the URL-encoded Search Console property, for example https%3A%2F%2Fexample.com%2F or sc-domain%3Aexample.com',
          placeholder: true,
        }),
        '/searchAnalytics/query',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        startDate: field({
          name: 'startDate',
          description: 'start date in YYYY-MM-DD format',
          placeholder: true,
        }),
        endDate: field({
          name: 'endDate',
          description: 'end date in YYYY-MM-DD format',
          placeholder: true,
        }),
        dimensions: array({
          name: 'dimensions',
          description:
            'optional dimensions such as query, page, country, device, searchAppearance, or date',
          optional: true,
          items: field({
            name: 'dimension',
            description: 'dimension value',
          }),
        }),
        type: field({
          name: 'searchType',
          description: 'type of search to query',
          optional: true,
          enum: ['web', 'image', 'video', 'news', 'googleNews', 'discover'],
          default: 'web',
        }),
        aggregationType: field({
          name: 'aggregationType',
          description: 'aggregation type used to group results',
          optional: true,
          enum: ['auto', 'byPage', 'byProperty', 'byNewsShowcasePanel'],
        }),
        rowLimit: field({
          name: 'rowLimit',
          type: 'number',
          description: 'maximum number of rows to return',
          optional: true,
          default: 10,
        }),
        startRow: field({
          name: 'startRow',
          type: 'number',
          description: 'zero-based starting row for pagination',
          optional: true,
        }),
        dataState: field({
          name: 'dataState',
          description: 'whether to use final or all available data',
          optional: true,
          enum: ['all', 'final'],
          default: 'final',
        }),
      },
    },
  }),

  'google/searchconsole/url-inspection/fetch': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Inspect Google Search Console URL',
    description:
      'Inspect indexing status and coverage details for a URL in Google Search Console.',
    tags: ['google', 'searchconsole', 'url-inspection', 'fetch', 'seo'],
    secret: '@platform/google/searchconsole',
    instruction: {
      method: 'POST',
      url: 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        inspectionUrl: field({
          name: 'inspectionUrl',
          description: 'the canonical URL to inspect',
          placeholder: true,
        }),
        siteUrl: field({
          name: 'siteUrl',
          description:
            'the Search Console property, for example https://example.com/ or sc-domain:example.com',
          placeholder: true,
        }),
        languageCode: field({
          name: 'languageCode',
          description: 'optional BCP-47 language code for localized results',
          optional: true,
        }),
      },
    },
  }),

  'google/searchconsole/indexing/send': createFetchTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Submit Google Search Console Indexing Notification',
    description:
      'Send a URL update or deletion notification to the Google Indexing API.',
    tags: ['google', 'searchconsole', 'indexing', 'send', 'seo'],
    secret: '@platform/google/searchconsole',
    instruction: {
      method: 'POST',
      url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description: 'the canonical URL to notify Google about',
          placeholder: true,
        }),
        type: field({
          name: 'type',
          description: 'notification type to send to Google',
          enum: ['URL_UPDATED', 'URL_DELETED'],
          default: 'URL_UPDATED',
        }),
      },
    },
  }),

  'pack/google/searchconsole': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Search Console Tools',
    description:
      'Installs Google Search Console tools into the conversation. You can list properties and sitemaps, query performance data, inspect URLs, and submit indexing notifications.',
    tags: ['google', 'searchconsole', 'pack', 'beta'],
    secret: '@platform/google/searchconsole',
    instruction: {
      abilities: [
        'google/searchconsole/site/list',
        'google/searchconsole/sitemap/list',
        'google/searchconsole/search-analytics/search',
        'google/searchconsole/url-inspection/fetch',
        'google/searchconsole/indexing/send',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/google/searchconsole[read-only]': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Search Console Read-Only Tools',
    description:
      'Installs read-only Google Search Console tools into the conversation. You can list properties and sitemaps, query performance data, and inspect URLs without submitting changes.',
    tags: ['google', 'searchconsole', 'pack', 'beta'],
    secret: '@platform/google/searchconsole',
    instruction: {
      abilities: [
        'google/searchconsole/site/list',
        'google/searchconsole/sitemap/list',
        'google/searchconsole/search-analytics/search',
        'google/searchconsole/url-inspection/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
