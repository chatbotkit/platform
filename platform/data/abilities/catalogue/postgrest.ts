import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type { RpcSchema } from '@/pages/api/auxiliary/skillset/ability/postgrest/rpc'
import type { SqlSchema } from '@/pages/api/auxiliary/skillset/ability/postgrest/sql'

/**
 * Catalogue of Postgrest abilities.
 */
const abilities = {
  'postgrest/rest/sql': createAuxiliaryTemplate<SqlSchema>({
    provider: 'postgrest',
    icon: '@logo/postgrest.org',
    name: 'Execute Postgrest SQL Query',
    description: 'Execute a simple SQL query in Postgrest.',
    tags: ['postgrest', 'sql', 'beta'],
    path: '/api/auxiliary/skillset/ability/postgrest/sql',
    secret: '@postgrest/rest',
    instruction: {
      url: field({
        name: 'url',
        description: 'the Postgrest Rest URL',
        placeholder: true,
      }),
      sql: field({
        name: 'sql',
        description: 'the SQL query to execute - only select is supported',
        placeholder: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'postgrest/rest/rpc': createAuxiliaryTemplate<RpcSchema>({
    provider: 'postgrest',
    icon: '@logo/postgrest.org',
    name: 'Execute Postgrest RPC Function',
    description: 'Execute a Postgrest RPC function with parameters.',
    tags: ['postgrest', 'rpc', 'beta'],
    path: '/api/auxiliary/skillset/ability/postgrest/rpc',
    secret: '@postgrest/rest',
    instruction: {
      url: field({
        name: 'url',
        description: 'the Postgrest Rest URL',
        placeholder: true,
      }),
      function: field({
        name: 'function',
        description: 'the RPC function to execute',
        placeholder: true,
      }),
      params: field({
        // @todo migrate to use proper object once supported
        name: 'params',
        description:
          'the parameters to pass to the RPC function - accepts json object',
        placeholder: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
