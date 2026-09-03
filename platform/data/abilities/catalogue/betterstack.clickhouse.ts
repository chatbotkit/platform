import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of BetterStack ClickHouse abilities for querying logs via the
 * ClickHouse HTTP API.
 *
 * @see https://betterstack.com/docs/logs/clickhouse/
 */

const BETTERSTACK_CLICKHOUSE_SETUP = `To obtain your BetterStack ClickHouse credentials:

1. Log in to your BetterStack account at https://betterstack.com
2. Navigate to Dashboards → Connect remotely in the side menu
3. Click "Connect ClickHouse HTTP client"
4. Follow the instructions in the form and click "Create connection"
5. Copy the password shown in the flash message and store it securely (you won't be able to access it again)

You will need the following values:
- **HTTP Endpoint URL**: The connection URL (e.g., https://eu-nbg-2-connect.betterstackdata.com)
- **Username and Password**: Add to the basic auth secret associated with this ability
- **Table prefix**: Replace {TABLE_PREFIX} in the example queries with your table prefix from the Connections page (e.g., t123456_your_source)

**Storage Types**:
- \`remote({TABLE_PREFIX}_logs)\` - Hot storage with ~1 hour retention for real-time queries
- \`s3Cluster(primary, {TABLE_PREFIX}_s3)\` - Cold storage with longer retention for historical queries (filter with \`_row_type = 1\`)

**Example: Check available time range**:
\`\`\`sql
SELECT min(dt) as earliest, max(dt) as latest, count(*) as total FROM s3Cluster(primary, {TABLE_PREFIX}_s3) FORMAT JSONEachRow
\`\`\`

For more details, see: https://betterstack.com/docs/logs/query-api/connect-remotely/`

const abilities = {
  'betterstack/logs/query': createFetchTemplate({
    provider: 'betterstack',
    icon: '@logo/betterstack.com',
    name: 'Query BetterStack Logs',
    description:
      'Execute a SQL query against BetterStack Logs via the ClickHouse HTTP API. Use this to search, filter, and analyze your log data with powerful SQL queries.',
    tags: ['betterstack', 'logs', 'clickhouse', 'sql', 'query', 'analytics'],
    setup: BETTERSTACK_CLICKHOUSE_SETUP,
    secret: '@betterstack[clickhouse]',
    instruction: {
      method: 'POST',
      url: field({
        name: 'baseUrl',
        description:
          'the BetterStack ClickHouse HTTP endpoint URL from your Connections page (e.g., https://eu-nbg-2-connect.betterstackdata.com)',
        placeholder: true,
      }),
      query: {
        output_format_pretty_row_numbers: '0',
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'text/plain',
      },
      body: field({
        name: 'sql',
        description:
          'the SQL query to execute - SELECT queries against your log data using ClickHouse SQL syntax. Use FORMAT JSON or FORMAT JSONEachRow for structured output.',
        placeholder: false,
      }),
      options: {
        transformNestedStrings: { json: true },
      },
    },
  }),

  'betterstack/logs/query[recent]': createFetchTemplate({
    provider: 'betterstack',
    icon: '@logo/betterstack.com',
    name: 'Query Recent BetterStack Logs',
    description: `Query recent log entries from BetterStack Logs.

**First, check available log retention:**
SELECT min(dt) as earliest, max(dt) as latest, count(*) as total FROM remote({TABLE_PREFIX}_logs) FORMAT JSONEachRow

**Then query within the available range:**
SELECT dt, raw 
FROM remote({TABLE_PREFIX}_logs)
WHERE dt >= now() - INTERVAL 30 MINUTE
ORDER BY dt DESC
LIMIT 100
FORMAT JSONEachRow

Note: Log retention varies by plan. Always verify available time range before querying historical data.`,
    commentary:
      'This is a convenient preset for fetching the most recent logs with optional filtering. Always check retention first as log availability varies by plan.',
    tags: ['betterstack', 'logs', 'clickhouse', 'sql', 'query', 'recent'],
    setup: BETTERSTACK_CLICKHOUSE_SETUP,
    secret: '@betterstack[clickhouse]',
    instruction: {
      method: 'POST',
      url: field({
        name: 'baseUrl',
        description:
          'the BetterStack ClickHouse HTTP endpoint URL from your Connections page (e.g., https://eu-nbg-2-connect.betterstackdata.com)',
        placeholder: true,
      }),
      query: {
        output_format_pretty_row_numbers: '0',
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'text/plain',
      },
      body: field({
        name: 'sql',
        description:
          'the SQL query to execute - use the example query format above, adjusting filters as needed. Use JSONExtract to filter by specific fields in the raw JSON.',
        placeholder: false,
      }),
      options: {
        transformNestedStrings: { json: true },
      },
    },
  }),

  'betterstack/logs/query[historical]': createFetchTemplate({
    provider: 'betterstack',
    icon: '@logo/betterstack.com',
    name: 'Query Historical BetterStack Logs',
    description: `Query historical log entries from BetterStack Logs using S3 cold storage.

**Check available historical range:**
SELECT min(dt) as earliest, max(dt) as latest, count(*) as total FROM s3Cluster(primary, {TABLE_PREFIX}_s3) WHERE _row_type = 1 FORMAT JSONEachRow

**Query historical logs:**
SELECT dt, raw 
FROM s3Cluster(primary, {TABLE_PREFIX}_s3)
WHERE _row_type = 1 AND dt >= now() - INTERVAL 24 HOUR
ORDER BY dt DESC
LIMIT 100
FORMAT JSONEachRow`,
    commentary:
      'This preset queries S3 cold storage for historical log access. For real-time logs within the last hour, use the recent variant instead.',
    tags: [
      'betterstack',
      'logs',
      'clickhouse',
      'sql',
      'query',
      'historical',
      's3',
    ],
    setup: BETTERSTACK_CLICKHOUSE_SETUP,
    secret: '@betterstack[clickhouse]',
    instruction: {
      method: 'POST',
      url: field({
        name: 'baseUrl',
        description:
          'the BetterStack ClickHouse HTTP endpoint URL from your Connections page (e.g., https://eu-nbg-2-connect.betterstackdata.com)',
        placeholder: true,
      }),
      query: {
        output_format_pretty_row_numbers: '0',
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'text/plain',
      },
      body: field({
        name: 'sql',
        description:
          'the SQL query to execute - use the UNION ALL pattern above to combine hot and cold storage, adjusting time intervals and filters as needed.',
        placeholder: false,
      }),
      options: {
        transformNestedStrings: { json: true },
      },
    },
  }),
}

export default abilities
