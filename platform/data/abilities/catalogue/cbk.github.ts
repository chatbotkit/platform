import { createAuxiliaryTemplate, field, object } from '@/lib/ability.template'

import type {
  ADD_LABELS_HANDLER_NAME,
  API_CALL_HANDLER_NAME,
  ASSIGN_USERS_HANDLER_NAME,
  AddLabelsSchema,
  ApiCallSchema,
  AssignUsersSchema,
  CREATE_TOKEN_HANDLER_NAME,
  CreateTokenSchema,
  GITHUB_INTEGRATION_API_PATH,
  LIST_FILES_HANDLER_NAME,
  ListFilesSchema,
  POST_COMMENT_HANDLER_NAME,
  PostCommentSchema,
  READ_FILE_HANDLER_NAME,
  ReadFileSchema,
  SET_STATE_HANDLER_NAME,
  SetStateSchema,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/integration/github'

// --- Path Constants ---

const GITHUB_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/github' satisfies typeof GITHUB_INTEGRATION_API_PATH

// --- Shared instruction fields ---

const integrationField = field({
  name: 'githubIntegrationId',
  description: 'The ID of the GitHub integration to use',
  placeholder: true,
})

const repositoryField = field({
  name: 'repository',
  description:
    'The repository as owner/repo or a GitHub URL, e.g. acme/web or https://github.com/acme/web',
  placeholder: true,
})

const issueNumberField = field({
  name: 'issueNumber',
  description: 'The issue or pull request number',
  placeholder: true,
})

/**
 * Catalogue of ChatBotKit GitHub integration abilities.
 */
const abilities = {
  'github/issue/comment[by-id]': createAuxiliaryTemplate<PostCommentSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'Post GitHub Comment',
    description:
      'Posts a markdown comment to a GitHub issue or pull request thread.',
    tags: ['github', 'issue', 'pull-request', 'comment', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'postComment' satisfies typeof POST_COMMENT_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      repository: repositoryField,
      issueNumber: issueNumberField,
      body: field({
        name: 'body',
        description: 'The markdown body of the comment to post',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/issue/label[by-id]': createAuxiliaryTemplate<AddLabelsSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'Label GitHub Issue',
    description: 'Adds one or more labels to a GitHub issue or pull request.',
    tags: ['github', 'issue', 'pull-request', 'label', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'addLabels' satisfies typeof ADD_LABELS_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      repository: repositoryField,
      issueNumber: issueNumberField,
      labels: [
        field({
          name: 'label',
          description: 'A label name to add',
        }),
      ],
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/issue/assign[by-id]': createAuxiliaryTemplate<AssignUsersSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'Assign GitHub Issue',
    description:
      'Assigns one or more GitHub users to an issue or pull request.',
    tags: ['github', 'issue', 'pull-request', 'assign', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'assignUsers' satisfies typeof ASSIGN_USERS_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      repository: repositoryField,
      issueNumber: issueNumberField,
      assignees: [
        field({
          name: 'assignee',
          description: 'A GitHub login to assign',
        }),
      ],
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/issue/state[by-id]': createAuxiliaryTemplate<SetStateSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'Open or Close GitHub Issue',
    description: 'Opens or closes a GitHub issue or pull request.',
    tags: ['github', 'issue', 'pull-request', 'close', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'setState' satisfies typeof SET_STATE_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      repository: repositoryField,
      issueNumber: issueNumberField,
      state: field({
        name: 'state',
        description: "The desired state: 'open' or 'closed'",
        placeholder: true,
      }),
      reason: field({
        name: 'reason',
        description:
          "Optional close reason: 'completed', 'not_planned', or 'reopened'",
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/repo/read-file[by-id]': createAuxiliaryTemplate<ReadFileSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'Read GitHub File',
    description:
      'Reads the contents of a single file from a GitHub repository.',
    tags: ['github', 'repo', 'file', 'read', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'readFile' satisfies typeof READ_FILE_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      repository: repositoryField,
      path: field({
        name: 'path',
        description: 'The path of the file within the repository',
        placeholder: true,
      }),
      ref: field({
        name: 'ref',
        description:
          'Optional branch, tag, or commit SHA (defaults to the default branch)',
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/repo/list[by-id]': createAuxiliaryTemplate<ListFilesSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'List GitHub Files',
    description:
      'Lists files and directories at a path in a GitHub repository.',
    tags: ['github', 'repo', 'file', 'list', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'listFiles' satisfies typeof LIST_FILES_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      repository: repositoryField,
      path: field({
        name: 'path',
        description:
          'Optional directory path within the repo (defaults to the root)',
        placeholder: true,
        optional: true,
      }),
      ref: field({
        name: 'ref',
        description:
          'Optional branch, tag, or commit SHA (defaults to the default branch)',
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/api/call[by-id]': createAuxiliaryTemplate<ApiCallSchema>({
    provider: 'github',
    icon: '@logo/github.com',
    name: 'Call GitHub API',
    description:
      'Makes an authenticated call to any GitHub REST API endpoint. Advanced - bounded by the App permissions and installed repositories.',
    tags: ['github', 'api', 'advanced', 'integration', 'beta'],
    path: GITHUB_API_PATH,
    handler: 'apiCall' satisfies typeof API_CALL_HANDLER_NAME,
    instruction: {
      githubIntegrationId: integrationField,
      method: field({
        name: 'method',
        description: 'The HTTP method: GET, POST, PATCH, PUT, or DELETE',
        placeholder: true,
      }),
      path: field({
        name: 'path',
        description:
          'The GitHub REST API path, e.g. /repos/{owner}/{repo}/issues/{n}/comments',
        placeholder: true,
      }),
      body: field({
        name: 'body',
        description:
          'Optional request body as a JSON string (for POST/PATCH/PUT)',
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
      context: ['conversation'],
    },
  }),

  'github/repository/token/create[by-id]':
    createAuxiliaryTemplate<CreateTokenSchema>({
      provider: 'github',
      icon: '@logo/github.com',
      name: 'Create GitHub Repository Token',
      description:
        'Mints a short-lived installation access token scoped to a repository, for handing to a CLI or git client.',
      tags: [
        'github',
        'repository',
        'token',
        'create',
        'cli',
        'integration',
        'beta',
      ],
      commentary:
        '**NOTE:** This returns a live, write-capable token into the conversation. Down-scope it with `permissions` and only enable it for bots that perform code/CLI work.',
      path: GITHUB_API_PATH,
      handler: 'createToken' satisfies typeof CREATE_TOKEN_HANDLER_NAME,
      instruction: {
        githubIntegrationId: integrationField,
        repository: repositoryField,
        permissions: object({
          optional: true,
          shape: {},
        }),
      },
      options: {
        auth: 'internal',
        context: ['conversation'],
      },
    }),
}

export default abilities
