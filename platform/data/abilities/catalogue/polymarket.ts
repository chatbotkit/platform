import { createFetchTemplate, field } from '@/lib/ability.template'

const abilities = {
  'polymarket/market/list': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'List Polymarket Markets',
    description:
      'List Polymarket markets from the public Gamma API with common filters for discovery and browsing',
    tags: ['polymarket', 'markets', 'gamma', 'prediction-markets'],
    instruction: {
      method: 'GET',
      url: 'https://gamma-api.polymarket.com',
      path: ['/markets'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of markets to return',
          optional: true,
          default: 25,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of markets to skip before returning results',
          optional: true,
          default: 0,
        }),
        order: field({
          name: 'order',
          description: 'field name to order by, such as volume or liquidity',
          optional: true,
        }),
        ascending: field({
          name: 'ascending',
          type: 'boolean',
          description: 'sort results in ascending order',
          optional: true,
          default: false,
        }),
        tag_id: field({
          name: 'tagId',
          type: 'number',
          description: 'filter markets by a specific tag id',
          optional: true,
        }),
        slug: field({
          name: 'slug',
          description:
            'filter by one or more market slugs as a comma-separated string',
          optional: true,
        }),
        condition_ids: field({
          name: 'conditionIds',
          description:
            'filter by one or more market condition ids as a comma-separated string',
          optional: true,
        }),
        clob_token_ids: field({
          name: 'clobTokenIds',
          description:
            'filter by one or more CLOB token ids as a comma-separated string',
          optional: true,
        }),
        closed: field({
          name: 'closed',
          type: 'boolean',
          description: 'filter for closed or open markets',
          optional: true,
        }),
      },
    },
  }),

  'polymarket/market/fetch[by-id]': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Get Polymarket Market By ID',
    description: 'Fetch a single Polymarket market by its Gamma market id',
    tags: ['polymarket', 'market', 'gamma', 'fetch'],
    instruction: {
      method: 'GET',
      url: 'https://gamma-api.polymarket.com',
      path: [
        '/markets/',
        field({
          name: 'id',
          description: 'the Polymarket market id',
          placeholder: true,
        }),
      ],
      query: {
        include_tag: field({
          name: 'includeTag',
          type: 'boolean',
          description: 'include market tag objects in the response',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'polymarket/market/fetch[by-slug]': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Get Polymarket Market By Slug',
    description: 'Fetch a single Polymarket market by its public slug',
    tags: ['polymarket', 'market', 'gamma', 'slug'],
    instruction: {
      method: 'GET',
      url: 'https://gamma-api.polymarket.com',
      path: [
        '/markets/slug/',
        field({
          name: 'slug',
          description: 'the public Polymarket market slug',
          placeholder: true,
        }),
      ],
      query: {
        include_tag: field({
          name: 'includeTag',
          type: 'boolean',
          description: 'include market tag objects in the response',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'polymarket/event/list': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'List Polymarket Events',
    description:
      'List Polymarket events from the public Gamma API with common discovery filters',
    tags: ['polymarket', 'events', 'gamma', 'prediction-markets'],
    instruction: {
      method: 'GET',
      url: 'https://gamma-api.polymarket.com',
      path: ['/events'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of events to return',
          optional: true,
          default: 25,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of events to skip before returning results',
          optional: true,
          default: 0,
        }),
        order: field({
          name: 'order',
          description: 'field name to order by',
          optional: true,
        }),
        ascending: field({
          name: 'ascending',
          type: 'boolean',
          description: 'sort results in ascending order',
          optional: true,
          default: false,
        }),
        tag_id: field({
          name: 'tagId',
          type: 'number',
          description: 'filter events by tag id',
          optional: true,
        }),
        active: field({
          name: 'active',
          type: 'boolean',
          description: 'filter only active or inactive events',
          optional: true,
        }),
        featured: field({
          name: 'featured',
          type: 'boolean',
          description: 'filter featured events',
          optional: true,
        }),
        archived: field({
          name: 'archived',
          type: 'boolean',
          description: 'filter archived events',
          optional: true,
        }),
        closed: field({
          name: 'closed',
          type: 'boolean',
          description: 'filter closed or open events',
          optional: true,
        }),
      },
    },
  }),

  'polymarket/event/fetch[by-id]': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Get Polymarket Event By ID',
    description: 'Fetch a single Polymarket event by its Gamma event id',
    tags: ['polymarket', 'event', 'gamma', 'fetch'],
    instruction: {
      method: 'GET',
      url: 'https://gamma-api.polymarket.com',
      path: [
        '/events/',
        field({
          name: 'id',
          description: 'the Polymarket event id',
          placeholder: true,
        }),
      ],
      query: {
        include_chat: field({
          name: 'includeChat',
          type: 'boolean',
          description: 'include event chat metadata',
          optional: true,
          default: false,
        }),
        include_template: field({
          name: 'includeTemplate',
          type: 'boolean',
          description: 'include related template metadata',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'polymarket/discovery/search': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Search Polymarket Markets, Events, and Profiles',
    description:
      'Run a public search across Polymarket markets, events, tags, and profiles',
    tags: ['polymarket', 'search', 'gamma', 'discovery'],
    instruction: {
      method: 'GET',
      url: 'https://gamma-api.polymarket.com',
      path: ['/public-search'],
      query: {
        q: field({
          name: 'query',
          description:
            'the search query to run against Polymarket discovery data',
          placeholder: true,
        }),
        cache: field({
          name: 'cache',
          type: 'boolean',
          description: 'allow cached results',
          optional: true,
        }),
        events_status: field({
          name: 'eventsStatus',
          description: 'filter events by status',
          optional: true,
        }),
        limit_per_type: field({
          name: 'limitPerType',
          type: 'number',
          description: 'maximum results to return per result type',
          optional: true,
          default: 10,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'result page number',
          optional: true,
          default: 1,
        }),
        events_tag: field({
          name: 'eventsTag',
          description: 'filter results to a specific event tag slug',
          optional: true,
        }),
        keep_closed_markets: field({
          name: 'keepClosedMarkets',
          type: 'number',
          description: 'include closed markets when set to 1',
          optional: true,
        }),
        sort: field({
          name: 'sort',
          description: 'result sort field',
          optional: true,
        }),
        ascending: field({
          name: 'ascending',
          type: 'boolean',
          description: 'sort results in ascending order',
          optional: true,
        }),
        search_tags: field({
          name: 'searchTags',
          type: 'boolean',
          description: 'include tag matches in the search',
          optional: true,
          default: true,
        }),
        search_profiles: field({
          name: 'searchProfiles',
          type: 'boolean',
          description: 'include profile matches in the search',
          optional: true,
          default: true,
        }),
        recurrence: field({
          name: 'recurrence',
          description: 'filter recurring events by recurrence type',
          optional: true,
        }),
        exclude_tag_id: field({
          name: 'excludeTagId',
          description:
            'exclude one or more tag ids as a comma-separated string',
          optional: true,
        }),
        optimized: field({
          name: 'optimized',
          type: 'boolean',
          description: 'use optimized search results when available',
          optional: true,
          default: true,
        }),
      },
    },
  }),

  'polymarket/trade/list': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'List Polymarket Trades',
    description:
      'List public Polymarket trades for a user, event ids, or market condition ids',
    tags: ['polymarket', 'trades', 'data-api', 'profile'],
    instruction: {
      method: 'GET',
      url: 'https://data-api.polymarket.com',
      path: ['/trades'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of trades to return',
          optional: true,
          default: 100,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of trades to skip before returning results',
          optional: true,
          default: 0,
        }),
        takerOnly: field({
          name: 'takerOnly',
          type: 'boolean',
          description: 'restrict results to taker-side trades only',
          optional: true,
          default: true,
        }),
        filterType: field({
          name: 'filterType',
          description: 'optional trade filter type',
          optional: true,
          enum: ['CASH', 'TOKENS'],
        }),
        filterAmount: field({
          name: 'filterAmount',
          type: 'number',
          description: 'optional filter threshold paired with filterType',
          optional: true,
        }),
        market: field({
          name: 'market',
          description:
            'one or more condition ids as a comma-separated string, mutually exclusive with eventId',
          optional: true,
        }),
        eventId: field({
          name: 'eventId',
          description:
            'one or more event ids as a comma-separated string, mutually exclusive with market',
          optional: true,
        }),
        user: field({
          name: 'user',
          description: 'user profile wallet address to filter trades for',
          optional: true,
          placeholder: true,
        }),
        side: field({
          name: 'side',
          description: 'optional trade side filter',
          optional: true,
          enum: ['BUY', 'SELL'],
        }),
      },
    },
  }),

  'polymarket/activity/list': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'List Polymarket User Activity',
    description:
      'List public user activity such as trades, splits, merges, rewards, and redemptions from the Data API',
    tags: ['polymarket', 'activity', 'data-api', 'profile'],
    instruction: {
      method: 'GET',
      url: 'https://data-api.polymarket.com',
      path: ['/activity'],
      query: {
        user: field({
          name: 'user',
          description: 'user profile wallet address',
          placeholder: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of activity items to return',
          optional: true,
          default: 100,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description:
            'number of activity items to skip before returning results',
          optional: true,
          default: 0,
        }),
        market: field({
          name: 'market',
          description:
            'one or more condition ids as a comma-separated string, mutually exclusive with eventId',
          optional: true,
        }),
        eventId: field({
          name: 'eventId',
          description:
            'one or more event ids as a comma-separated string, mutually exclusive with market',
          optional: true,
        }),
        type: field({
          name: 'type',
          description:
            'one or more activity types as a comma-separated string, such as TRADE or REDEEM',
          optional: true,
        }),
        start: field({
          name: 'start',
          type: 'number',
          description: 'filter items after this unix timestamp',
          optional: true,
        }),
        end: field({
          name: 'end',
          type: 'number',
          description: 'filter items before this unix timestamp',
          optional: true,
        }),
        sortBy: field({
          name: 'sortBy',
          description: 'field used to sort activity results',
          optional: true,
          enum: ['TIMESTAMP', 'TOKENS', 'CASH'],
          default: 'TIMESTAMP',
        }),
        sortDirection: field({
          name: 'sortDirection',
          description: 'direction used to sort activity results',
          optional: true,
          enum: ['ASC', 'DESC'],
          default: 'DESC',
        }),
        side: field({
          name: 'side',
          description: 'optional trade side filter',
          optional: true,
          enum: ['BUY', 'SELL'],
        }),
      },
    },
  }),

  'polymarket/position/list': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'List Polymarket User Positions',
    description:
      'List current Polymarket positions for a public user wallet from the Data API',
    tags: ['polymarket', 'positions', 'data-api', 'portfolio'],
    instruction: {
      method: 'GET',
      url: 'https://data-api.polymarket.com',
      path: ['/positions'],
      query: {
        user: field({
          name: 'user',
          description: 'user profile wallet address',
          placeholder: true,
        }),
        market: field({
          name: 'market',
          description:
            'one or more condition ids as a comma-separated string, mutually exclusive with eventId',
          optional: true,
        }),
        eventId: field({
          name: 'eventId',
          description:
            'one or more event ids as a comma-separated string, mutually exclusive with market',
          optional: true,
        }),
        sizeThreshold: field({
          name: 'sizeThreshold',
          type: 'number',
          description: 'minimum position size to include',
          optional: true,
          default: 1,
        }),
        redeemable: field({
          name: 'redeemable',
          type: 'boolean',
          description: 'filter redeemable positions only',
          optional: true,
          default: false,
        }),
        mergeable: field({
          name: 'mergeable',
          type: 'boolean',
          description: 'filter mergeable positions only',
          optional: true,
          default: false,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of positions to return',
          optional: true,
          default: 100,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of positions to skip before returning results',
          optional: true,
          default: 0,
        }),
        sortBy: field({
          name: 'sortBy',
          description: 'field used to sort position results',
          optional: true,
          enum: [
            'CURRENT',
            'INITIAL',
            'TOKENS',
            'CASHPNL',
            'PERCENTPNL',
            'TITLE',
            'RESOLVING',
            'PRICE',
            'AVGPRICE',
          ],
          default: 'TOKENS',
        }),
        sortDirection: field({
          name: 'sortDirection',
          description: 'direction used to sort position results',
          optional: true,
          enum: ['ASC', 'DESC'],
          default: 'DESC',
        }),
        title: field({
          name: 'title',
          description: 'filter positions by market title text',
          optional: true,
        }),
      },
    },
  }),

  'polymarket/orderbook/fetch': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Get Polymarket Order Book',
    description:
      'Fetch the public CLOB order book summary for a specific Polymarket token id',
    tags: ['polymarket', 'orderbook', 'clob', 'market-data'],
    instruction: {
      method: 'GET',
      url: 'https://clob.polymarket.com',
      path: ['/book'],
      query: {
        token_id: field({
          name: 'tokenId',
          description: 'the Polymarket token id (asset id)',
          placeholder: true,
        }),
      },
    },
  }),

  'polymarket/midpoint/fetch': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Get Polymarket Midpoint Price',
    description:
      'Fetch the public midpoint price for a specific Polymarket token id from the CLOB API',
    tags: ['polymarket', 'midpoint', 'clob', 'pricing'],
    instruction: {
      method: 'GET',
      url: 'https://clob.polymarket.com',
      path: ['/midpoint'],
      query: {
        token_id: field({
          name: 'tokenId',
          description: 'the Polymarket token id (asset id)',
          placeholder: true,
        }),
      },
    },
  }),

  'polymarket/price-history/fetch': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Get Polymarket Price History',
    description:
      'Fetch historical price data for a Polymarket token id from the public CLOB API',
    tags: ['polymarket', 'price-history', 'clob', 'pricing'],
    instruction: {
      method: 'GET',
      url: 'https://clob.polymarket.com',
      path: ['/prices-history'],
      query: {
        market: field({
          name: 'market',
          description: 'the Polymarket token id (asset id) to query',
          placeholder: true,
        }),
        startTs: field({
          name: 'startTs',
          type: 'number',
          description: 'filter items after this unix timestamp',
          optional: true,
        }),
        endTs: field({
          name: 'endTs',
          type: 'number',
          description: 'filter items before this unix timestamp',
          optional: true,
        }),
        interval: field({
          name: 'interval',
          description: 'time interval for price aggregation',
          optional: true,
          enum: ['max', 'all', '1m', '1w', '1d', '6h', '1h'],
          default: 'max',
        }),
        fidelity: field({
          name: 'fidelity',
          type: 'number',
          description: 'accuracy of the data expressed in minutes',
          optional: true,
          default: 1,
        }),
      },
    },
  }),

  'polymarket/api/call': createFetchTemplate({
    provider: 'polymarket',
    icon: '@logo/polymarket.com',
    name: 'Call Polymarket API',
    description:
      'Make a generic call to any Polymarket API endpoint by supplying the method, URL, headers, and optional JSON body',
    tags: ['polymarket', 'api', 'call', 'generic'],
    instruction: {
      method: field({
        name: 'method',
        description:
          'HTTP method to use, such as GET, POST, PUT, PATCH, or DELETE',
      }),
      url: field({
        name: 'url',
        description: 'the full Polymarket API URL to call',
      }),
      headers: {
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
