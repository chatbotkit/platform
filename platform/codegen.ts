import { schema as v1 } from '@/graphql/v1/schema'

import type { CodegenConfig } from '@graphql-codegen/cli'

import { printSchema } from 'graphql'

const config: CodegenConfig = {
  generates: {
    './graphql/v1/client/graphql.ts': {
      schema: printSchema(v1),
      documents: './graphql/v1/**/*.graphql',
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        typesPrefix: 'CBK',
      },
    },
  },
}

export default config
