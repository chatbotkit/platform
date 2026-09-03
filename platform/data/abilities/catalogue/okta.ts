import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Okta abilities.
 *
 * @see https://developer.okta.com/docs/reference/api/users/
 * @see https://developer.okta.com/docs/reference/api/groups/
 */
const abilities = {
  // ===========================
  // User Operations
  // ===========================

  'okta/user/list': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'List Users',
    description: 'List all users in your Okta organization with pagination',
    tags: ['okta', 'user', 'list', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'GET',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: ['/api/v1/users'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of users to return (1-200)',
          default: 25,
          optional: true,
        }),
        search: field({
          name: 'search',
          description:
            'filter expression using Okta Expression Language (e.g., profile.firstName eq "John")',
          optional: true,
        }),
        filter: field({
          name: 'filter',
          description:
            'filter expression for user status (e.g., status eq "ACTIVE")',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/fetch': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Fetch User',
    description: 'Get a specific user by ID or login from Okta',
    tags: ['okta', 'user', 'fetch', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'GET',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID or login (email)',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/create': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Create User',
    description: 'Create a new user in Okta',
    tags: ['okta', 'user', 'create', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: ['/api/v1/users'],
      query: {
        activate: field({
          name: 'activate',
          type: 'boolean',
          description: 'whether to activate the user upon creation',
          default: true,
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        profile: {
          firstName: field({
            name: 'firstName',
            description: "the user's first name",
          }),
          lastName: field({
            name: 'lastName',
            description: "the user's last name",
          }),
          email: field({
            name: 'email',
            description: "the user's email address",
          }),
          login: field({
            name: 'login',
            description: "the user's login (usually email)",
          }),
          mobilePhone: field({
            name: 'mobilePhone',
            description: "the user's mobile phone number",
            optional: true,
          }),
        },
      },
    },
  }),

  'okta/user/update': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Update User',
    description: "Update an existing user's profile in Okta",
    tags: ['okta', 'user', 'update', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        profile: {
          firstName: field({
            name: 'firstName',
            description: "the user's first name",
            optional: true,
          }),
          lastName: field({
            name: 'lastName',
            description: "the user's last name",
            optional: true,
          }),
          email: field({
            name: 'email',
            description: "the user's email address",
            optional: true,
          }),
          mobilePhone: field({
            name: 'mobilePhone',
            description: "the user's mobile phone number",
            optional: true,
          }),
        },
      },
    },
  }),

  'okta/user/deactivate': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Deactivate User',
    description: 'Deactivate a user in Okta (disables their access)',
    tags: ['okta', 'user', 'deactivate', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
        '/lifecycle/deactivate',
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/activate': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Activate User',
    description: 'Activate a deactivated user in Okta',
    tags: ['okta', 'user', 'activate', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
        '/lifecycle/activate',
      ],
      query: {
        sendEmail: field({
          name: 'sendEmail',
          type: 'boolean',
          description: 'whether to send an activation email to the user',
          default: true,
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/unlock': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Unlock User',
    description: 'Unlock a locked user account in Okta',
    tags: ['okta', 'user', 'unlock', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
        '/lifecycle/unlock',
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/suspend': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Suspend User',
    description:
      'Suspend a user in Okta (user cannot sign in but retains group memberships)',
    tags: ['okta', 'user', 'suspend', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
        '/lifecycle/suspend',
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/unsuspend': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Unsuspend User',
    description: 'Unsuspend a suspended user in Okta',
    tags: ['okta', 'user', 'unsuspend', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
        '/lifecycle/unsuspend',
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/user/group/list': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'List User Groups',
    description: 'List all groups a user belongs to in Okta',
    tags: ['okta', 'user', 'group', 'list', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'GET',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/users/',
        field({
          name: 'userId',
          description: 'the user ID',
        }),
        '/groups',
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  // ===========================
  // Group Operations
  // ===========================

  'okta/group/list': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'List Groups',
    description: 'List all groups in your Okta organization',
    tags: ['okta', 'group', 'list', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'GET',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: ['/api/v1/groups'],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of groups to return (1-200)',
          default: 25,
          optional: true,
        }),
        q: field({
          name: 'q',
          description: 'search query for group name',
          optional: true,
        }),
        filter: field({
          name: 'filter',
          description:
            'filter expression for groups (e.g., type eq "OKTA_GROUP")',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/group/fetch': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Fetch Group',
    description: 'Get a specific group by ID from Okta',
    tags: ['okta', 'group', 'fetch', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'GET',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/groups/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/group/create': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Create Group',
    description: 'Create a new group in Okta',
    tags: ['okta', 'group', 'create', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'POST',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: ['/api/v1/groups'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        profile: {
          name: field({
            name: 'name',
            description: 'the name of the group',
          }),
          description: field({
            name: 'description',
            description: 'the description of the group',
            optional: true,
          }),
        },
      },
    },
  }),

  'okta/group/update': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Update Group',
    description: "Update an existing group's profile in Okta",
    tags: ['okta', 'group', 'update', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/groups/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: {
        profile: {
          name: field({
            name: 'name',
            description: 'the name of the group',
          }),
          description: field({
            name: 'description',
            description: 'the description of the group',
            optional: true,
          }),
        },
      },
    },
  }),

  'okta/group/delete': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Delete Group',
    description: 'Delete a group from Okta',
    tags: ['okta', 'group', 'delete', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/groups/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/group/member/list': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'List Group Members',
    description: 'List all members of a group in Okta',
    tags: ['okta', 'group', 'member', 'list', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'GET',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/groups/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
        '/users',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of members to return (1-200)',
          default: 25,
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/group/member/add': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Add User to Group',
    description: 'Add a user to a group in Okta',
    tags: ['okta', 'group', 'member', 'add', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'PUT',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/groups/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
        '/users/',
        field({
          name: 'userId',
          description: 'the user ID to add to the group',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/group/member/remove': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Remove User from Group',
    description: 'Remove a user from a group in Okta',
    tags: ['okta', 'group', 'member', 'remove', 'identity'],
    secret: '@okta',
    instruction: {
      method: 'DELETE',
      url: field({
        name: 'oktaUrl',
        description: 'the Okta domain URL (e.g., https://your-org.okta.com)',
        placeholder: true,
      }),
      path: [
        '/api/v1/groups/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
        '/users/',
        field({
          name: 'userId',
          description: 'the user ID to remove from the group',
        }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
      },
    },
  }),

  'okta/api/call': createFetchTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Call Okta API',
    description:
      'Make a generic API call to Okta. This is a flexible template that can be used to call any Okta API endpoint by specifying the method, URL, and request body.',
    tags: ['okta', 'api', 'call', 'generic'],
    secret: '@okta',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Okta API endpoint to call',
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

  // ===========================
  // Pack Templates
  // ===========================

  'pack/okta': createPackTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Install Okta Tools',
    description:
      'Installs Okta tools into the conversation. You can manage users, groups, and perform comprehensive identity management operations.',
    tags: ['okta', 'pack', 'beta'],
    secret: '@okta',
    instruction: {
      abilities: [
        'okta/user/list',
        'okta/user/fetch',
        'okta/user/create',
        'okta/user/update',
        'okta/user/deactivate',
        'okta/user/activate',
        'okta/user/unlock',
        'okta/user/suspend',
        'okta/user/unsuspend',
        'okta/user/group/list',
        'okta/group/list',
        'okta/group/fetch',
        'okta/group/create',
        'okta/group/update',
        'okta/group/delete',
        'okta/group/member/list',
        'okta/group/member/add',
        'okta/group/member/remove',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/okta[read-only]': createPackTemplate({
    provider: 'okta',
    icon: '@logo/okta.com',
    name: 'Install Okta Search Tools',
    description:
      'Installs read-only Okta tools into the conversation. You can list users, groups, and retrieve information without modification.',
    tags: ['okta', 'pack', 'beta'],
    secret: '@okta',
    instruction: {
      abilities: [
        'okta/user/list',
        'okta/user/fetch',
        'okta/user/group/list',
        'okta/group/list',
        'okta/group/fetch',
        'okta/group/member/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
