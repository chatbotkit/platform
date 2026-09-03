import {
  array,
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

import type {
  APOLLO_API_PATH,
  PROXY_HANDLER_NAME,
  ProxySchema,
} from '@/pages/api/auxiliary/skillset/ability/apollo/handler'

// @note these abilities route through our auxiliary proxy handler, which
// injects the Apollo API key (X-Access-Token -> X-Api-Key), expands `[]` query
// params and slims down Apollo's response. Ultimately they should be rewritten
// not to use the auxiliary proxy once the fetch template can do those natively.

const APOLLO_PROXY_PATH =
  '/api/auxiliary/skillset/ability/apollo/handler' satisfies typeof APOLLO_API_PATH

const PROXY_HANDLER = 'proxy' satisfies typeof PROXY_HANDLER_NAME

const abilities = {
  'apollo/people/search': createAuxiliaryTemplate<ProxySchema>({
    provider: 'apollo',
    icon: '@logo/apollo.io',
    name: 'Search People',
    description: 'Search for people using Apollo.io.',
    tags: ['apollo', 'people', 'search'],
    commentary:
      '**Credits:** Does not consume Apollo credits. Returns matching prospects only - no emails or phone numbers. Use an enrichment ability to reveal contact details. Requires a master Apollo API key.',
    secret: '@platform/apollo',
    path: APOLLO_PROXY_PATH,
    handler: PROXY_HANDLER,
    instruction: {
      method: 'POST',
      // @note api_search is the API-optimised prospect search: it does NOT
      // consume credits and does NOT return emails/phones (enrich separately)
      url: '/api/v1/mixed_people/api_search',
      query: {
        'person_titles[]': field({
          name: 'person_titles',
          description: 'comma-separated list of person titles to search for',
        }),
        'person_locations[]': field({
          name: 'person_locations',
          description: 'comma-separated list of person locations to search for',
        }),
        'person_seniorities[]': field({
          name: 'person_seniorities',
          description:
            'comma-separated list of person seniorities to search for. Only these exact values are allowed: owner, founder, c_suite, vp, head, director, manager, senior, entry, intern (e.g. use "c_suite" for C-level, not "c_level").',
        }),
        q_keywords: field({
          name: 'q_keywords',
          description:
            'a string of words over which we want to filter the results',
        }),
        include_similar_titles: field({
          name: 'include_similar_titles',
          description:
            'whether to also match similar job titles - pass "true" or "false" (Apollo defaults to true)',
          optional: true,
        }),
        'organization_locations[]': field({
          name: 'organization_locations',
          description:
            "comma-separated list of locations of the person's employer headquarters to search for",
          optional: true,
        }),
        'q_organization_domains_list[]': field({
          name: 'q_organization_domains_list',
          description:
            'comma-separated list of employer domains to restrict the search to (e.g. apollo.io, google.com)',
          optional: true,
        }),
        'organization_ids[]': field({
          name: 'organization_ids',
          description:
            'comma-separated list of Apollo organization ids (from the organization search ability) to restrict the search to',
          optional: true,
        }),
        'organization_num_employees_ranges[]': field({
          name: 'organization_num_employees_ranges',
          description:
            'comma-separated list of employer headcount ranges to search for, each written as min-max with a hyphen, e.g. "1-10, 11-50, 51-200, 1001-5000"',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          description: 'number of results to return per page, up to 100',
          optional: true,
        }),
        page: field({
          name: 'page',
          description: 'page number to retrieve when paging through results',
          optional: true,
        }),
        'contact_email_status[]': 'verified',
      },
      data: {},
      keys: ['contacts', 'people'],
    },
    options: {
      auth: 'internal',
    },
  }),

  'apollo/people/match': createAuxiliaryTemplate<ProxySchema>({
    provider: 'apollo',
    icon: '@logo/apollo.io',
    name: 'Enrich Person',
    description:
      'Enrich a person by their Apollo ID to reveal their full profile and contact details, including email. Use the ID returned by the people search.',
    tags: ['apollo', 'people', 'enrich', 'match'],
    commentary:
      '**Credits:** Consumes Apollo credits on each call. Pass the `id` from a people search result. Returns the professional email by default; set reveal_personal_emails to also surface personal emails (consumes additional credits and is suppressed in GDPR regions).',
    secret: '@platform/apollo',
    path: APOLLO_PROXY_PATH,
    handler: PROXY_HANDLER,
    instruction: {
      method: 'POST',
      url: '/api/v1/people/match',
      query: {
        id: field({
          name: 'id',
          description:
            'the Apollo person id returned by the people search ability',
        }),
        reveal_personal_emails: field({
          name: 'reveal_personal_emails',
          description:
            'set to "true" to also reveal personal emails - consumes additional credits and is suppressed in GDPR regions',
          optional: true,
        }),
      },
      data: {},
      keys: ['person'],
    },
    options: {
      auth: 'internal',
    },
  }),

  'apollo/people/match[bulk]': createAuxiliaryTemplate<ProxySchema>({
    provider: 'apollo',
    icon: '@logo/apollo.io',
    name: 'Enrich People (Bulk)',
    description:
      'Enrich up to 10 people in a single call by their Apollo IDs to reveal their full profiles and contact details, including emails. Use the IDs returned by the people search. Prefer this over enriching one at a time.',
    tags: ['apollo', 'people', 'enrich', 'bulk', 'match'],
    commentary:
      '**Credits:** Consumes Apollo credits for each person enriched. Pass up to 10 Apollo `id`s from people search results in one call. Set reveal_personal_emails to also surface personal emails (consumes additional credits and is suppressed in GDPR regions).',
    secret: '@platform/apollo',
    path: APOLLO_PROXY_PATH,
    handler: PROXY_HANDLER,
    instruction: {
      method: 'POST',
      url: '/api/v1/people/bulk_match',
      query: {
        reveal_personal_emails: field({
          name: 'reveal_personal_emails',
          description:
            'set to "true" to also reveal personal emails - consumes additional credits and is suppressed in GDPR regions',
          optional: true,
        }),
      },
      data: {
        details: array({
          name: 'details',
          description:
            'up to 10 people to enrich, each identified by their Apollo id',
          maxItems: 10,
          items: object({
            shape: {
              id: field({
                name: 'id',
                description:
                  'the Apollo person id returned by the people search ability',
              }),
            },
          }),
        }),
      },
      keys: ['matches'],
    },
    options: {
      auth: 'internal',
    },
  }),

  'apollo/organization/search': createAuxiliaryTemplate<ProxySchema>({
    provider: 'apollo',
    icon: '@logo/apollo.io',
    name: 'Search Organizations',
    description: 'Search for organizations using Apollo.io.',
    tags: ['apollo', 'organization', 'search'],
    commentary:
      '**Credits:** Consumes Apollo credits per your pricing plan on each call, unlike the people search.',
    secret: '@platform/apollo',
    path: APOLLO_PROXY_PATH,
    handler: PROXY_HANDLER,
    instruction: {
      method: 'POST',
      url: '/api/v1/mixed_companies/search',
      query: {
        'organization_locations[]': field({
          name: 'organization_locations',
          description:
            'Comma-separated list of organization locations to search for',
        }),
        'q_organization_keyword_tags[]': field({
          name: 'q_organization_keyword_tags',
          description:
            'Comma-separated list of organization keyword tags to search for',
        }),
        q_organization_name: field({
          name: 'q_organization_name',
          description:
            'Filter search results to include a specific company name.',
        }),
        'organization_not_locations[]': field({
          name: 'organization_not_locations',
          description:
            'comma-separated list of headquarters locations to exclude from the search',
          optional: true,
        }),
        'q_organization_domains_list[]': field({
          name: 'q_organization_domains_list',
          description:
            'comma-separated list of company domains to look up (e.g. apollo.io, google.com)',
          optional: true,
        }),
        'organization_num_employees_ranges[]': field({
          name: 'organization_num_employees_ranges',
          description:
            'comma-separated list of headcount ranges, each written as min-max with a hyphen, e.g. "1-10, 11-50, 51-200, 1001-5000"',
          optional: true,
        }),
        'organization_ids[]': field({
          name: 'organization_ids',
          description:
            'comma-separated list of Apollo organization ids to restrict the search to',
          optional: true,
        }),
        'revenue_range[min]': field({
          name: 'revenue_range_min',
          description:
            'minimum annual revenue in whole dollars, no currency symbol or commas, e.g. 1000000',
          optional: true,
        }),
        'revenue_range[max]': field({
          name: 'revenue_range_max',
          description:
            'maximum annual revenue in whole dollars, no currency symbol or commas, e.g. 50000000',
          optional: true,
        }),
        'latest_funding_amount_range[min]': field({
          name: 'latest_funding_amount_min',
          description:
            'minimum amount raised in the most recent funding round, in whole dollars, e.g. 1000000',
          optional: true,
        }),
        'latest_funding_amount_range[max]': field({
          name: 'latest_funding_amount_max',
          description:
            'maximum amount raised in the most recent funding round, in whole dollars, e.g. 50000000',
          optional: true,
        }),
        'total_funding_range[min]': field({
          name: 'total_funding_min',
          description:
            'minimum total funding raised across all rounds, in whole dollars, e.g. 1000000',
          optional: true,
        }),
        'total_funding_range[max]': field({
          name: 'total_funding_max',
          description:
            'maximum total funding raised across all rounds, in whole dollars, e.g. 500000000',
          optional: true,
        }),
        'latest_funding_date_range[min]': field({
          name: 'latest_funding_date_after',
          description:
            'only include companies whose most recent funding round is on or after this date, formatted YYYY-MM-DD',
          optional: true,
        }),
        'latest_funding_date_range[max]': field({
          name: 'latest_funding_date_before',
          description:
            'only include companies whose most recent funding round is on or before this date, formatted YYYY-MM-DD',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          description: 'number of results to return per page, up to 100',
          optional: true,
        }),
        page: field({
          name: 'page',
          description: 'page number to retrieve when paging through results',
          optional: true,
        }),
      },
      data: {},
      keys: ['organizations'],
    },
    options: {
      auth: 'internal',
    },
  }),

  'apollo/api/call': createFetchTemplate({
    provider: 'apollo',
    icon: '@logo/apollo.io',
    name: 'Call Apollo API',
    description:
      'Make a generic API call to Apollo. This is a flexible template that can be used to call any Apollo API endpoint by specifying the method, URL, and request body.',
    tags: ['apollo', 'api', 'call', 'generic'],
    secret: '@platform/apollo',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Apollo API endpoint to call',
      }),
      headers: {
        'X-Api-Key': secret(),
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

  'pack/apollo[search]': createPackTemplate({
    provider: 'apollo',
    icon: '@logo/apollo.io',
    name: 'Install Apollo Tools',
    description:
      'Installs Apollo prospecting tools into the conversation. You can search for people and organizations and enrich a contact with verified emails and phone numbers.',
    tags: ['apollo', 'pack', 'beta'],
    secret: '@platform/apollo',
    instruction: {
      abilities: [
        'apollo/people/search',
        'apollo/people/match',
        'apollo/organization/search',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
