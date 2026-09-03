import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of ClickHouse abilities.
 */
const abilities = {
  'clickhouse/query/execute': createFetchTemplate({
    provider: 'clickhouse',
    icon: '@logo/clickhouse.com',
    name: 'Execute ClickHouse Query',
    description:
      'Execute a SQL query against a ClickHouse database and retrieve results in JSON format',
    tags: ['clickhouse', 'database', 'sql', 'query', 'analytics'],
    secret: '@clickhouse',
    instruction: {
      method: 'POST',
      url: field({
        name: 'url',
        description:
          'the ClickHouse HTTP endpoint URL (e.g., https://your-server:8443)',
        placeholder: true,
      }),
      query: {
        default_format: 'JSON',
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'text/plain',
      },
      body: field({
        name: 'sql',
        description:
          'the SQL query to execute - use SELECT for reading data, or SHOW/DESCRIBE for metadata',
        placeholder: false,
      }),
    },
  }),

  'clickhouse/api/call': createFetchTemplate({
    provider: 'clickhouse',
    icon: '@logo/clickhouse.com',
    name: 'Call Clickhouse API',
    description:
      'Make a generic API call to Clickhouse. This is a flexible template that can be used to call any Clickhouse API endpoint by specifying the method, URL, and request body.',
    tags: ['clickhouse', 'query', 'execute', 'api', 'call', 'generic'],
    secret: '@clickhouse',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Clickhouse API endpoint to call',
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
}

export default abilities
