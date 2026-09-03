import {
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  PROXY_HANDLER_NAME,
  ProxySchema,
} from '@/pages/api/auxiliary/skillset/ability/atlassian/proxy'

// --- Path Constants ---

const ATLASSIAN_API_PATH = '/api/auxiliary/skillset/ability/atlassian/proxy'

/**
 * Catalogue of Atlassian abilities for Jira, Confluence, and Jira Service Management.
 */
const abilities = {
  // --- Jira Issue Abilities ---

  'atlassian/jira/issue/search': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Search Jira Issues',
    description: 'Search for issues in Jira based on specific criteria',
    tags: ['jira', 'issue', 'search'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'jira',
      path: '/rest/api/3/search',
      query: {
        jql: field({ name: 'jql', description: 'jira query language' }),
        maxResults: field({
          name: 'max_results',
          type: 'number',
          description: 'maximum results',
          placeholder: true,
          optional: true,
          default: 10,
        }),
      },
    },
    options: {
      auth: 'internal',
      jmespath: `{
  issues: issues[*].{
    id: id,
    key: key,
    summary: fields.summary,
    status: fields.status.name,
    assignee: fields.assignee.displayName,
    publicUrl: publicUrl
  }
}`,
    },
  }),

  'atlassian/jira/issue/create': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Create Jira Issue',
    description: 'Create a new issue in Jira',
    tags: ['jira', 'issue', 'create'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'jira',
      method: 'POST',
      path: '/rest/api/3/issue',
      data: {
        fields: {
          project: {
            key: field({
              name: 'project_key',
              description: 'project key',
            }),
          },
          summary: field({
            name: 'summary',
            description: 'issue summary',
          }),
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    text: field({
                      name: 'description',
                      description: 'issue description',
                    }),
                    type: 'text',
                  },
                ],
              },
            ],
          },
        },
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'atlassian/jira/issue/fetch': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Fetch Jira Issue',
    description: 'Fetch details of a specific issue in Jira',
    tags: ['jira', 'issue', 'fetch'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'jira',
      path: [
        '/rest/api/3/issue/',
        field({ name: 'issue_id', description: 'issue ID' }),
      ],
    },
    options: {
      auth: 'internal',
      jmespath: `{
  id: id,
  key: key,
  summary: fields.summary,
  description: fields.description,
  status: fields.status.name,
  assignee: fields.assignee.displayName,
  publicUrl: publicUrl
}`,
    },
  }),

  // --- Jira Comment Abilities ---

  'atlassian/jira/issue/comment/list': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'List Jira Issue Comments',
    description: 'List comments of a specific issue in Jira',
    tags: ['jira', 'issue', 'comment', 'list'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'jira',
      path: [
        '/rest/api/3/issue/',
        field({ name: 'issue_id', description: 'issue ID' }),
        '/comment',
      ],
    },
    options: {
      auth: 'internal',
    },
  }),

  'atlassian/jira/issue/comment/create': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Create Jira Issue Comment',
    description: 'Create a new comment on a specific issue in Jira',
    tags: ['jira', 'issue', 'comment', 'create'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'jira',
      method: 'POST',
      path: [
        '/rest/api/3/issue/',
        field({ name: 'issue_id', description: 'issue ID' }),
        '/comment',
      ],
      data: {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: field({
                    name: 'comment',
                    description: 'comment text',
                  }),
                  type: 'text',
                },
              ],
            },
          ],
        },
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Jira Pack ---

  'pack/atlassian/jira[search]': createPackTemplate({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Install Jira Search Tools',
    description:
      'Installs Jira search tools into the conversation for searching issues and other information using JQL.',
    tags: ['beta'],
    secret: '@platform/atlassian/jira',
    instruction: {
      abilities: [
        'atlassian/jira/issue/search',
        'atlassian/jira/issue/fetch',
        'atlassian/user/search',
      ] satisfies (keyof typeof abilities | 'atlassian/user/search')[],
    },
  }),

  // --- Confluence Abilities ---

  'atlassian/confluence/content/search': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Search Confluence Content',
    description: 'Search for content in Confluence based on specific criteria',
    tags: ['confluence', 'page', 'search'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/confluence',
    instruction: {
      service: 'confluence',
      path: '/wiki/rest/api/search',
      query: {
        cql: field({ name: 'cql', description: 'confluence query language' }),
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'atlassian/confluence/page/fetch': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Fetch Confluence Page',
    description: 'Fetch details of a specific page in Confluence',
    tags: ['confluence', 'page', 'fetch'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/confluence',
    instruction: {
      service: 'confluence',
      path: [
        '/wiki/api/v2/pages/',
        field({ name: 'page_id', description: 'page ID' }),
      ],
      query: {
        'body-format': 'storage',
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Confluence Pack ---

  'pack/atlassian/confluence[search]': createPackTemplate({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Install Confluence Search Tools',
    description:
      'Installs Confluence search tools into the conversation for searching content using CQL.',
    tags: ['beta'],
    secret: '@platform/atlassian/confluence',
    instruction: {
      abilities: [
        'atlassian/confluence/content/search',
        'atlassian/confluence/page/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  // --- Jira Service Management Abilities ---

  'atlassian/servicedesk/list': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'List Service Desks',
    description: 'List all service desks in Jira Service Management',
    tags: ['servicedesk', 'jira-service-management', 'list'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'servicedesk',
      path: '/rest/servicedeskapi/servicedesk',
    },
    options: {
      auth: 'internal',
      jmespath: `{
  serviceDesks: values[*].{
    id: id,
    projectId: projectId,
    projectKey: projectKey,
    projectName: projectName
  }
}`,
    },
  }),

  'atlassian/servicedesk/requesttype/list':
    createAuxiliaryTemplate<ProxySchema>({
      provider: 'atlassian',
      icon: '@logo/atlassian.com',
      name: 'List Request Types',
      description:
        'List available request types for a service desk in Jira Service Management',
      tags: ['servicedesk', 'jira-service-management', 'request-type', 'list'],
      path: ATLASSIAN_API_PATH,
      handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
      secret: '@platform/atlassian/jira',
      instruction: {
        service: 'servicedesk',
        path: [
          '/rest/servicedeskapi/servicedesk/',
          field({
            name: 'service_desk_id',
            description: 'service desk ID',
          }),
          '/requesttype',
        ],
      },
      options: {
        auth: 'internal',
        jmespath: `{
  requestTypes: values[*].{
    id: id,
    name: name,
    description: description,
    issueTypeId: issueTypeId
  }
}`,
      },
    }),

  'atlassian/servicedesk/request/list': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'List Service Requests',
    description:
      'List customer requests in Jira Service Management based on specific criteria',
    tags: ['servicedesk', 'jira-service-management', 'request', 'list'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'servicedesk',
      path: '/rest/servicedeskapi/request',
      query: {
        serviceDeskId: field({
          name: 'service_desk_id',
          description: 'filter requests by service desk ID',
          optional: true,
        }),
        searchTerm: field({
          name: 'search_term',
          description: 'search term to filter requests',
          optional: true,
        }),
        requestStatus: field({
          name: 'request_status',
          description:
            'request status filter (OPEN, CLOSED, ALL_REQUESTS, CLOSED_BY_CUSTOMER, ESCALATED)',
          placeholder: true,
          optional: true,
          default: 'ALL_REQUESTS',
        }),
        requestOwnership: field({
          name: 'request_ownership',
          description:
            'ownership filter (OWNED_REQUESTS, PARTICIPATED_REQUESTS, ORGANIZATION_REQUESTS, ALL_REQUESTS)',
          placeholder: true,
          optional: true,
        }),
        approvalStatus: field({
          name: 'approval_status',
          description:
            'approval status filter (MY_PENDING_APPROVAL, MY_HISTORY_APPROVAL)',
          placeholder: true,
          optional: true,
        }),
        organizationId: field({
          name: 'organization_id',
          description: 'filter requests by organization ID',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum results',
          placeholder: true,
          optional: true,
          default: 25,
        }),
      },
    },
    options: {
      auth: 'internal',
      jmespath: `{
  requests: values[*].{
    issueId: issueId,
    issueKey: issueKey,
    requestTypeId: requestTypeId,
    currentStatus: currentStatus.status,
    createdDate: createdDate.friendly,
    reporter: reporter.displayName,
    serviceDeskId: serviceDeskId
  }
}`,
    },
  }),

  'atlassian/servicedesk/request/fetch': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Fetch Service Request',
    description:
      'Fetch details of a specific customer request in Jira Service Management',
    tags: ['servicedesk', 'jira-service-management', 'request', 'fetch'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'servicedesk',
      path: [
        '/rest/servicedeskapi/request/',
        field({ name: 'issue_id_or_key', description: 'issue ID or key' }),
      ],
    },
    options: {
      auth: 'internal',
      jmespath: `{
  issueId: issueId,
  issueKey: issueKey,
  requestTypeId: requestTypeId,
  currentStatus: currentStatus.status,
  createdDate: createdDate.friendly,
  reporter: reporter.displayName,
  serviceDeskId: serviceDeskId,
  requestFieldValues: requestFieldValues
}`,
    },
  }),

  'atlassian/servicedesk/request/create': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Create Service Request',
    description: 'Create a new customer request in Jira Service Management',
    tags: ['servicedesk', 'jira-service-management', 'request', 'create'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'servicedesk',
      method: 'POST',
      path: '/rest/servicedeskapi/request',
      data: {
        serviceDeskId: field({
          name: 'service_desk_id',
          description: 'service desk ID',
        }),
        requestTypeId: field({
          name: 'request_type_id',
          description: 'request type ID',
        }),
        requestFieldValues: {
          summary: field({
            name: 'summary',
            description: 'request summary',
          }),
          description: field({
            name: 'description',
            description: 'request description',
          }),
        },
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'atlassian/servicedesk/request/comment/list':
    createAuxiliaryTemplate<ProxySchema>({
      provider: 'atlassian',
      icon: '@logo/atlassian.com',
      name: 'List Request Comments',
      description:
        'List comments on a customer request in Jira Service Management',
      tags: [
        'servicedesk',
        'jira-service-management',
        'request',
        'comment',
        'list',
      ],
      path: ATLASSIAN_API_PATH,
      handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
      secret: '@platform/atlassian/jira',
      instruction: {
        service: 'servicedesk',
        path: [
          '/rest/servicedeskapi/request/',
          field({ name: 'issue_id_or_key', description: 'issue ID or key' }),
          '/comment',
        ],
        query: {
          public: field({
            name: 'public_only',
            type: 'boolean',
            description: 'filter for public comments only',
            placeholder: true,
            optional: true,
            default: true,
          }),
        },
      },
      options: {
        auth: 'internal',
        jmespath: `{
  comments: values[*].{
    id: id,
    body: body,
    public: public,
    author: author.displayName,
    created: created.friendly
  }
}`,
      },
    }),

  'atlassian/servicedesk/request/comment/create':
    createAuxiliaryTemplate<ProxySchema>({
      provider: 'atlassian',
      icon: '@logo/atlassian.com',
      name: 'Create Request Comment',
      description:
        'Add a comment to a customer request in Jira Service Management',
      tags: [
        'servicedesk',
        'jira-service-management',
        'request',
        'comment',
        'create',
      ],
      path: ATLASSIAN_API_PATH,
      handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
      secret: '@platform/atlassian/jira',
      instruction: {
        service: 'servicedesk',
        method: 'POST',
        path: [
          '/rest/servicedeskapi/request/',
          field({ name: 'issue_id_or_key', description: 'issue ID or key' }),
          '/comment',
        ],
        data: {
          body: field({
            name: 'comment',
            description: 'comment text',
          }),
          public: field({
            name: 'public',
            type: 'boolean',
            description: 'whether comment is visible to customers',
            placeholder: true,
            optional: true,
            default: true,
          }),
        },
      },
      options: {
        auth: 'internal',
      },
    }),

  'atlassian/servicedesk/request/transition/list':
    createAuxiliaryTemplate<ProxySchema>({
      provider: 'atlassian',
      icon: '@logo/atlassian.com',
      name: 'List Request Transitions',
      description:
        'List available status transitions for a request in Jira Service Management',
      tags: [
        'servicedesk',
        'jira-service-management',
        'request',
        'transition',
        'list',
      ],
      path: ATLASSIAN_API_PATH,
      handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
      secret: '@platform/atlassian/jira',
      instruction: {
        service: 'servicedesk',
        path: [
          '/rest/servicedeskapi/request/',
          field({ name: 'issue_id_or_key', description: 'issue ID or key' }),
          '/transition',
        ],
      },
      options: {
        auth: 'internal',
        jmespath: `{
  transitions: values[*].{
    id: id,
    name: name
  }
}`,
      },
    }),

  'atlassian/servicedesk/request/transition/update':
    createAuxiliaryTemplate<ProxySchema>({
      provider: 'atlassian',
      icon: '@logo/atlassian.com',
      name: 'Transition Request Status',
      description:
        'Perform a status transition on a request in Jira Service Management',
      tags: [
        'servicedesk',
        'jira-service-management',
        'request',
        'transition',
        'update',
      ],
      path: ATLASSIAN_API_PATH,
      handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
      secret: '@platform/atlassian/jira',
      instruction: {
        service: 'servicedesk',
        method: 'POST',
        path: [
          '/rest/servicedeskapi/request/',
          field({ name: 'issue_id_or_key', description: 'issue ID or key' }),
          '/transition',
        ],
        data: {
          id: field({
            name: 'transition_id',
            description: 'transition ID to perform',
          }),
          additionalComment: {
            body: field({
              name: 'comment',
              description: 'optional comment to add with the transition',
              optional: true,
            }),
          },
        },
      },
      options: {
        auth: 'internal',
      },
    }),

  // --- Jira Service Management Pack ---

  'pack/atlassian/servicedesk[manage]': createPackTemplate({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Install Service Desk Management Tools',
    description:
      'Installs Service Desk management tools into the conversation for managing customer requests in Jira Service Management.',
    tags: ['beta'],
    secret: '@platform/atlassian/jira',
    instruction: {
      abilities: [
        'atlassian/servicedesk/list',
        'atlassian/servicedesk/requesttype/list',
        'atlassian/servicedesk/request/list',
        'atlassian/servicedesk/request/fetch',
        'atlassian/servicedesk/request/create',
        'atlassian/servicedesk/request/comment/list',
        'atlassian/servicedesk/request/comment/create',
        'atlassian/servicedesk/request/transition/list',
        'atlassian/servicedesk/request/transition/update',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  // --- User Abilities ---

  'atlassian/user/search': createAuxiliaryTemplate<ProxySchema>({
    provider: 'atlassian',
    icon: '@logo/atlassian.com',
    name: 'Install Atlassian Users Search Tools',
    description:
      'Search for users in Atlassian products based on specific criteria',
    tags: ['atlassian', 'user', 'search'],
    path: ATLASSIAN_API_PATH,
    handler: 'proxy' satisfies typeof PROXY_HANDLER_NAME,
    secret: '@platform/atlassian/jira',
    instruction: {
      service: 'jira',
      path: '/rest/api/3/users/search',
      query: {
        query: field({ name: 'query', description: 'search query' }),
        maxResults: field({
          name: 'max_results',
          type: 'number',
          description: 'maximum results',
          placeholder: true,
          optional: true,
          default: 10,
        }),
      },
    },
    options: {
      auth: 'internal',
      jmespath: `{
  users: [*].{
    accountId: accountId,
    displayName: displayName,
    emailAddress: emailAddress,
    publicUrl: publicUrl
  }
}`,
    },
  }),
}

export default abilities
