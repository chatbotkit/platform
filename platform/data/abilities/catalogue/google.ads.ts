import {
  array,
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  API_CALL_HANDLER_NAME,
  ApiCallSchema,
  CUSTOMER_LIST_HANDLER_NAME,
  CustomerListSchema,
  KEYWORD_FORECAST_METRICS_HANDLER_NAME,
  KEYWORD_HISTORICAL_METRICS_HANDLER_NAME,
  KEYWORD_IDEAS_HANDLER_NAME,
  KeywordForecastMetricsSchema,
  KeywordHistoricalMetricsSchema,
  KeywordIdeasSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/ads'

const GOOGLE_ADS_API_PATH = '/api/auxiliary/skillset/ability/google/ads'

const abilities = {
  'google/ads/customer/list': createAuxiliaryTemplate<CustomerListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Accessible Google Ads Customers',
    description:
      'List the Google Ads customer accounts available to the connected account.',
    tags: ['google', 'ads', 'customer', 'list', 'advertising'],
    path: GOOGLE_ADS_API_PATH,
    handler: 'customer/list' satisfies typeof CUSTOMER_LIST_HANDLER_NAME,
    secret: '@platform/google/ads',
    instruction: {
      loginCustomerId: field({
        name: 'loginCustomerId',
        description:
          'optional 10-digit manager account ID used to access client accounts',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/ads/keyword-ideas/search':
    createAuxiliaryTemplate<KeywordIdeasSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Generate Google Ads Keyword Ideas',
      description:
        'Generate keyword suggestions and historical metrics from seed keywords, a webpage URL, or an entire website.',
      tags: ['google', 'ads', 'keyword', 'ideas', 'search', 'seo', 'ppc'],
      path: GOOGLE_ADS_API_PATH,
      handler:
        'keyword-ideas/search' satisfies typeof KEYWORD_IDEAS_HANDLER_NAME,
      secret: '@platform/google/ads',
      instruction: {
        customerId: field({
          name: 'customerId',
          description:
            'the 10-digit Google Ads customer account ID, with or without hyphens',
          placeholder: true,
        }),
        loginCustomerId: field({
          name: 'loginCustomerId',
          description:
            'optional 10-digit manager account ID used to access the customer account',
          optional: true,
        }),
        keywords: array({
          name: 'keywords',
          description: 'seed keywords or phrases',
          optional: true,
          items: field({
            name: 'keyword',
            description: 'a seed keyword or phrase',
          }),
        }),
        url: field({
          name: 'url',
          description:
            'optional webpage URL to use alone or together with seed keywords',
          optional: true,
        }),
        siteUrl: field({
          name: 'siteUrl',
          description:
            'optional website URL to use as an entire-site seed; cannot be combined with keywords or url',
          optional: true,
        }),
        geoTargetConstants: array({
          name: 'geoTargetConstants',
          description:
            'Google Ads geo target resource names, e.g. geoTargetConstants/2840 for the United States',
          optional: true,
          items: field({
            name: 'geoTargetConstant',
            description: 'a Google Ads geo target constant resource name',
          }),
        }),
        language: field({
          name: 'language',
          description:
            'Google Ads language resource name, e.g. languageConstants/1000 for English',
          optional: true,
          default: 'languageConstants/1000',
        }),
        keywordPlanNetwork: field({
          name: 'keywordPlanNetwork',
          description: 'the Google search network to use',
          optional: true,
          enum: ['GOOGLE_SEARCH', 'GOOGLE_SEARCH_AND_PARTNERS'],
          default: 'GOOGLE_SEARCH',
        }),
        includeAdultKeywords: field({
          name: 'includeAdultKeywords',
          description: 'whether to include adult keyword ideas',
          type: 'boolean',
          optional: true,
          default: false,
        }),
        pageSize: field({
          name: 'pageSize',
          description: 'number of ideas to return, from 1 to 10000',
          type: 'number',
          optional: true,
          default: 1000,
          min: 1,
          max: 10000,
        }),
        pageToken: field({
          name: 'pageToken',
          description: 'optional token returned by a previous page',
          optional: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/ads/keyword-historical-metrics/fetch':
    createAuxiliaryTemplate<KeywordHistoricalMetricsSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Get Google Ads Keyword Historical Metrics',
      description:
        'Get monthly search volume, average searches, competition, competition index, bid percentiles, and optional average CPC for keywords.',
      tags: ['google', 'ads', 'keyword', 'historical', 'metrics', 'seo', 'ppc'],
      path: GOOGLE_ADS_API_PATH,
      handler:
        'keyword-historical-metrics/fetch' satisfies typeof KEYWORD_HISTORICAL_METRICS_HANDLER_NAME,
      secret: '@platform/google/ads',
      instruction: {
        customerId: field({
          name: 'customerId',
          description:
            'the 10-digit Google Ads customer account ID, with or without hyphens',
          placeholder: true,
        }),
        loginCustomerId: field({
          name: 'loginCustomerId',
          description:
            'optional 10-digit manager account ID used to access the customer account',
          optional: true,
        }),
        keywords: array({
          name: 'keywords',
          description: 'keywords to retrieve historical metrics for',
          minItems: 1,
          maxItems: 10000,
          items: field({
            name: 'keyword',
            description: 'a keyword or phrase',
          }),
        }),
        geoTargetConstants: array({
          name: 'geoTargetConstants',
          description:
            'Google Ads geo target resource names, e.g. geoTargetConstants/2840 for the United States',
          optional: true,
          maxItems: 10,
          items: field({
            name: 'geoTargetConstant',
            description: 'a Google Ads geo target constant resource name',
          }),
        }),
        language: field({
          name: 'language',
          description:
            'Google Ads language resource name, e.g. languageConstants/1000 for English',
          optional: true,
          default: 'languageConstants/1000',
        }),
        keywordPlanNetwork: field({
          name: 'keywordPlanNetwork',
          description: 'the Google search network to use',
          optional: true,
          enum: ['GOOGLE_SEARCH', 'GOOGLE_SEARCH_AND_PARTNERS'],
          default: 'GOOGLE_SEARCH',
        }),
        includeAdultKeywords: field({
          name: 'includeAdultKeywords',
          description: 'whether to include adult keywords',
          type: 'boolean',
          optional: true,
          default: false,
        }),
        includeAverageCpc: field({
          name: 'includeAverageCpc',
          description: 'whether to include the legacy average CPC metric',
          type: 'boolean',
          optional: true,
          default: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/ads/keyword-forecast-metrics/fetch':
    createAuxiliaryTemplate<KeywordForecastMetricsSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Get Google Ads Keyword Forecast Metrics',
      description:
        'Forecast impressions, clicks, CTR, average CPC, and total cost for a proposed keyword campaign.',
      tags: [
        'google',
        'ads',
        'keyword',
        'forecast',
        'metrics',
        'campaign',
        'ppc',
      ],
      path: GOOGLE_ADS_API_PATH,
      handler:
        'keyword-forecast-metrics/fetch' satisfies typeof KEYWORD_FORECAST_METRICS_HANDLER_NAME,
      secret: '@platform/google/ads',
      instruction: {
        customerId: field({
          name: 'customerId',
          description:
            'the 10-digit Google Ads customer account ID, with or without hyphens',
          placeholder: true,
        }),
        loginCustomerId: field({
          name: 'loginCustomerId',
          description:
            'optional 10-digit manager account ID used to access the customer account',
          optional: true,
        }),
        keywords: array({
          name: 'keywords',
          description: 'keywords to include in the forecast ad group',
          minItems: 1,
          items: field({
            name: 'keyword',
            description: 'a keyword or phrase',
          }),
        }),
        matchType: field({
          name: 'matchType',
          description: 'match type to apply to every forecast keyword',
          optional: true,
          enum: ['BROAD', 'PHRASE', 'EXACT'],
          default: 'BROAD',
        }),
        geoTargetConstants: array({
          name: 'geoTargetConstants',
          description:
            'Google Ads geo target resource names, e.g. geoTargetConstants/2840 for the United States',
          optional: true,
          items: field({
            name: 'geoTargetConstant',
            description: 'a Google Ads geo target constant resource name',
          }),
        }),
        languageConstants: array({
          name: 'languageConstants',
          description:
            'Google Ads language resource names, e.g. languageConstants/1000 for English',
          optional: true,
          items: field({
            name: 'languageConstant',
            description: 'a Google Ads language constant resource name',
          }),
        }),
        maxCpcBidMicros: field({
          name: 'maxCpcBidMicros',
          description:
            'maximum CPC bid in micros; 1000000 micros equals one currency unit',
          type: 'number',
          min: 1,
        }),
        dailyBudgetMicros: field({
          name: 'dailyBudgetMicros',
          description:
            'optional daily campaign budget in micros; 1000000 micros equals one currency unit',
          type: 'number',
          min: 1,
          optional: true,
        }),
        currencyCode: field({
          name: 'currencyCode',
          description:
            'optional three-letter ISO currency code; defaults to the customer account currency',
          optional: true,
        }),
        startDate: field({
          name: 'startDate',
          description:
            'optional forecast start date in YYYY-MM-DD format; must be supplied with endDate',
          optional: true,
        }),
        endDate: field({
          name: 'endDate',
          description:
            'optional forecast end date in YYYY-MM-DD format; must be supplied with startDate',
          optional: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/ads/api/call': createAuxiliaryTemplate<ApiCallSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Call Google Ads API',
    description:
      'Make a raw request to any Google Ads REST API path using the connected account.',
    tags: ['google', 'ads', 'api', 'call', 'generic'],
    path: GOOGLE_ADS_API_PATH,
    handler: 'api/call' satisfies typeof API_CALL_HANDLER_NAME,
    secret: '@platform/google/ads',
    instruction: {
      path: field({
        name: 'path',
        description:
          'path relative to the versioned Google Ads API root, e.g. customers/1234567890/googleAds:search',
      }),
      loginCustomerId: field({
        name: 'loginCustomerId',
        description:
          'optional 10-digit manager account ID used to access client accounts',
        optional: true,
      }),
      method: field({
        name: 'method',
        description:
          'HTTP method; defaults to POST when data is present and GET otherwise',
        optional: true,
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      }),
      query: field({
        name: 'query',
        description: 'optional JSON object containing URL query parameters',
        optional: true,
      }),
      data: field({
        name: 'data',
        description: 'optional JSON object containing the request body',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'pack/google/ads': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Ads Tools',
    description:
      'Installs Google Ads keyword planning tools. You can discover accessible customers, generate keyword ideas, retrieve historical metrics, forecast campaigns, and make raw API calls.',
    tags: ['google', 'ads', 'keyword', 'planner', 'pack', 'beta'],
    secret: '@platform/google/ads',
    instruction: {
      abilities: [
        'google/ads/customer/list',
        'google/ads/keyword-ideas/search',
        'google/ads/keyword-historical-metrics/fetch',
        'google/ads/keyword-forecast-metrics/fetch',
        'google/ads/api/call',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
