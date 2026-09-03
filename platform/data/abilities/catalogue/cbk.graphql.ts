import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of GraphQL abilities.
 */
const abilities = {
  'graphql[cbk]': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute GraphQL Query',
    description: 'Execute a graphql query against ChatBotKit platform services',
    tags: ['graphql', 'query', 'cbk'],
    commentary: `This ability allows you to execute GraphQL queries against the ChatBotKit
platform services. You can use this ability to retrieve and manipulate data
related to your ChatBotKit account, such as bots, datasets, files, and more.

**NOTE**: This is a powerful but advanced ability that requires knowledge of
how to properly secure the agent access. Do you not use this ability unless 
you are confident in your understanding of the security implications.`,
    instruction: {
      method: 'POST',
      url: '/api/v1/graphql',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        query: field({
          name: 'query',
          description: 'the GraphQL query to execute',
        }),
        variables: field({
          name: 'variables',
          description: 'optional GraphQL query variables in JSON format',
          optional: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    },
  }),

  'url/graphql': createFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute GraphQL Query',
    description: 'Execute a graphql query on a remote GraphQL endpoint',
    tags: ['graphql', 'query'],
    secret: '@bearer',
    instruction: {
      method: 'POST',
      url: field({
        name: 'endpoint',
        description: 'the GraphQL endpoint URL',
      }),
      headers: {
        'content-type': 'application/json',
        Authorization: secret(),
      },
      body: {
        query: field({
          name: 'query',
          description: 'the GraphQL query to execute',
        }),
        variables: field({
          name: 'variables',
          description: 'optional GraphQL query variables in JSON format',
          optional: true,
        }),
      },
    },
  }),
}

export default abilities
