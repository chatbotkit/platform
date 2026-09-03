import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

// @see https://pipedream.com/apps/linkedin
// @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
// @see https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api

const abilities = {
  'linkedin/profile/fetch': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Get Current LinkedIn Profile',
    description:
      'Retrieve the current authenticated member profile information from LinkedIn using v2 API',
    tags: ['linkedin', 'profile', 'user'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/v2/me',
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
      },
    },
  }),

  'linkedin/profile/fetch[by-id]': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Get LinkedIn Profile by ID',
    description:
      "Gets another member's profile given their person ID. Requires appropriate permissions.",
    tags: ['linkedin', 'profile', 'fetch'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/rest/people/(id:',
      path: [
        field({
          name: 'personId',
          description: 'The person ID of the member to retrieve',
          placeholder: true,
        }),
        ')',
      ],
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
    },
  }),

  'linkedin/profile/picture/fetch': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Get LinkedIn Profile Picture',
    description:
      "Gets the authenticated user's profile picture data including display image and metadata",
    tags: ['linkedin', 'profile', 'picture', 'fetch'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/v2/me',
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
      },
      query: {
        projection:
          '(id,profilePicture(displayImage~digitalmediaAsset:playableStreams))',
      },
    },
  }),

  'linkedin/post/create[user]': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Create LinkedIn Post (User)',
    description:
      'Create a text post on LinkedIn as the authenticated user. Requires the user person URN.',
    tags: ['linkedin', 'post', 'create', 'user'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'POST',
      url: 'https://api.linkedin.com/rest/posts',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
      body: {
        author: field({
          name: 'author',
          description:
            'Person URN of the post author in format urn:li:person:{id}',
          placeholder: true,
        }),
        commentary: field({
          name: 'commentary',
          description: 'The text content of the post',
        }),
        visibility: field({
          name: 'visibility',
          description: 'Post visibility',
          enum: ['PUBLIC', 'CONNECTIONS'],
          default: 'PUBLIC',
          optional: true,
        }),
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      },
    },
  }),

  'linkedin/post/create[organization]': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Create LinkedIn Post (Organization)',
    description:
      'Create a text post on LinkedIn on behalf of an organization. Requires the organization URN and appropriate permissions.',
    tags: ['linkedin', 'post', 'create', 'organization'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'POST',
      url: 'https://api.linkedin.com/rest/posts',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
      body: {
        author: field({
          name: 'author',
          description:
            'Organization URN of the post author in format urn:li:organization:{id}',
          placeholder: true,
        }),
        commentary: field({
          name: 'commentary',
          description: 'The text content of the post',
        }),
        visibility: field({
          name: 'visibility',
          description: 'Post visibility',
          enum: ['PUBLIC'],
          default: 'PUBLIC',
          optional: true,
        }),
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      },
    },
  }),

  'linkedin/post/delete': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Delete LinkedIn Post',
    description:
      'Delete a post from LinkedIn using the post URN (share or ugcPost URN)',
    tags: ['linkedin', 'post', 'delete'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'DELETE',
      url: 'https://api.linkedin.com/rest/posts/',
      path: [
        field({
          name: 'postUrn',
          description:
            'The URL-encoded post URN to delete, e.g. urn%3Ali%3Ashare%3A1234567890',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'X-RestLi-Method': 'DELETE',
        'LinkedIn-Version': '202509',
      },
    },
  }),

  'linkedin/post/fetch': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Get LinkedIn Post',
    description: 'Retrieve a specific post from LinkedIn using the post URN',
    tags: ['linkedin', 'post', 'fetch'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/rest/posts/',
      path: [
        field({
          name: 'postUrn',
          description:
            'The URL-encoded post URN to retrieve, e.g. urn%3Ali%3Ashare%3A1234567890',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
    },
  }),

  'linkedin/post/list[by-author]': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'List LinkedIn Posts by Author',
    description:
      'Retrieve all posts for a member or organization using their URN. Note: Listing member posts requires r_member_social scope; organization posts require r_organization_social scope.',
    tags: ['linkedin', 'post', 'list'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/rest/posts',
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'X-RestLi-Method': 'FINDER',
        'LinkedIn-Version': '202509',
      },
      query: {
        q: 'author',
        author: field({
          name: 'author',
          description:
            'Organization URN (e.g. urn:li:organization:123456). For member posts, use urn:li:person:{id} but requires r_member_social scope.',
          placeholder: true,
        }),
        count: field({
          name: 'count',
          type: 'number',
          description: 'Number of posts to return (max 100)',
          default: 10,
          optional: true,
        }),
        sortBy: field({
          name: 'sortBy',
          description: 'Sort order for results',
          enum: ['LAST_MODIFIED', 'CREATED'],
          default: 'LAST_MODIFIED',
          optional: true,
        }),
      },
    },
  }),

  'linkedin/comment/create': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Create LinkedIn Comment',
    description:
      'Create a comment on a LinkedIn post or user generated content using REST API',
    tags: ['linkedin', 'comment', 'create'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'POST',
      url: 'https://api.linkedin.com/rest/socialActions/',
      path: [
        field({
          name: 'postUrn',
          description:
            'The URL-encoded post URN to comment on, e.g. urn%3Ali%3Ashare%3A1234567890 or urn%3Ali%3AugcPost%3A1234567890',
          placeholder: true,
        }),
        '/comments',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
      body: {
        actor: field({
          name: 'actor',
          description:
            'Person or Organization URN of the commenter, e.g. urn:li:person:abc123',
          placeholder: true,
        }),
        object: field({
          name: 'object',
          description:
            'Activity URN of the post to comment on, e.g. urn:li:activity:1234567890',
          placeholder: true,
        }),
        message: {
          text: field({
            name: 'message',
            description: 'The text content of the comment',
          }),
        },
      },
    },
  }),

  'linkedin/comment/list[by-post]': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'List Comments on LinkedIn Post',
    description:
      'Retrieve comments on a LinkedIn share or user generated content post',
    tags: ['linkedin', 'comment', 'list'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/rest/socialActions/',
      path: [
        field({
          name: 'postUrn',
          description:
            'The URL-encoded post URN to get comments for, e.g. urn%3Ali%3Ashare%3A1234567890',
          placeholder: true,
        }),
        '/comments',
      ],
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
    },
  }),

  'linkedin/like/create': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Like LinkedIn Post',
    description: 'Create a like on a LinkedIn share or user generated content',
    tags: ['linkedin', 'like', 'create'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'POST',
      url: 'https://api.linkedin.com/rest/socialActions/',
      path: [
        field({
          name: 'postUrn',
          description:
            'The URL-encoded post URN to like, e.g. urn%3Ali%3Ashare%3A1234567890',
          placeholder: true,
        }),
        '/likes',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
      body: {
        actor: field({
          name: 'actor',
          description:
            'Person or Organization URN performing the like, e.g. urn:li:person:abc123',
          placeholder: true,
        }),
        object: field({
          name: 'object',
          description:
            'Activity URN of the post to like, e.g. urn:li:activity:1234567890',
          placeholder: true,
        }),
      },
    },
  }),

  'linkedin/organization/access-control/list': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: "List Member's Organization Access",
    description:
      'Get the list of organizations the authenticated member has access to manage, along with their roles',
    tags: ['linkedin', 'organization', 'access', 'list'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/v2/organizationAcls',
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
      },
      query: {
        q: 'roleAssignee',
        projection: '(elements*(organization~(id,localizedName,vanityName)))',
      },
    },
  }),

  'linkedin/organization/administrators/list': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'List LinkedIn Organization Administrators',
    description:
      'Get the administrator members of a selected organization on LinkedIn',
    tags: ['linkedin', 'organization', 'administrators', 'list'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/rest/organizationAcls',
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
      query: {
        q: 'organization',
        organization: field({
          name: 'organizationUrn',
          description: 'Organization URN, e.g. urn:li:organization:123456',
          placeholder: true,
        }),
        role: field({
          name: 'role',
          description: 'Filter by role',
          enum: ['ADMINISTRATOR', 'DIRECT_SPONSORED_CONTENT_POSTER'],
          default: 'ADMINISTRATOR',
          optional: true,
        }),
        state: field({
          name: 'state',
          description: 'Filter by state',
          enum: ['APPROVED', 'PENDING', 'REVOKED'],
          default: 'APPROVED',
          optional: true,
        }),
      },
    },
  }),

  'linkedin/organization/search': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Search LinkedIn Organizations',
    description:
      'Search for an organization by vanity name or email domain on LinkedIn',
    tags: ['linkedin', 'organization', 'search'],
    secret: '@platform/linkedin',
    instruction: {
      method: 'GET',
      url: 'https://api.linkedin.com/rest/organizations',
      headers: {
        Authorization: secret(),
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202509',
      },
      query: {
        q: field({
          name: 'searchType',
          description: 'Search type: vanityName or emailDomain',
          enum: ['vanityName', 'emailDomain'],
          default: 'vanityName',
        }),
        vanityName: field({
          name: 'vanityName',
          description:
            'The vanity name of the organization (used when searchType is vanityName)',
          optional: true,
        }),
        emailDomain: field({
          name: 'emailDomain',
          description:
            'The email domain to search for (used when searchType is emailDomain)',
          optional: true,
        }),
      },
    },
  }),

  'linkedin/api/call': createFetchTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Call Linkedin API',
    description:
      'Make a generic API call to Linkedin. This is a flexible template that can be used to call any Linkedin API endpoint by specifying the method, URL, and request body.',
    tags: ['linkedin', 'api', 'call', 'generic'],
    secret: '@platform/linkedin',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Linkedin API endpoint to call',
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

  // ============================================================================
  // Pack Templates
  // ============================================================================

  'pack/linkedin': createPackTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Install LinkedIn Tools',
    description:
      'Installs LinkedIn tools into the conversation. You can manage posts, comments, and access organization data.',
    tags: ['linkedin', 'pack', 'beta'],
    secret: '@platform/linkedin',
    instruction: {
      abilities: [
        'linkedin/profile/fetch',
        'linkedin/profile/fetch[by-id]',
        'linkedin/profile/picture/fetch',
        'linkedin/post/create[user]',
        'linkedin/post/create[organization]',
        'linkedin/post/delete',
        'linkedin/post/fetch',
        'linkedin/post/list[by-author]',
        'linkedin/comment/create',
        'linkedin/comment/list[by-post]',
        'linkedin/like/create',
        'linkedin/organization/access-control/list',
        'linkedin/organization/administrators/list',
        'linkedin/organization/search',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/linkedin[read-only]': createPackTemplate({
    provider: 'linkedin',
    icon: '@logo/linkedin.com',
    name: 'Install LinkedIn Search Tools',
    description:
      'Installs read-only LinkedIn tools into the conversation. You can fetch profiles, posts, and organization data without modification.',
    tags: ['linkedin', 'pack', 'beta'],
    secret: '@platform/linkedin',
    instruction: {
      abilities: [
        'linkedin/profile/fetch',
        'linkedin/profile/fetch[by-id]',
        'linkedin/profile/picture/fetch',
        'linkedin/post/fetch',
        'linkedin/post/list[by-author]',
        'linkedin/comment/list[by-post]',
        'linkedin/organization/access-control/list',
        'linkedin/organization/administrators/list',
        'linkedin/organization/search',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
