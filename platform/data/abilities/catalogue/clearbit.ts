import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'clearbit/company/name-to-domain': createFetchTemplate({
    provider: 'clearbit',
    icon: '@logo/clearbit.com',
    name: 'Find Company Domain by Name',
    description: 'Find the domain for a company given its name using Clearbit',
    tags: ['clearbit', 'company', 'domain', 'enrichment'],
    secret: '@clearbit',
    instruction: {
      method: 'GET',
      url: 'https://company.clearbit.com/v1/domains/find',
      query: {
        name: field({
          name: 'companyName',
          description: 'the name of the company',
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clearbit/company/domain-lookup': createFetchTemplate({
    provider: 'clearbit',
    icon: '@logo/clearbit.com',
    name: 'Get Company Information by Domain',
    description:
      'Look up detailed company information by domain using Clearbit enrichment API',
    tags: ['clearbit', 'company', 'lookup', 'enrichment'],
    secret: '@clearbit',
    instruction: {
      method: 'GET',
      url: 'https://company.clearbit.com/v2/companies/find',
      query: {
        domain: field({
          name: 'domain',
          description: 'the domain to look up',
        }),
        company_name: field({
          name: 'companyName',
          description: 'the company name for additional context',
          optional: true,
        }),
        linkedin: field({
          name: 'linkedin',
          description: 'the LinkedIn URL for the company',
          optional: true,
        }),
        twitter: field({
          name: 'twitter',
          description: 'the Twitter handle for the company',
          optional: true,
        }),
        facebook: field({
          name: 'facebook',
          description: 'the Facebook URL for the company',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clearbit/person/email-lookup': createFetchTemplate({
    provider: 'clearbit',
    icon: '@logo/clearbit.com',
    name: 'Get Person Information by Email',
    description:
      'Look up detailed person information by email address using Clearbit enrichment API',
    tags: ['clearbit', 'person', 'email', 'lookup', 'enrichment'],
    secret: '@clearbit',
    instruction: {
      method: 'GET',
      url: 'https://person.clearbit.com/v2/people/find',
      query: {
        email: field({
          name: 'email',
          description: 'the email address to look up',
        }),
        given_name: field({
          name: 'givenName',
          description: 'the first name of the person',
          optional: true,
        }),
        family_name: field({
          name: 'familyName',
          description: 'the last name of the person',
          optional: true,
        }),
        ip_address: field({
          name: 'ipAddress',
          description: 'the IP address of the person',
          optional: true,
        }),
        location: field({
          name: 'location',
          description: 'the city or country where the person resides',
          optional: true,
        }),
        company: field({
          name: 'company',
          description: "the name of the person's employer",
          optional: true,
        }),
        company_domain: field({
          name: 'companyDomain',
          description: "the domain for the person's employer",
          optional: true,
        }),
        linkedin: field({
          name: 'linkedin',
          description: 'the LinkedIn URL for the person',
          optional: true,
        }),
        twitter: field({
          name: 'twitter',
          description: 'the Twitter handle for the person',
          optional: true,
        }),
        facebook: field({
          name: 'facebook',
          description: 'the Facebook URL for the person',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clearbit/discovery/find-companies': createFetchTemplate({
    provider: 'clearbit',
    icon: '@logo/clearbit.com',
    name: 'Find Companies by Criteria',
    description:
      'Search for companies using specific criteria with Clearbit discovery API',
    tags: ['clearbit', 'company', 'search', 'discovery'],
    secret: '@clearbit',
    instruction: {
      method: 'GET',
      url: 'https://discovery.clearbit.com/v1/companies/search',
      query: {
        query: field({
          name: 'query',
          description: 'the search query string',
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'the page number for pagination',
          optional: true,
          default: 1,
        }),
        page_size: field({
          name: 'pageSize',
          type: 'number',
          description: 'the number of results per page',
          optional: true,
          default: 20,
        }),
        sort: field({
          name: 'sort',
          description: 'the field to sort by',
          optional: true,
          enum: [
            'name',
            'employees',
            'estimated_annual_revenue',
            'metrics.raised',
            'metrics.employees',
          ],
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clearbit/prospector/find-contacts': createFetchTemplate({
    provider: 'clearbit',
    icon: '@logo/clearbit.com',
    name: 'Find Contacts by Criteria',
    description:
      'Search for contact information using specific criteria with Clearbit prospector API',
    tags: ['clearbit', 'contact', 'person', 'search', 'prospector'],
    secret: '@clearbit',
    instruction: {
      method: 'GET',
      url: 'https://prospector.clearbit.com/v1/people/search',
      query: {
        query: field({
          name: 'query',
          description: 'the search query string',
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'the page number for pagination',
          optional: true,
          default: 1,
        }),
        page_size: field({
          name: 'pageSize',
          type: 'number',
          description: 'the number of results per page',
          optional: true,
          default: 20,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'clearbit/api/call': createFetchTemplate({
    provider: 'clearbit',
    icon: '@logo/clearbit.com',
    name: 'Call Clearbit API',
    description:
      'Make a generic API call to Clearbit. This is a flexible template that can be used to call any Clearbit API endpoint by specifying the method, URL, and request body.',
    tags: ['clearbit', 'api', 'call', 'generic'],
    secret: '@clearbit',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Clearbit API endpoint to call',
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
