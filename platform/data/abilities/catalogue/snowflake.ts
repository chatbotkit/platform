import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Snowflake SQL REST API abilities for executing queries.
 *
 * @see https://docs.snowflake.com/en/developer-guide/sql-api/index
 */

const SNOWFLAKE_SETUP = `To use the Snowflake SQL REST API:

1. **Set up key pair authentication**:
   - Generate an RSA key pair
   - Assign the public key to your Snowflake user: \`ALTER USER username SET RSA_PUBLIC_KEY='...';\`

2. **Generate a JWT token**:
   - Create a JWT with claims: iss (ACCOUNT.USERNAME), sub (ACCOUNT.USERNAME), iat, exp
   - Sign with your private key using RS256

3. **Find your account identifier**:
   - Format: \`<orgname>-<account_name>\` or \`<account_locator>.<region>.<cloud>\`
   - Example: \`xy12345.us-east-1.aws\`

For detailed setup instructions, see: https://docs.snowflake.com/en/developer-guide/sql-api/authenticating`

const abilities = {
  'snowflake/query/execute': createFetchTemplate({
    provider: 'snowflake',
    icon: '@logo/snowflake.com',
    name: 'Execute Snowflake Query',
    description:
      'Execute a SQL query against a Snowflake database using the SQL REST API and retrieve results in JSON format.',
    tags: [
      'snowflake',
      'database',
      'sql',
      'query',
      'analytics',
      'data-warehouse',
    ],
    setup: SNOWFLAKE_SETUP,
    secret: '@snowflake',
    instruction: {
      method: 'POST',
      url: field({
        name: 'accountUrl',
        description:
          'the Snowflake account URL in format https://<account_identifier>.snowflakecomputing.com/api/v2/statements',
        placeholder: true,
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
      },
      body: {
        statement: field({
          name: 'statement',
          description:
            'the SQL statement to execute - supports SELECT, SHOW, DESCRIBE, and other read operations',
          placeholder: false,
        }),
        timeout: field({
          name: 'timeout',
          type: 'number',
          description: 'query timeout in seconds (default: 60)',
          optional: true,
          default: 60,
        }),
        database: field({
          name: 'database',
          description: 'the database to use for the query',
          optional: true,
          placeholder: true,
        }),
        schema: field({
          name: 'schema',
          description: 'the schema to use for the query',
          optional: true,
          placeholder: true,
        }),
        warehouse: field({
          name: 'warehouse',
          description: 'the warehouse to use for the query',
          optional: true,
          placeholder: true,
        }),
        role: field({
          name: 'role',
          description: 'the role to use for the query',
          optional: true,
          placeholder: true,
        }),
      },
    },
  }),

  'snowflake/query/status': createFetchTemplate({
    provider: 'snowflake',
    icon: '@logo/snowflake.com',
    name: 'Get Snowflake Query Status',
    description:
      'Check the status of a previously submitted Snowflake query using its statement handle.',
    tags: ['snowflake', 'database', 'sql', 'query', 'status'],
    setup: SNOWFLAKE_SETUP,
    secret: '@snowflake',
    instruction: {
      method: 'GET',
      url: field({
        name: 'statusUrl',
        description:
          'the Snowflake status URL in format https://<account_identifier>.snowflakecomputing.com/api/v2/statements/<statementHandle>',
        placeholder: true,
      }),
      headers: {
        Authorization: secret(),
        Accept: 'application/json',
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
      },
    },
  }),

  'snowflake/query/cancel': createFetchTemplate({
    provider: 'snowflake',
    icon: '@logo/snowflake.com',
    name: 'Cancel Snowflake Query',
    description: 'Cancel a running Snowflake query using its statement handle.',
    tags: ['snowflake', 'database', 'sql', 'query', 'cancel'],
    setup: SNOWFLAKE_SETUP,
    secret: '@snowflake',
    instruction: {
      method: 'POST',
      url: field({
        name: 'cancelUrl',
        description:
          'the Snowflake cancel URL in format https://<account_identifier>.snowflakecomputing.com/api/v2/statements/<statementHandle>/cancel',
        placeholder: true,
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
      },
    },
  }),

  'snowflake/api/call': createFetchTemplate({
    provider: 'snowflake',
    icon: '@logo/snowflake.com',
    name: 'Call Snowflake API',
    description:
      'Make a generic API call to Snowflake. This is a flexible template that can be used to call any Snowflake API endpoint by specifying the method, URL, and request body.',
    tags: ['snowflake', 'query', 'api', 'call', 'generic'],
    secret: '@snowflake',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Snowflake API endpoint to call',
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
