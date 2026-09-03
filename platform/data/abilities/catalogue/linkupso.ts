import {
  array,
  createFetchTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'linkupso/search': createFetchTemplate({
    provider: 'linkupso',
    icon: '@logo/linkup.so',
    name: 'Web Search',
    description: 'Retrieve search results using natural language queries.',
    tags: ['linkupso', 'search', 'web'],
    secret: '@linkupso',
    instruction: {
      method: 'POST',
      url: 'https://api.linkup.so/v1/search',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        q: field({
          name: 'query',
          description:
            'the natural language question for which you want to retrieve context',
        }),
        depth: field({
          name: 'depth',
          description:
            'defines the precision of the search where fast prioritizes latency, standard balances speed and coverage, and deep is more comprehensive',
          enum: ['fast', 'standard', 'deep'],
          default: 'standard',
          optional: true,
          placeholder: true,
        }),
        outputType: field({
          name: 'outputType',
          description:
            'the type of output you want to get - use structured for a custom-formatted response defined by structuredOutputSchema',
          enum: ['searchResults', 'sourcedAnswer', 'structured'],
          default: 'sourcedAnswer',
          optional: true,
          placeholder: true,
        }),
        excludeDomains: array({
          items: field({
            name: 'excludeDomain',
            description: 'a domain to exclude from the search',
            placeholder: true,
          }),
          name: 'excludeDomains',
          description: 'the domains you want to exclude from the search',
          optional: true,
        }),
        fromDate: field({
          name: 'fromDate',
          description:
            'the date from which the search results should be considered in YYYY-MM-DD format',
          optional: true,
          placeholder: true,
        }),
        includeDomains: array({
          items: field({
            name: 'includeDomain',
            description: 'a domain to include in the search',
            placeholder: true,
          }),
          name: 'includeDomains',
          description: 'the domains you want to search on',
          optional: true,
          maxItems: 100,
        }),
        includeImages: field({
          name: 'includeImages',
          type: 'boolean',
          description: 'defines whether the API should include images in its results',
          optional: true,
          placeholder: true,
        }),
        structuredOutputSchema: field({
          name: 'structuredOutputSchema',
          description:
            'required only when outputType is structured - provide a JSON schema string whose root type is object',
          optional: true,
          placeholder: true,
        }),
        toDate: field({
          name: 'toDate',
          description:
            'the date until which the search results should be considered in YYYY-MM-DD format',
          optional: true,
          placeholder: true,
        }),
        includeInlineCitations: field({
          name: 'includeInlineCitations',
          type: 'boolean',
          description:
            'relevant only when outputType is sourcedAnswer - defines whether the answer should include inline citations',
          optional: true,
          placeholder: true,
        }),
        includeSources: field({
          name: 'includeSources',
          type: 'boolean',
          description:
            'relevant only when outputType is structured - defines whether the response should include sources',
          optional: true,
          placeholder: true,
        }),
        maxResults: field({
          name: 'maxResults',
          type: 'number',
          description: 'the maximum number of results to return',
          min: 1,
          optional: true,
          placeholder: true,
        }),
      },
    },
  }),
}

export default abilities
