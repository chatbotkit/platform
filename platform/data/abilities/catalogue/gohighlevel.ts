import { createAuxiliaryTemplate, field } from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/gohighlevel/sql'

/**
 * Catalogue of GoHighLevel abilities.
 */
const abilities = {
  'gohighlevel/sql/exec': createAuxiliaryTemplate<Schema>({
    provider: 'gohighlevel',
    icon: '@logo/gohighlevel.com',
    name: 'Execute GoHighLevel SQL Query',
    description:
      'Execute a simple SQL query in GoHighLevel. Known tables include business and contact. Joining tables and other complex queries are not supported.',
    tags: ['crm', 'gohighlevel', 'sql'],
    path: '/api/auxiliary/skillset/ability/gohighlevel/sql',
    secret: '@gohighlevel',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - describe, select, insert, update, delete are supported',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),
}

export default abilities
