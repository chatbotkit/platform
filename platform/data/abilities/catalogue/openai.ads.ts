import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

// @note base URL for the OpenAI Ads (Advertiser) API. Keys are scoped to a
// single ad account, so no account identifier is required in the path.
// @see https://developers.openai.com/ads/api-overview

const BASE_URL = 'https://api.ads.openai.com/v1'

const ICON = '@logo/openai.com'

/**
 * Catalogue of OpenAI Ads abilities for managing campaigns, ad groups, ads and
 * insights through the OpenAI Advertiser API.
 */
const abilities = {
  // --- AD ACCOUNT ---

  'openai/ads/account/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Ad Account',
    description:
      'Retrieve the ad account associated with the API key, including id, name, timezone and currency.',
    tags: ['openai', 'ads', 'account', 'fetch', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: `${BASE_URL}/ad_account`,
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/account/insights/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Ad Account Insights',
    description:
      'Retrieve aggregated performance insights (impressions, clicks, spend, ctr, cpc, cpm) for the whole ad account.',
    tags: ['openai', 'ads', 'account', 'insights', 'reporting'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: `${BASE_URL}/ad_account/insights`,
      query: {
        time_granularity: field({
          name: 'timeGranularity',
          description: 'the bucket size for the report',
          enum: ['hourly', 'daily', 'monthly', 'none'],
          optional: true,
        }),
        aggregation_level: field({
          name: 'aggregationLevel',
          description: 'the row entity type for the report',
          enum: ['ad_account', 'campaign', 'ad_group', 'ad'],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return (1-2000)',
          optional: true,
          default: 20,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
        before: field({
          name: 'before',
          description: 'pagination cursor for the previous page',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- CAMPAIGNS ---

  'openai/ads/campaign/list': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'List Campaigns',
    description: 'List campaigns in the ad account with pagination support.',
    tags: ['openai', 'ads', 'campaign', 'list', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: `${BASE_URL}/campaigns`,
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of campaigns to return (1-500)',
          optional: true,
          default: 20,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
        before: field({
          name: 'before',
          description: 'pagination cursor for the previous page',
          optional: true,
        }),
        order: field({
          name: 'order',
          description: 'sort direction',
          enum: ['asc', 'desc'],
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/campaign/create': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Create Campaign',
    description:
      'Create a new campaign with a name, status, and lifetime budget. Use product_feed mode for catalog-driven campaigns.',
    tags: ['openai', 'ads', 'campaign', 'create', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: `${BASE_URL}/campaigns`,
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the campaign name (3-1000 characters)',
        }),
        description: field({
          name: 'description',
          description: 'an optional description for the campaign',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the initial campaign status',
          enum: ['active', 'paused'],
        }),
        budget: {
          lifetime_spend_limit_micros: field({
            name: 'lifetimeSpendLimitMicros',
            type: 'number',
            description:
              'the lifetime spend limit in micros (1,000,000 micros = 1 unit of currency, minimum 1000000)',
          }),
        },
        start_time: field({
          name: 'startTime',
          type: 'number',
          description: 'optional start time as a unix timestamp in seconds',
          optional: true,
        }),
        end_time: field({
          name: 'endTime',
          type: 'number',
          description: 'optional end time as a unix timestamp in seconds',
          optional: true,
        }),
        mode: field({
          name: 'mode',
          description: 'set to product_feed for product-feed campaigns',
          enum: ['product_feed'],
          optional: true,
        }),
      },
    },
  }),

  'openai/ads/campaign/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Campaign',
    description: 'Retrieve a single campaign by its id.',
    tags: ['openai', 'ads', 'campaign', 'fetch', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/campaigns/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/campaign/update': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Update Campaign',
    description:
      'Update an existing campaign. Include the full budget object when changing the budget.',
    tags: ['openai', 'ads', 'campaign', 'update', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/campaigns/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new campaign name (3-1000 characters)',
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'the new campaign description',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the new campaign status',
          enum: ['active', 'paused'],
          optional: true,
        }),
        budget: {
          lifetime_spend_limit_micros: field({
            name: 'lifetimeSpendLimitMicros',
            type: 'number',
            description:
              'the new lifetime spend limit in micros (minimum 1000000)',
            optional: true,
          }),
        },
      },
    },
  }),

  'openai/ads/campaign/activate': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Activate Campaign',
    description: 'Activate (enable) a paused campaign by its id.',
    tags: ['openai', 'ads', 'campaign', 'activate', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/campaigns/',
        field({ name: 'campaignId', description: 'the campaign id' }),
        '/activate',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/campaign/pause': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Pause Campaign',
    description: 'Pause an active campaign by its id.',
    tags: ['openai', 'ads', 'campaign', 'pause', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/campaigns/',
        field({ name: 'campaignId', description: 'the campaign id' }),
        '/pause',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/campaign/archive': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Archive Campaign',
    description: 'Archive a campaign by its id.',
    tags: ['openai', 'ads', 'campaign', 'archive', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/campaigns/',
        field({ name: 'campaignId', description: 'the campaign id' }),
        '/archive',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/campaign/insights/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Campaign Insights',
    description:
      'Retrieve aggregated performance insights for a single campaign by its id.',
    tags: ['openai', 'ads', 'campaign', 'insights', 'reporting'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/campaigns/',
        field({ name: 'campaignId', description: 'the campaign id' }),
        '/insights',
      ],
      query: {
        time_granularity: field({
          name: 'timeGranularity',
          description: 'the bucket size for the report',
          enum: ['hourly', 'daily', 'monthly', 'none'],
          optional: true,
        }),
        aggregation_level: field({
          name: 'aggregationLevel',
          description: 'the row entity type for the report',
          enum: ['campaign', 'ad_group', 'ad'],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return (1-2000)',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- AD GROUPS ---

  'openai/ads/ad-group/list': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'List Ad Groups',
    description: 'List the ad groups belonging to a campaign.',
    tags: ['openai', 'ads', 'ad-group', 'list', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: `${BASE_URL}/ad_groups`,
      query: {
        campaign_id: field({
          name: 'campaignId',
          description: 'the parent campaign id to list ad groups for',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of ad groups to return (1-500)',
          optional: true,
          default: 20,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
        before: field({
          name: 'before',
          description: 'pagination cursor for the previous page',
          optional: true,
        }),
        order: field({
          name: 'order',
          description: 'sort direction',
          enum: ['asc', 'desc'],
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad-group/create': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Create Ad Group',
    description:
      'Create a new ad group inside a campaign with a bidding configuration.',
    tags: ['openai', 'ads', 'ad-group', 'create', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: `${BASE_URL}/ad_groups`,
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        campaign_id: field({
          name: 'campaignId',
          description: 'the parent campaign id',
        }),
        name: field({
          name: 'name',
          description: 'the ad group name (3-1000 characters)',
        }),
        description: field({
          name: 'description',
          description: 'an optional description for the ad group',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the initial ad group status',
          enum: ['active', 'paused'],
        }),
        bidding_config: {
          billing_event_type: field({
            name: 'billingEventType',
            description: 'the billing event type',
            enum: ['impression'],
            default: 'impression',
          }),
          max_bid_micros: field({
            name: 'maxBidMicros',
            type: 'number',
            description:
              'the maximum bid in micros (1-100,000,000; 1,000,000 micros = 1 unit of currency)',
          }),
        },
      },
    },
  }),

  'openai/ads/ad-group/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Ad Group',
    description: 'Retrieve a single ad group by its id.',
    tags: ['openai', 'ads', 'ad-group', 'fetch', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/ad_groups/',
        field({ name: 'adGroupId', description: 'the ad group id' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad-group/update': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Update Ad Group',
    description: 'Update an existing ad group by its id.',
    tags: ['openai', 'ads', 'ad-group', 'update', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ad_groups/',
        field({ name: 'adGroupId', description: 'the ad group id' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new ad group name (3-1000 characters)',
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'the new ad group description',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the new ad group status',
          enum: ['active', 'paused'],
          optional: true,
        }),
        bidding_config: {
          max_bid_micros: field({
            name: 'maxBidMicros',
            type: 'number',
            description: 'the new maximum bid in micros (1-100,000,000)',
            optional: true,
          }),
        },
      },
    },
  }),

  'openai/ads/ad-group/activate': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Activate Ad Group',
    description: 'Activate (enable) a paused ad group by its id.',
    tags: ['openai', 'ads', 'ad-group', 'activate', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ad_groups/',
        field({ name: 'adGroupId', description: 'the ad group id' }),
        '/activate',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad-group/pause': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Pause Ad Group',
    description: 'Pause an active ad group by its id.',
    tags: ['openai', 'ads', 'ad-group', 'pause', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ad_groups/',
        field({ name: 'adGroupId', description: 'the ad group id' }),
        '/pause',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad-group/archive': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Archive Ad Group',
    description: 'Archive an ad group by its id.',
    tags: ['openai', 'ads', 'ad-group', 'archive', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ad_groups/',
        field({ name: 'adGroupId', description: 'the ad group id' }),
        '/archive',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad-group/insights/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Ad Group Insights',
    description:
      'Retrieve aggregated performance insights for a single ad group by its id.',
    tags: ['openai', 'ads', 'ad-group', 'insights', 'reporting'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/ad_groups/',
        field({ name: 'adGroupId', description: 'the ad group id' }),
        '/insights',
      ],
      query: {
        time_granularity: field({
          name: 'timeGranularity',
          description: 'the bucket size for the report',
          enum: ['hourly', 'daily', 'monthly', 'none'],
          optional: true,
        }),
        aggregation_level: field({
          name: 'aggregationLevel',
          description: 'the row entity type for the report',
          enum: ['ad_group', 'ad'],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return (1-2000)',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- ADS ---

  'openai/ads/ad/list': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'List Ads',
    description: 'List the ads belonging to an ad group.',
    tags: ['openai', 'ads', 'ad', 'list', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: `${BASE_URL}/ads`,
      query: {
        ad_group_id: field({
          name: 'adGroupId',
          description: 'the parent ad group id to list ads for',
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of ads to return (1-500)',
          optional: true,
          default: 20,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
        before: field({
          name: 'before',
          description: 'pagination cursor for the previous page',
          optional: true,
        }),
        order: field({
          name: 'order',
          description: 'sort direction',
          enum: ['asc', 'desc'],
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad/create': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Create Ad',
    description:
      'Create a new ad inside an ad group with a creative. chat_card creatives require a target_url and an uploaded file_id.',
    tags: ['openai', 'ads', 'ad', 'create', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: `${BASE_URL}/ads`,
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        ad_group_id: field({
          name: 'adGroupId',
          description: 'the parent ad group id',
        }),
        name: field({
          name: 'name',
          description: 'the ad name (3-1000 characters)',
        }),
        status: field({
          name: 'status',
          description: 'the initial ad status',
          enum: ['active', 'paused'],
        }),
        creative: {
          type: field({
            name: 'creativeType',
            description: 'the creative type',
            enum: ['chat_card', 'product_ad_template'],
          }),
          title: field({
            name: 'title',
            description: 'the creative title (3-50 characters)',
          }),
          body: field({
            name: 'body',
            description: 'the creative body text (max 100 characters)',
          }),
          price: field({
            name: 'price',
            description:
              'optional price text, or {{product.price}} for product ads',
            optional: true,
          }),
          target_url: field({
            name: 'targetUrl',
            description: 'the destination URL (required for chat_card)',
            optional: true,
          }),
          file_id: field({
            name: 'fileId',
            description:
              'the id of an uploaded creative file (required for chat_card)',
            optional: true,
          }),
        },
      },
    },
  }),

  'openai/ads/ad/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Ad',
    description: 'Retrieve a single ad by its id, including its review status.',
    tags: ['openai', 'ads', 'ad', 'fetch', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: ['/ads/', field({ name: 'adId', description: 'the ad id' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad/update': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Update Ad',
    description:
      'Update an existing ad by its id. Send the full creative object when changing the creative.',
    tags: ['openai', 'ads', 'ad', 'update', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/ads/', field({ name: 'adId', description: 'the ad id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new ad name (3-1000 characters)',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the new ad status',
          enum: ['active', 'paused'],
          optional: true,
        }),
      },
    },
  }),

  'openai/ads/ad/activate': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Activate Ad',
    description: 'Activate (enable) a paused ad by its id.',
    tags: ['openai', 'ads', 'ad', 'activate', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ads/',
        field({ name: 'adId', description: 'the ad id' }),
        '/activate',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad/pause': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Pause Ad',
    description: 'Pause an active ad by its id.',
    tags: ['openai', 'ads', 'ad', 'pause', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ads/',
        field({ name: 'adId', description: 'the ad id' }),
        '/pause',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad/archive': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Archive Ad',
    description: 'Archive an ad by its id.',
    tags: ['openai', 'ads', 'ad', 'archive', 'advertising'],
    secret: '@openai[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/ads/',
        field({ name: 'adId', description: 'the ad id' }),
        '/archive',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'openai/ads/ad/insights/fetch': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Fetch Ad Insights',
    description:
      'Retrieve aggregated performance insights for a single ad by its id.',
    tags: ['openai', 'ads', 'ad', 'insights', 'reporting'],
    secret: '@openai[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/ads/',
        field({ name: 'adId', description: 'the ad id' }),
        '/insights',
      ],
      query: {
        time_granularity: field({
          name: 'timeGranularity',
          description: 'the bucket size for the report',
          enum: ['hourly', 'daily', 'monthly', 'none'],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return (1-2000)',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- GENERIC ---

  'openai/ads/api/call': createFetchTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Call OpenAI Ads API',
    description:
      'Make a generic call to any OpenAI Ads API endpoint by specifying the method, URL and an optional request body. Useful for advanced insights queries and endpoints not covered by the dedicated tools.',
    tags: ['openai', 'ads', 'api', 'call', 'generic'],
    secret: '@openai[ads]',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'the full URL of the OpenAI Ads API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description: 'the request body as JSON text for POST requests',
        optional: true,
      }),
    },
  }),

  // --- PACKS ---

  'pack/openai/ads': createPackTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Install OpenAI Ads Tools',
    description:
      'Installs OpenAI Ads tools into the conversation. You can manage campaigns, ad groups, and ads, and read performance insights through the OpenAI Advertiser API.',
    tags: ['openai', 'ads', 'pack', 'beta'],
    secret: '@openai[ads]',
    instruction: {
      abilities: [
        'openai/ads/account/fetch',
        'openai/ads/account/insights/fetch',
        'openai/ads/campaign/list',
        'openai/ads/campaign/create',
        'openai/ads/campaign/fetch',
        'openai/ads/campaign/update',
        'openai/ads/campaign/activate',
        'openai/ads/campaign/pause',
        'openai/ads/campaign/archive',
        'openai/ads/campaign/insights/fetch',
        'openai/ads/ad-group/list',
        'openai/ads/ad-group/create',
        'openai/ads/ad-group/fetch',
        'openai/ads/ad-group/update',
        'openai/ads/ad-group/activate',
        'openai/ads/ad-group/pause',
        'openai/ads/ad-group/archive',
        'openai/ads/ad-group/insights/fetch',
        'openai/ads/ad/list',
        'openai/ads/ad/create',
        'openai/ads/ad/fetch',
        'openai/ads/ad/update',
        'openai/ads/ad/activate',
        'openai/ads/ad/pause',
        'openai/ads/ad/archive',
        'openai/ads/ad/insights/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/openai/ads[read-only]': createPackTemplate({
    provider: 'openai',
    icon: ICON,
    name: 'Install OpenAI Ads Reporting Tools',
    description:
      'Installs read-only OpenAI Ads tools into the conversation. You can list and inspect campaigns, ad groups, and ads, and read performance insights without making changes.',
    tags: ['openai', 'ads', 'pack', 'beta'],
    secret: '@openai[ads]',
    instruction: {
      abilities: [
        'openai/ads/account/fetch',
        'openai/ads/account/insights/fetch',
        'openai/ads/campaign/list',
        'openai/ads/campaign/fetch',
        'openai/ads/campaign/insights/fetch',
        'openai/ads/ad-group/list',
        'openai/ads/ad-group/fetch',
        'openai/ads/ad-group/insights/fetch',
        'openai/ads/ad/list',
        'openai/ads/ad/fetch',
        'openai/ads/ad/insights/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
