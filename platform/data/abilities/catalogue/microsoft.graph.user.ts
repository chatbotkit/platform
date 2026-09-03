import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Microsoft Graph Users/Directory abilities.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/user
 */
const abilities = {
  'microsoft/graph/user/me': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Get Current User',
    description: 'Get profile information for the currently signed-in user',
    tags: ['microsoft', 'users', 'profile'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description:
            'fields to select, e.g., displayName, mail, jobTitle, department',
          optional: true,
        }),
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  mail: mail,
  userPrincipalName: userPrincipalName,
  jobTitle: jobTitle,
  department: department,
  officeLocation: officeLocation,
  mobilePhone: mobilePhone,
  businessPhones: businessPhones
}`,
      },
    },
  }),

  'microsoft/graph/user/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Users',
    description: 'List users in the organization directory',
    tags: ['microsoft', 'users', 'directory'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/users',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description:
            'fields to select, e.g., displayName, mail, jobTitle, department',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of users to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of users to skip for pagination',
          optional: true,
        }),
        $filter: field({
          name: 'filter',
          description: "filter expression, e.g., department eq 'Engineering'",
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  mail: mail,
  userPrincipalName: userPrincipalName,
  jobTitle: jobTitle,
  department: department
}`,
      },
    },
  }),

  'microsoft/graph/user/search': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Search Users',
    description: 'Search for users in the organization by name or email',
    tags: ['microsoft', 'users', 'directory', 'search'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/users',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual',
      },
      query: {
        $search: field({
          name: 'search',
          description: 'search query, e.g., "displayName:John" or "mail:john@"',
        }),
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, mail, jobTitle',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of users to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $count: 'true',
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  mail: mail,
  userPrincipalName: userPrincipalName,
  jobTitle: jobTitle,
  department: department
}`,
      },
    },
  }),

  'microsoft/graph/user/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch User',
    description: 'Get details of a specific user by their ID or email',
    tags: ['microsoft', 'users', 'directory'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/users',
      path: [
        '/',
        field({
          name: 'userId',
          description: 'the user ID or userPrincipalName (email)',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description:
            'fields to select, e.g., displayName, mail, jobTitle, department',
          optional: true,
        }),
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  givenName: givenName,
  surname: surname,
  mail: mail,
  userPrincipalName: userPrincipalName,
  jobTitle: jobTitle,
  department: department,
  officeLocation: officeLocation,
  mobilePhone: mobilePhone,
  businessPhones: businessPhones,
  companyName: companyName
}`,
      },
    },
  }),

  'microsoft/graph/user/manager/fetch': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Fetch User Manager',
    description: "Get a user's manager",
    tags: ['microsoft', 'users', 'directory', 'org'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/users',
      path: [
        '/',
        field({
          name: 'userId',
          description: 'the user ID or userPrincipalName (email)',
        }),
        '/manager',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
  id: id,
  displayName: displayName,
  mail: mail,
  jobTitle: jobTitle,
  department: department
}`,
      },
    },
  }),

  'microsoft/graph/user/direct-reports/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Direct Reports',
    description: "List a user's direct reports",
    tags: ['microsoft', 'users', 'directory', 'org'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/users',
      path: [
        '/',
        field({
          name: 'userId',
          description: 'the user ID or userPrincipalName (email)',
        }),
        '/directReports',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, mail, jobTitle',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of direct reports to return',
          placeholder: true,
          default: 20,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  mail: mail,
  jobTitle: jobTitle,
  department: department
}`,
      },
    },
  }),

  'microsoft/graph/group/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Groups',
    description: 'List groups in the organization',
    tags: ['microsoft', 'groups', 'directory'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/groups',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, description, mail',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of groups to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $filter: field({
          name: 'filter',
          description:
            "filter expression, e.g., groupTypes/any(c:c eq 'Unified')",
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  description: description,
  mail: mail,
  groupTypes: groupTypes
}`,
      },
    },
  }),

  'microsoft/graph/group/members/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Group Members',
    description: 'List members of a specific group',
    tags: ['microsoft', 'groups', 'directory'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/groups',
      path: [
        '/',
        field({
          name: 'groupId',
          description: 'the group ID',
        }),
        '/members',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., displayName, mail, jobTitle',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of members to return',
          placeholder: true,
          default: 20,
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  displayName: displayName,
  mail: mail,
  jobTitle: jobTitle,
  userPrincipalName: userPrincipalName
}`,
      },
    },
  }),
}

export default abilities
