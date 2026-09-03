import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'linear/issue/create': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Create Linear Issue',
    description:
      'Create a new issue in Linear with title, description, team, and optional assignee, priority, and status',
    tags: ['linear', 'issue', 'create', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation IssueCreate($title: String!, $teamId: String!, $description: String, $assigneeId: String, $priority: Int, $stateId: String) {
            issueCreate(input: {
              title: $title
              teamId: $teamId
              description: $description
              assigneeId: $assigneeId
              priority: $priority
              stateId: $stateId
            }) {
              success
              issue {
                id
                identifier
                title
                description
                priority
                url
                state {
                  id
                  name
                }
                assignee {
                  id
                  name
                  email
                }
              }
            }
          }
        `,
        variables: {
          title: field({
            name: 'title',
            description: 'the title of the issue',
          }),
          teamId: field({
            name: 'teamId',
            description: 'the team ID to create the issue in',
            placeholder: true,
          }),
          description: field({
            name: 'description',
            description: 'the description of the issue',
            optional: true,
          }),
          assigneeId: field({
            name: 'assigneeId',
            description: 'the user ID to assign the issue to',
            optional: true,
            placeholder: true,
          }),
          priority: field({
            name: 'priority',
            type: 'number',
            description:
              'the priority level (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low)',
            optional: true,
            default: 0,
          }),
          stateId: field({
            name: 'stateId',
            description: 'the workflow state ID for the issue',
            optional: true,
            placeholder: true,
          }),
        },
      },
    },
  }),

  'linear/issue/update': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Update Linear Issue',
    description:
      'Update an existing Linear issue with new title, description, assignee, priority, or status',
    tags: ['linear', 'issue', 'update', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation IssueUpdate($id: String!, $title: String, $description: String, $assigneeId: String, $priority: Int, $stateId: String) {
            issueUpdate(
              id: $id
              input: {
                title: $title
                description: $description
                assigneeId: $assigneeId
                priority: $priority
                stateId: $stateId
              }
            ) {
              success
              issue {
                id
                identifier
                title
                description
                priority
                url
                state {
                  id
                  name
                }
                assignee {
                  id
                  name
                  email
                }
              }
            }
          }
        `,
        variables: {
          id: field({
            name: 'issueId',
            description: 'the ID of the issue to update',
            placeholder: true,
          }),
          title: field({
            name: 'title',
            description: 'the new title of the issue',
            optional: true,
          }),
          description: field({
            name: 'description',
            description: 'the new description of the issue',
            optional: true,
          }),
          assigneeId: field({
            name: 'assigneeId',
            description: 'the user ID to assign the issue to',
            optional: true,
            placeholder: true,
          }),
          priority: field({
            name: 'priority',
            type: 'number',
            description:
              'the priority level (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low)',
            optional: true,
          }),
          stateId: field({
            name: 'stateId',
            description: 'the workflow state ID for the issue',
            optional: true,
            placeholder: true,
          }),
        },
      },
    },
  }),

  'linear/issue/get': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Get Linear Issue',
    description:
      'Retrieve a specific Linear issue by ID with full details including title, description, status, assignee, and priority',
    tags: ['linear', 'issue', 'get', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query Issue($id: String!) {
            issue(id: $id) {
              id
              identifier
              title
              description
              priority
              url
              createdAt
              updatedAt
              state {
                id
                name
                type
              }
              assignee {
                id
                name
                email
              }
              team {
                id
                name
              }
              project {
                id
                name
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
            }
          }
        `,
        variables: {
          id: field({
            name: 'issueId',
            description: 'the ID of the issue to retrieve',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'linear/issue/search': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Search Linear Issues',
    description:
      'Search and filter Linear issues by team, title, assignee, state, or text query with pagination support',
    tags: ['linear', 'issue', 'search', 'query', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query Issues($teamId: ID, $query: String, $assigneeId: ID, $stateId: ID, $first: Int) {
            issues(
              filter: {
                team: { id: { eq: $teamId } }
                title: { contains: $query }
                assignee: { id: { eq: $assigneeId } }
                state: { id: { eq: $stateId } }
              }
              first: $first
            ) {
              nodes {
                id
                identifier
                title
                description
                priority
                url
                state {
                  id
                  name
                }
                assignee {
                  id
                  name
                  email
                }
                team {
                  id
                  name
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          teamId: field({
            name: 'teamId',
            description: 'the team ID to filter issues',
            optional: true,
            placeholder: true,
          }),
          query: field({
            name: 'query',
            description: 'search text to filter issues by title',
            optional: true,
          }),
          assigneeId: field({
            name: 'assigneeId',
            description: 'the user ID to filter issues by assignee',
            optional: true,
            placeholder: true,
          }),
          stateId: field({
            name: 'stateId',
            description: 'the workflow state ID to filter issues',
            optional: true,
            placeholder: true,
          }),
          first: field({
            name: 'limit',
            type: 'number',
            description: 'the maximum number of issues to return',
            optional: true,
            default: 10,
          }),
        },
      },
    },
  }),

  'linear/team/list': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'List Linear Teams',
    description:
      'Retrieve all teams in the Linear workspace with their IDs, names, and descriptions',
    tags: ['linear', 'team', 'list', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query Teams($first: Int) {
            teams(first: $first) {
              nodes {
                id
                name
                key
                description
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          first: field({
            name: 'limit',
            type: 'number',
            description: 'the maximum number of teams to return',
            optional: true,
            default: 50,
          }),
        },
      },
    },
  }),

  'linear/issue/delete': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Delete Linear Issue',
    description: 'Delete an existing Linear issue by its ID',
    tags: ['linear', 'issue', 'delete', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation IssueDelete($id: String!) {
            issueDelete(id: $id) {
              success
            }
          }
        `,
        variables: {
          id: field({
            name: 'issueId',
            description: 'the ID of the issue to delete',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'linear/comment/create': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Create Linear Comment',
    description: 'Add a comment to an existing Linear issue',
    tags: ['linear', 'comment', 'create', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation CommentCreate($issueId: String!, $body: String!) {
            commentCreate(input: {
              issueId: $issueId
              body: $body
            }) {
              success
              comment {
                id
                body
                createdAt
                user {
                  id
                  name
                }
              }
            }
          }
        `,
        variables: {
          issueId: field({
            name: 'issueId',
            description: 'the ID of the issue to comment on',
            placeholder: true,
          }),
          body: field({
            name: 'body',
            description: 'the comment text content (supports Markdown)',
          }),
        },
      },
    },
  }),

  'linear/project/list': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'List Linear Projects',
    description:
      'Retrieve all projects in the Linear workspace with their IDs, names, state, and target dates',
    tags: ['linear', 'project', 'list', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query Projects($first: Int) {
            projects(first: $first) {
              nodes {
                id
                name
                description
                state
                startDate
                targetDate
                lead {
                  id
                  name
                }
                teams {
                  nodes {
                    id
                    name
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          first: field({
            name: 'limit',
            type: 'number',
            description: 'the maximum number of projects to return',
            optional: true,
            default: 50,
          }),
        },
      },
    },
  }),

  'linear/project/create': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Create Linear Project',
    description:
      'Create a new project in Linear with a name, associated teams, and optional description and target date',
    tags: ['linear', 'project', 'create', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          mutation ProjectCreate($name: String!, $teamIds: [String!]!, $description: String, $targetDate: TimelessDate) {
            projectCreate(input: {
              name: $name
              teamIds: $teamIds
              description: $description
              targetDate: $targetDate
            }) {
              success
              project {
                id
                name
                description
                state
                targetDate
              }
            }
          }
        `,
        variables: {
          name: field({
            name: 'name',
            description: 'the name of the project',
          }),
          teamIds: field({
            name: 'teamIds',
            description: 'array of team IDs to associate with the project',
            placeholder: true,
          }),
          description: field({
            name: 'description',
            description: 'a description of the project',
            optional: true,
          }),
          targetDate: field({
            name: 'targetDate',
            description: 'the target completion date in YYYY-MM-DD format',
            optional: true,
          }),
        },
      },
    },
  }),

  'linear/user/list': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'List Linear Users',
    description:
      'Retrieve all members of the Linear workspace with their IDs, names, and email addresses',
    tags: ['linear', 'user', 'list', 'project-management'],
    secret: '@platform/linear',
    instruction: {
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        query: `
          query Users($first: Int) {
            users(first: $first) {
              nodes {
                id
                name
                displayName
                email
                active
                admin
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          first: field({
            name: 'limit',
            type: 'number',
            description: 'the maximum number of users to return',
            optional: true,
            default: 50,
          }),
        },
      },
    },
  }),

  'linear/api/call': createFetchTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Call Linear API',
    description:
      'Make a generic API call to Linear. This is a flexible template that can be used to call any Linear API endpoint by specifying the method, URL, and request body.',
    tags: ['linear', 'api', 'call', 'generic'],
    secret: '@platform/linear',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Linear API endpoint to call',
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

  'pack/linear': createPackTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Install Linear Tools',
    description:
      'Installs Linear tools into the conversation. You can manage issues, comments, projects, users, and perform comprehensive project management operations.',
    tags: ['linear', 'pack', 'beta'],
    secret: '@platform/linear',
    instruction: {
      abilities: [
        'linear/issue/create',
        'linear/issue/update',
        'linear/issue/get',
        'linear/issue/search',
        'linear/issue/delete',
        'linear/comment/create',
        'linear/project/list',
        'linear/project/create',
        'linear/team/list',
        'linear/user/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/linear[read-only]': createPackTemplate({
    provider: 'linear',
    icon: '@logo/linear.app',
    name: 'Install Linear Search Tools',
    description:
      'Installs read-only Linear tools into the conversation. You can search issues, list teams, projects, and users without modification.',
    tags: ['linear', 'pack', 'beta'],
    secret: '@platform/linear',
    instruction: {
      abilities: [
        'linear/issue/get',
        'linear/issue/search',
        'linear/project/list',
        'linear/team/list',
        'linear/user/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
