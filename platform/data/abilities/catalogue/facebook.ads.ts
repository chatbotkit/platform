import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

// @note base URL for the Facebook Marketing API. It is served from the Graph
// API host and versioned alongside it. Ad account scoped endpoints are keyed by
// the `act_<ad_account_id>` node, while campaigns, ad sets and ads are addressed
// directly by their globally-unique node id.
// @see https://developers.facebook.com/docs/marketing-apis

const BASE_URL = 'https://graph.facebook.com/v21.0'

const ICON = '@logo/facebook.com'

/**
 * Catalogue of Facebook Ads abilities for managing campaigns, ad sets, ads and
 * insights through the Facebook Marketing API.
 */
const abilities = {
  // --- AD ACCOUNT ---

  'facebook/ads/account/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Ad Account',
    description:
      'Retrieve a Facebook ad account by its id, including its name, status, currency and timezone.',
    tags: ['facebook', 'ads', 'account', 'fetch', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,account_status,currency,timezone_name,amount_spent',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/account/insights/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Ad Account Insights',
    description:
      'Retrieve aggregated performance insights (impressions, clicks, spend, ctr, cpc, cpm, reach) for a whole ad account.',
    tags: ['facebook', 'ads', 'account', 'insights', 'reporting'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/insights',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of metrics to return, e.g. impressions,clicks,spend,ctr,cpc,cpm,reach',
          optional: true,
        }),
        level: field({
          name: 'level',
          description: 'the aggregation level for the report',
          enum: ['account', 'campaign', 'adset', 'ad'],
          optional: true,
        }),
        date_preset: field({
          name: 'datePreset',
          description: 'a relative reporting period',
          enum: [
            'today',
            'yesterday',
            'last_7d',
            'last_14d',
            'last_28d',
            'last_30d',
            'last_90d',
            'this_month',
            'last_month',
            'maximum',
          ],
          optional: true,
        }),
        time_range: field({
          name: 'timeRange',
          description:
            'an explicit reporting window as a JSON object, e.g. {"since":"2026-01-01","until":"2026-01-31"}',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return',
          optional: true,
          default: 25,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- CAMPAIGNS ---

  'facebook/ads/campaign/list': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'List Campaigns',
    description: 'List the campaigns in an ad account with pagination support.',
    tags: ['facebook', 'ads', 'campaign', 'list', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/campaigns',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,status,objective,daily_budget',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of campaigns to return',
          optional: true,
          default: 25,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/campaign/create': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Create Campaign',
    description:
      'Create a new campaign in an ad account. special_ad_categories is required by Facebook - use an empty list for standard campaigns.',
    tags: ['facebook', 'ads', 'campaign', 'create', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/campaigns',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the campaign name',
        }),
        objective: field({
          name: 'objective',
          description: 'the campaign objective',
          enum: [
            'OUTCOME_AWARENESS',
            'OUTCOME_TRAFFIC',
            'OUTCOME_ENGAGEMENT',
            'OUTCOME_LEADS',
            'OUTCOME_APP_PROMOTION',
            'OUTCOME_SALES',
          ],
        }),
        status: field({
          name: 'status',
          description: 'the initial campaign status',
          enum: ['ACTIVE', 'PAUSED'],
        }),
        special_ad_categories: array({
          name: 'specialAdCategories',
          description:
            'the special ad categories that apply to this campaign; use an empty list for standard campaigns',
          items: field({
            name: 'specialAdCategory',
            description: 'a special ad category',
            enum: [
              'NONE',
              'EMPLOYMENT',
              'HOUSING',
              'CREDIT',
              'ISSUES_ELECTIONS_POLITICS',
              'ONLINE_GAMBLING_AND_GAMING',
              'FINANCIAL_PRODUCTS_SERVICES',
            ],
          }),
        }),
        daily_budget: field({
          name: 'dailyBudget',
          type: 'number',
          description:
            'an optional daily budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        lifetime_budget: field({
          name: 'lifetimeBudget',
          type: 'number',
          description:
            'an optional lifetime budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        bid_strategy: field({
          name: 'bidStrategy',
          description: 'an optional bid strategy for the campaign',
          enum: [
            'LOWEST_COST_WITHOUT_CAP',
            'LOWEST_COST_WITH_BID_CAP',
            'COST_CAP',
          ],
          optional: true,
        }),
      },
    },
  }),

  'facebook/ads/campaign/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Campaign',
    description: 'Retrieve a single campaign by its id.',
    tags: ['facebook', 'ads', 'campaign', 'fetch', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,status,objective,daily_budget,lifetime_budget',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/campaign/update': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Update Campaign',
    description: 'Update an existing campaign by its id.',
    tags: ['facebook', 'ads', 'campaign', 'update', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new campaign name',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the new campaign status',
          enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
          optional: true,
        }),
        daily_budget: field({
          name: 'dailyBudget',
          type: 'number',
          description:
            'the new daily budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        lifetime_budget: field({
          name: 'lifetimeBudget',
          type: 'number',
          description:
            'the new lifetime budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
      },
    },
  }),

  'facebook/ads/campaign/activate': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Activate Campaign',
    description: 'Activate (enable) a paused campaign by its id.',
    tags: ['facebook', 'ads', 'campaign', 'activate', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'ACTIVE',
      },
    },
  }),

  'facebook/ads/campaign/pause': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Pause Campaign',
    description: 'Pause an active campaign by its id.',
    tags: ['facebook', 'ads', 'campaign', 'pause', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'PAUSED',
      },
    },
  }),

  'facebook/ads/campaign/archive': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Archive Campaign',
    description: 'Archive a campaign by its id.',
    tags: ['facebook', 'ads', 'campaign', 'archive', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'campaignId', description: 'the campaign id' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'ARCHIVED',
      },
    },
  }),

  'facebook/ads/campaign/insights/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Campaign Insights',
    description:
      'Retrieve aggregated performance insights for a single campaign by its id.',
    tags: ['facebook', 'ads', 'campaign', 'insights', 'reporting'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'campaignId', description: 'the campaign id' }),
        '/insights',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of metrics to return, e.g. impressions,clicks,spend,ctr,cpc,cpm,reach',
          optional: true,
        }),
        date_preset: field({
          name: 'datePreset',
          description: 'a relative reporting period',
          enum: [
            'today',
            'yesterday',
            'last_7d',
            'last_14d',
            'last_28d',
            'last_30d',
            'last_90d',
            'this_month',
            'last_month',
            'maximum',
          ],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return',
          optional: true,
          default: 25,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- AD SETS ---

  'facebook/ads/ad-set/list': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'List Ad Sets',
    description: 'List the ad sets in an ad account with pagination support.',
    tags: ['facebook', 'ads', 'ad-set', 'list', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/adsets',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,status,campaign_id,optimization_goal,billing_event',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of ad sets to return',
          optional: true,
          default: 25,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/ad-set/create': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Create Ad Set',
    description:
      'Create a new ad set inside a campaign with a bidding, optimization and targeting configuration.',
    tags: ['facebook', 'ads', 'ad-set', 'create', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/adsets',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the ad set name',
        }),
        campaign_id: field({
          name: 'campaignId',
          description: 'the parent campaign id',
        }),
        status: field({
          name: 'status',
          description: 'the initial ad set status',
          enum: ['ACTIVE', 'PAUSED'],
        }),
        billing_event: field({
          name: 'billingEvent',
          description: 'the event that the account is billed on',
          enum: [
            'IMPRESSIONS',
            'LINK_CLICKS',
            'POST_ENGAGEMENT',
            'PAGE_LIKES',
            'THRUPLAY',
          ],
        }),
        optimization_goal: field({
          name: 'optimizationGoal',
          description: 'the goal the delivery system optimizes for',
          enum: [
            'REACH',
            'IMPRESSIONS',
            'LINK_CLICKS',
            'LANDING_PAGE_VIEWS',
            'OFFSITE_CONVERSIONS',
            'POST_ENGAGEMENT',
            'THRUPLAY',
            'LEAD_GENERATION',
          ],
        }),
        bid_amount: field({
          name: 'bidAmount',
          type: 'number',
          description:
            'an optional bid cap in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        daily_budget: field({
          name: 'dailyBudget',
          type: 'number',
          description:
            'an optional daily budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        lifetime_budget: field({
          name: 'lifetimeBudget',
          type: 'number',
          description:
            'an optional lifetime budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        targeting: object({
          name: 'targeting',
          description: 'the audience targeting specification for the ad set',
          shape: {
            geo_locations: object({
              name: 'geoLocations',
              description: 'the geographic targeting for the ad set',
              shape: {
                countries: array({
                  name: 'targetCountries',
                  description:
                    'the ISO 3166-1 alpha-2 country codes to target, e.g. US, GB',
                  items: field({
                    name: 'targetCountry',
                    description: 'an ISO 3166-1 alpha-2 country code',
                  }),
                }),
              },
            }),
            age_min: field({
              name: 'ageMin',
              type: 'number',
              description: 'the minimum audience age (13-65)',
              optional: true,
            }),
            age_max: field({
              name: 'ageMax',
              type: 'number',
              description: 'the maximum audience age (13-65)',
              optional: true,
            }),
          },
        }),
      },
    },
  }),

  'facebook/ads/ad-set/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Ad Set',
    description: 'Retrieve a single ad set by its id.',
    tags: ['facebook', 'ads', 'ad-set', 'fetch', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: ['/', field({ name: 'adSetId', description: 'the ad set id' })],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,status,campaign_id,optimization_goal,billing_event,targeting',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/ad-set/update': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Update Ad Set',
    description: 'Update an existing ad set by its id.',
    tags: ['facebook', 'ads', 'ad-set', 'update', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adSetId', description: 'the ad set id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new ad set name',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the new ad set status',
          enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
          optional: true,
        }),
        bid_amount: field({
          name: 'bidAmount',
          type: 'number',
          description:
            'the new bid cap in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        daily_budget: field({
          name: 'dailyBudget',
          type: 'number',
          description:
            'the new daily budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
        lifetime_budget: field({
          name: 'lifetimeBudget',
          type: 'number',
          description:
            'the new lifetime budget in the account currency minor unit (e.g. cents)',
          optional: true,
        }),
      },
    },
  }),

  'facebook/ads/ad-set/activate': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Activate Ad Set',
    description: 'Activate (enable) a paused ad set by its id.',
    tags: ['facebook', 'ads', 'ad-set', 'activate', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adSetId', description: 'the ad set id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'ACTIVE',
      },
    },
  }),

  'facebook/ads/ad-set/pause': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Pause Ad Set',
    description: 'Pause an active ad set by its id.',
    tags: ['facebook', 'ads', 'ad-set', 'pause', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adSetId', description: 'the ad set id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'PAUSED',
      },
    },
  }),

  'facebook/ads/ad-set/archive': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Archive Ad Set',
    description: 'Archive an ad set by its id.',
    tags: ['facebook', 'ads', 'ad-set', 'archive', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adSetId', description: 'the ad set id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'ARCHIVED',
      },
    },
  }),

  'facebook/ads/ad-set/insights/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Ad Set Insights',
    description:
      'Retrieve aggregated performance insights for a single ad set by its id.',
    tags: ['facebook', 'ads', 'ad-set', 'insights', 'reporting'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'adSetId', description: 'the ad set id' }),
        '/insights',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of metrics to return, e.g. impressions,clicks,spend,ctr,cpc,cpm,reach',
          optional: true,
        }),
        date_preset: field({
          name: 'datePreset',
          description: 'a relative reporting period',
          enum: [
            'today',
            'yesterday',
            'last_7d',
            'last_14d',
            'last_28d',
            'last_30d',
            'last_90d',
            'this_month',
            'last_month',
            'maximum',
          ],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return',
          optional: true,
          default: 25,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- ADS ---

  'facebook/ads/ad/list': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'List Ads',
    description: 'List the ads in an ad account with pagination support.',
    tags: ['facebook', 'ads', 'ad', 'list', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/ads',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,status,adset_id,creative',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of ads to return',
          optional: true,
          default: 25,
        }),
        after: field({
          name: 'after',
          description: 'pagination cursor for the next page',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/ad/create': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Create Ad',
    description:
      'Create a new ad inside an ad set that references an existing ad creative by its id.',
    tags: ['facebook', 'ads', 'ad', 'create', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/act_',
        field({
          name: 'adAccountId',
          description:
            'the ad account id (the numeric id without the act_ prefix)',
        }),
        '/ads',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the ad name',
        }),
        adset_id: field({
          name: 'adSetId',
          description: 'the parent ad set id',
        }),
        status: field({
          name: 'status',
          description: 'the initial ad status',
          enum: ['ACTIVE', 'PAUSED'],
        }),
        creative: object({
          name: 'creative',
          description: 'the creative to attach to the ad',
          shape: {
            creative_id: field({
              name: 'creativeId',
              description: 'the id of an existing ad creative',
            }),
          },
        }),
      },
    },
  }),

  'facebook/ads/ad/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Ad',
    description: 'Retrieve a single ad by its id.',
    tags: ['facebook', 'ads', 'ad', 'fetch', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: ['/', field({ name: 'adId', description: 'the ad id' })],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of fields to return, e.g. name,status,adset_id,creative,effective_status',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'facebook/ads/ad/update': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Update Ad',
    description: 'Update an existing ad by its id.',
    tags: ['facebook', 'ads', 'ad', 'update', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adId', description: 'the ad id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new ad name',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'the new ad status',
          enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
          optional: true,
        }),
      },
    },
  }),

  'facebook/ads/ad/activate': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Activate Ad',
    description: 'Activate (enable) a paused ad by its id.',
    tags: ['facebook', 'ads', 'ad', 'activate', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adId', description: 'the ad id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'ACTIVE',
      },
    },
  }),

  'facebook/ads/ad/pause': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Pause Ad',
    description: 'Pause an active ad by its id.',
    tags: ['facebook', 'ads', 'ad', 'pause', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adId', description: 'the ad id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'PAUSED',
      },
    },
  }),

  'facebook/ads/ad/archive': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Archive Ad',
    description: 'Archive an ad by its id.',
    tags: ['facebook', 'ads', 'ad', 'archive', 'advertising'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: ['/', field({ name: 'adId', description: 'the ad id' })],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'ARCHIVED',
      },
    },
  }),

  'facebook/ads/ad/insights/fetch': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Fetch Ad Insights',
    description:
      'Retrieve aggregated performance insights for a single ad by its id.',
    tags: ['facebook', 'ads', 'ad', 'insights', 'reporting'],
    secret: '@facebook[ads]',
    instruction: {
      method: 'GET',
      url: BASE_URL,
      path: [
        '/',
        field({ name: 'adId', description: 'the ad id' }),
        '/insights',
      ],
      query: {
        fields: field({
          name: 'fields',
          description:
            'a comma-separated list of metrics to return, e.g. impressions,clicks,spend,ctr,cpc,cpm,reach',
          optional: true,
        }),
        date_preset: field({
          name: 'datePreset',
          description: 'a relative reporting period',
          enum: [
            'today',
            'yesterday',
            'last_7d',
            'last_14d',
            'last_28d',
            'last_30d',
            'last_90d',
            'this_month',
            'last_month',
            'maximum',
          ],
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'the maximum number of rows to return',
          optional: true,
          default: 25,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- GENERIC ---

  'facebook/ads/api/call': createFetchTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Call Facebook Ads API',
    description:
      'Make a generic call to any Facebook Marketing API endpoint by specifying the method, URL and an optional request body. Useful for advanced targeting, creatives and endpoints not covered by the dedicated tools.',
    tags: ['facebook', 'ads', 'api', 'call', 'generic'],
    secret: '@facebook[ads]',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description:
          'the full URL of the Facebook Marketing API endpoint to call',
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

  'pack/facebook/ads': createPackTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Install Facebook Ads Tools',
    description:
      'Installs Facebook Ads tools into the conversation. You can manage campaigns, ad sets, and ads, and read performance insights through the Facebook Marketing API.',
    tags: ['facebook', 'ads', 'pack', 'beta'],
    secret: '@facebook[ads]',
    instruction: {
      abilities: [
        'facebook/ads/account/fetch',
        'facebook/ads/account/insights/fetch',
        'facebook/ads/campaign/list',
        'facebook/ads/campaign/create',
        'facebook/ads/campaign/fetch',
        'facebook/ads/campaign/update',
        'facebook/ads/campaign/activate',
        'facebook/ads/campaign/pause',
        'facebook/ads/campaign/archive',
        'facebook/ads/campaign/insights/fetch',
        'facebook/ads/ad-set/list',
        'facebook/ads/ad-set/create',
        'facebook/ads/ad-set/fetch',
        'facebook/ads/ad-set/update',
        'facebook/ads/ad-set/activate',
        'facebook/ads/ad-set/pause',
        'facebook/ads/ad-set/archive',
        'facebook/ads/ad-set/insights/fetch',
        'facebook/ads/ad/list',
        'facebook/ads/ad/create',
        'facebook/ads/ad/fetch',
        'facebook/ads/ad/update',
        'facebook/ads/ad/activate',
        'facebook/ads/ad/pause',
        'facebook/ads/ad/archive',
        'facebook/ads/ad/insights/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/facebook/ads[read-only]': createPackTemplate({
    provider: 'facebook',
    icon: ICON,
    name: 'Install Facebook Ads Reporting Tools',
    description:
      'Installs read-only Facebook Ads tools into the conversation. You can list and inspect campaigns, ad sets, and ads, and read performance insights without making changes.',
    tags: ['facebook', 'ads', 'pack', 'beta'],
    secret: '@facebook[ads]',
    instruction: {
      abilities: [
        'facebook/ads/account/fetch',
        'facebook/ads/account/insights/fetch',
        'facebook/ads/campaign/list',
        'facebook/ads/campaign/fetch',
        'facebook/ads/campaign/insights/fetch',
        'facebook/ads/ad-set/list',
        'facebook/ads/ad-set/fetch',
        'facebook/ads/ad-set/insights/fetch',
        'facebook/ads/ad/list',
        'facebook/ads/ad/fetch',
        'facebook/ads/ad/insights/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
