import {
  createAuxiliaryTemplate,
  field,
  object,
} from '@/lib/ability.template'

import type {
  REPOSITORY_TOKEN_CREATE_HANDLER_NAME,
  RepositoryTokenCreateSchema,
} from '@/pages/api/auxiliary/skillset/ability/github/tools'

// --- Path Constants ---

const GITHUB_API_PATH = '/api/auxiliary/skillset/ability/github/tools'

/**
 * Catalogue of GitHub abilities.
 */
const abilities = {
  'github/repository/token/create':
    createAuxiliaryTemplate<RepositoryTokenCreateSchema>({
      provider: 'github',
      icon: '@logo/github.com',
      name: 'Create GitHub Repository Token',
      description:
        'Mint a GitHub App installation access token scoped to a specific repository.',
      tags: ['github', 'repository', 'token', 'create', 'beta'],
      commentary:
        '**NOTE:** This ability requires a GitHub App JWT with access to the target repository installation.',
      path: GITHUB_API_PATH,
      handler:
        'repository/token/create' satisfies typeof REPOSITORY_TOKEN_CREATE_HANDLER_NAME,
      secret: '@github[app]',
      instruction: {
        owner: field({
          name: 'owner',
          description: 'the repository owner',
          placeholder: true,
        }),
        repo: field({
          name: 'repo',
          description: 'the repository name',
          placeholder: true,
        }),
        permissions: object({
          optional: true,
          shape: {},
        }),
      },
      options: {
        auth: 'internal',
      },
    }),
}

export default abilities
