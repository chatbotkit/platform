import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * PlanetScale API abilities.
 *
 * Focused on the observability surface - anomalies, query insights, query
 * errors and the webhook plumbing that pushes alerts out - plus the read-only
 * context (organizations, databases, branches, deploy requests) an agent needs
 * to correlate a regression with whatever shipped just before it.
 *
 * @note PlanetScale authenticates service tokens with a bare
 * `Authorization: <TOKEN_ID>:<TOKEN>` header - no `Bearer` scheme - so the
 * `@planetscale` secret is `plain` and is injected verbatim.
 *
 * @see https://planetscale.com/docs/api/reference/getting-started-with-planetscale-api
 */
const abilities = {
  // --- Organizations ---

  'planetscale/organization/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Organizations',
    description:
      'Retrieve the list of PlanetScale organizations the service token can access',
    tags: ['planetscale', 'organization', 'list', 'database'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1/organizations',
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  // --- Databases ---

  'planetscale/database/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Databases',
    description: 'Retrieve the list of databases in a PlanetScale organization',
    tags: ['planetscale', 'database', 'list'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        q: field({
          name: 'q',
          description: 'filter databases by name',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  // --- Branches ---

  'planetscale/branch/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Branches',
    description:
      'Retrieve the list of branches for a PlanetScale database, including which one is the production branch',
    tags: ['planetscale', 'branch', 'list', 'database'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        production: field({
          name: 'production',
          type: 'boolean',
          description: 'only return production branches',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/branch/fetch': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Fetch PlanetScale Branch',
    description:
      'Retrieve a single PlanetScale branch including its state, region and cluster configuration',
    tags: ['planetscale', 'branch', 'fetch', 'database'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Anomalies ---

  'planetscale/anomaly/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Anomalies',
    description:
      'Retrieve the anomalies detected on a PlanetScale branch. An anomaly is a period with a substantially elevated percentage of queries running slower than the 2-sigma baseline.',
    tags: ['planetscale', 'anomaly', 'list', 'insights', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights/anomalies',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        period: field({
          name: 'period',
          description: 'the time period to report on e.g. 1h, 6h, 24h, 7d',
          optional: true,
        }),
        from: field({
          name: 'from',
          description: 'the start of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        to: field({
          name: 'to',
          description: 'the end of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/anomaly/fetch': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Fetch PlanetScale Anomaly',
    description:
      'Retrieve a single PlanetScale anomaly by id, including when it started, how long it lasted and the queries implicated in it',
    tags: ['planetscale', 'anomaly', 'fetch', 'insights', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights/anomalies/',
        field({
          name: 'id',
          description: 'the anomaly id, as carried by the branch.anomaly event',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Query insights ---

  'planetscale/query/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Queries',
    description:
      'Retrieve the queries running against a PlanetScale branch with their performance metrics - rows read, rows returned, duration and the normalized SQL. Sort by rows read to find queries scanning far more than they return.',
    tags: ['planetscale', 'query', 'list', 'insights', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        q: field({
          name: 'q',
          description: 'filter queries by their normalized SQL',
          optional: true,
        }),
        period: field({
          name: 'period',
          description: 'the time period to report on e.g. 1h, 6h, 24h, 7d',
          optional: true,
        }),
        from: field({
          name: 'from',
          description: 'the start of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        to: field({
          name: 'to',
          description: 'the end of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        sort: field({
          name: 'sort',
          description:
            'the field to sort by e.g. rows_read, rows_returned, total_duration_millis, query_count',
          optional: true,
        }),
        dir: field({
          name: 'dir',
          enum: ['asc', 'desc'],
          description: 'the sort direction',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/query/fetch[by-fingerprint]': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Fetch PlanetScale Query Statistics',
    description:
      'Retrieve the per-execution statistics for a single query fingerprint on a PlanetScale branch - rows read, rows affected, rows returned, duration and the tables touched',
    tags: ['planetscale', 'query', 'fetch', 'insights', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights/',
        field({ name: 'fingerprint', description: 'the query fingerprint' }),
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        keyspace: field({
          name: 'keyspace',
          description: 'filter by keyspace',
          optional: true,
        }),
        period: field({
          name: 'period',
          description: 'the time period to report on e.g. 1h, 6h, 24h, 7d',
          optional: true,
        }),
        from: field({
          name: 'from',
          description: 'the start of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        to: field({
          name: 'to',
          description: 'the end of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/query/summary/fetch[by-fingerprint]': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Fetch PlanetScale Query Summary',
    description:
      'Retrieve the aggregated summary of a single query fingerprint on a PlanetScale branch over a time window - useful for comparing a query against how it behaved before',
    tags: ['planetscale', 'query', 'summary', 'fetch', 'insights'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights/',
        field({ name: 'fingerprint', description: 'the query fingerprint' }),
        '/summary',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        keyspace: field({
          name: 'keyspace',
          description: 'filter by keyspace',
          optional: true,
        }),
        period: field({
          name: 'period',
          description: 'the time period to report on e.g. 1h, 6h, 24h, 7d',
          optional: true,
        }),
        from: field({
          name: 'from',
          description: 'the start of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        to: field({
          name: 'to',
          description: 'the end of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
      },
    },
  }),

  // --- Query errors ---

  'planetscale/query/error/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Query Errors',
    description:
      'Retrieve the queries that errored on a PlanetScale branch, grouped by fingerprint, with their error messages',
    tags: ['planetscale', 'query', 'error', 'list', 'insights'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights/errors',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        q: field({
          name: 'q',
          description: 'filter errors by their normalized SQL',
          optional: true,
        }),
        period: field({
          name: 'period',
          description: 'the time period to report on e.g. 1h, 6h, 24h, 7d',
          optional: true,
        }),
        from: field({
          name: 'from',
          description: 'the start of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        to: field({
          name: 'to',
          description: 'the end of the time range as an ISO 8601 timestamp',
          optional: true,
        }),
        sort: field({
          name: 'sort',
          description: 'the field to sort by',
          optional: true,
        }),
        dir: field({
          name: 'dir',
          enum: ['asc', 'desc'],
          description: 'the sort direction',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/query/error/fetch[by-fingerprint]': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Fetch PlanetScale Query Error',
    description:
      'Retrieve the details of a single errored query fingerprint on a PlanetScale branch',
    tags: ['planetscale', 'query', 'error', 'fetch', 'insights'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/branches/',
        field({ name: 'branch', description: 'the branch name' }),
        '/insights/errors/',
        field({ name: 'fingerprint', description: 'the query fingerprint' }),
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        period: field({
          name: 'period',
          description: 'the time period to report on e.g. 1h, 6h, 24h, 7d',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  // --- Deploy requests ---

  'planetscale/deploy-request/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Deploy Requests',
    description:
      'Retrieve the deploy requests for a PlanetScale database. Use this to correlate a performance regression with whatever schema change shipped just before it.',
    tags: ['planetscale', 'deploy-request', 'list', 'schema'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/deploy-requests',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        state: field({
          name: 'state',
          enum: ['open', 'closed', 'merged'],
          description: 'filter by deploy request state',
          optional: true,
        }),
        branch: field({
          name: 'branch',
          description: 'filter by source branch',
          optional: true,
        }),
        into_branch: field({
          name: 'into_branch',
          description: 'filter by target branch',
          optional: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/deploy-request/fetch': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Fetch PlanetScale Deploy Request',
    description:
      'Retrieve a single PlanetScale deploy request by number, including its state and deployment details',
    tags: ['planetscale', 'deploy-request', 'fetch', 'schema'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/deploy-requests/',
        field({ name: 'number', description: 'the deploy request number' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Webhooks ---

  'planetscale/webhook/list': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'List PlanetScale Webhooks',
    description:
      'Retrieve the webhooks configured on a PlanetScale database and the events each one subscribes to',
    tags: ['planetscale', 'webhook', 'list', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'GET',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/webhooks',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number',
          optional: true,
        }),
        per_page: field({
          name: 'per_page',
          type: 'number',
          description: 'number of records per page',
          optional: true,
        }),
      },
    },
  }),

  'planetscale/webhook/create': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Create PlanetScale Webhook',
    description:
      'Create a webhook on a PlanetScale database so it POSTs events to a URL. Subscribe to events such as branch.anomaly, branch.out_of_memory, branch.schema_recommendation, cluster.storage, keyspace.storage and the deploy_request.* lifecycle.',
    tags: ['planetscale', 'webhook', 'create', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'POST',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/webhooks',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url: field({
          name: 'url',
          description: 'the URL the webhook will send events to',
        }),
        enabled: field({
          name: 'enabled',
          type: 'boolean',
          description: 'whether the webhook is enabled',
          optional: true,
        }),
        events: array({
          name: 'events',
          description:
            'the events to subscribe to e.g. branch.anomaly, branch.out_of_memory, branch.schema_recommendation, cluster.storage, keyspace.storage, deploy_request.errored, deploy_request.reverted, database.access_request',
          optional: true,
          items: field({
            name: 'event',
            description: 'the event name',
          }),
        }),
      },
    },
  }),

  'planetscale/webhook/delete': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Delete PlanetScale Webhook',
    description: 'Delete a webhook from a PlanetScale database',
    tags: ['planetscale', 'webhook', 'delete', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'DELETE',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/webhooks/',
        field({ name: 'id', description: 'the webhook id' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'planetscale/webhook/test': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Test PlanetScale Webhook',
    description:
      'Send a test event to a PlanetScale webhook to verify the receiving endpoint works. Limited to one test every 20 seconds.',
    tags: ['planetscale', 'webhook', 'test', 'monitoring'],
    secret: '@planetscale',
    instruction: {
      method: 'POST',
      url: 'https://api.planetscale.com/v1',
      path: [
        '/organizations/',
        field({ name: 'organization', description: 'the organization name' }),
        '/databases/',
        field({ name: 'database', description: 'the database name' }),
        '/webhooks/',
        field({ name: 'id', description: 'the webhook id' }),
        '/test',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Generic ---

  'planetscale/api/call': createFetchTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Call PlanetScale API',
    description:
      'Make a generic API call to PlanetScale. This is a flexible template that can be used to call any PlanetScale API endpoint by specifying the method, URL, and request body.',
    tags: ['planetscale', 'api', 'call', 'generic'],
    secret: '@planetscale',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description:
          'The full URL of the PlanetScale API endpoint to call e.g. https://api.planetscale.com/v1/organizations',
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

  // --- Packs ---

  'pack/planetscale[insights]': createPackTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Install PlanetScale Insights Tools',
    description:
      'Installs read-only PlanetScale observability tools into the conversation. You can investigate anomalies, query performance and query errors, and correlate them with recent deploy requests.',
    tags: ['planetscale', 'pack', 'insights', 'monitoring', 'beta'],
    secret: '@planetscale',
    instruction: {
      abilities: [
        'planetscale/organization/list',
        'planetscale/database/list',
        'planetscale/branch/list',
        'planetscale/branch/fetch',
        'planetscale/anomaly/list',
        'planetscale/anomaly/fetch',
        'planetscale/query/list',
        'planetscale/query/fetch[by-fingerprint]',
        'planetscale/query/summary/fetch[by-fingerprint]',
        'planetscale/query/error/list',
        'planetscale/query/error/fetch[by-fingerprint]',
        'planetscale/deploy-request/list',
        'planetscale/deploy-request/fetch',
      ],
    },
  }),

  'pack/planetscale[webhooks]': createPackTemplate({
    provider: 'planetscale',
    icon: '@logo/planetscale.com',
    name: 'Install PlanetScale Webhook Tools',
    description:
      'Installs PlanetScale webhook management tools into the conversation. You can list, create, delete and test the webhooks that push database events to an endpoint.',
    tags: ['planetscale', 'pack', 'webhook', 'monitoring', 'beta'],
    secret: '@planetscale',
    instruction: {
      abilities: [
        'planetscale/webhook/list',
        'planetscale/webhook/create',
        'planetscale/webhook/delete',
        'planetscale/webhook/test',
      ],
    },
  }),
}

export default abilities
