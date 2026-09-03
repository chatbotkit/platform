import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Uplead abilities for B2B lead enrichment.
 *
 * Uplead provides APIs for enriching company and person data, helping
 * with B2B lead generation and contact discovery.
 *
 * @see https://docs.uplead.com/
 */
const abilities = {
  'uplead/company/enrich': createFetchTemplate({
    provider: 'uplead',
    icon: '@logo/uplead.com',
    name: 'Enrich Company',
    description:
      'Lookup company data via a domain name or company name using Uplead',
    tags: ['uplead', 'company', 'enrichment', 'b2b', 'lead'],
    secret: '@uplead',
    instruction: {
      method: 'GET',
      url: 'https://api.uplead.com',
      path: ['/v2/company-search'],
      query: {
        domain: field({
          name: 'domain',
          description: 'domain name to search (e.g., amazon.com)',
          optional: true,
        }),
        company: field({
          name: 'company',
          description: 'company name to search (e.g., Amazon)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'uplead/person/enrich': createFetchTemplate({
    provider: 'uplead',
    icon: '@logo/uplead.com',
    name: 'Enrich Person',
    description:
      'Lookup person data based on an email address or based on a domain name + first name + last name using Uplead',
    tags: ['uplead', 'person', 'enrichment', 'b2b', 'lead', 'contact'],
    secret: '@uplead',
    instruction: {
      method: 'GET',
      url: 'https://api.uplead.com',
      path: ['/v2/person-search'],
      query: {
        email: field({
          name: 'email',
          description:
            'email address to look up (e.g., mbenioff@salesforce.com)',
          optional: true,
        }),
        first_name: field({
          name: 'firstName',
          description: 'first name of the person (e.g., Marc)',
          optional: true,
        }),
        last_name: field({
          name: 'lastName',
          description: 'last name of the person (e.g., Benioff)',
          optional: true,
        }),
        domain: field({
          name: 'domain',
          description: 'domain name of the company (e.g., salesforce.com)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'uplead/api/call': createFetchTemplate({
    provider: 'uplead',
    icon: '@logo/uplead.com',
    name: 'Call Uplead API',
    description:
      'Make a generic API call to Uplead. This is a flexible template that can be used to call any Uplead API endpoint by specifying the method, URL, and request body.',
    tags: ['uplead', 'api', 'call', 'generic'],
    secret: '@uplead',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Uplead API endpoint to call',
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
