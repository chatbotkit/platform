import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  field,
  secret,
} from '@/lib/ability.template'

import type { Schema as SqlSchema } from '@/pages/api/auxiliary/skillset/ability/matillion/sql'

/**
 * Matillion Data Productivity Cloud API abilities.
 *
 * @see https://docs.matillion.com/data-productivity-cloud/api/public-api-endpoint-reference/
 */
const abilities = {
  // --- SQL ---

  'matillion/sql/exec': createAuxiliaryTemplate<SqlSchema>({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Execute Matillion SQL Query',
    description:
      'Execute a simple SQL query on Matillion Data Productivity Cloud. Known tables include matillion.projects, matillion.pipelines (requires projectId in WHERE), and matillion.pipeline_executions.',
    tags: ['matillion', 'sql', 'data-pipeline', 'beta'],
    path: '/api/auxiliary/skillset/ability/matillion/sql',
    secret: '@matillion',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - describe, select, insert, update, delete are supported',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Projects ---

  'matillion/project/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Projects',
    description: 'Retrieve a list of all projects in the Matillion account',
    tags: ['matillion', 'project', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/projects',
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/project/create': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Create Matillion Project',
    description: 'Create a new project in Matillion',
    tags: ['matillion', 'project', 'create', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'POST',
      url: 'https://eu1.api.matillion.com/dpc/v1/projects',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the name of the new project',
        }),
        description: field({
          name: 'description',
          description: 'the description of the new project',
          optional: true,
        }),
        warehouse: field({
          name: 'warehouse',
          enum: ['SNOWFLAKE', 'REDSHIFT'],
          description: 'the target data warehouse for the project',
        }),
        agentDeploymentType: field({
          name: 'agentDeploymentType',
          enum: ['HYBRID'],
          description: 'the deployment type of the agent',
          default: 'HYBRID',
        }),
      },
    },
  }),

  'matillion/project/delete': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Delete Matillion Project',
    description: 'Delete a project from Matillion',
    tags: ['matillion', 'project', 'delete', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'DELETE',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Environments ---

  'matillion/environment/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Environments',
    description: 'Retrieve a list of all environments in a project',
    tags: ['matillion', 'environment', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/environments',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/environment/delete': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Delete Matillion Environment',
    description: 'Delete an environment from a project',
    tags: ['matillion', 'environment', 'delete', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'DELETE',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/environments/',
        field({ name: 'environmentName', description: 'the environment name' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Pipelines ---

  'matillion/pipeline/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Pipelines',
    description: 'Retrieve a list of all published pipelines in a project',
    tags: ['matillion', 'pipeline', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/published-pipelines',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        environmentName: field({
          name: 'environmentName',
          description: 'the environment name to filter pipelines',
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/pipeline/execute': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Execute Matillion Pipeline',
    description: 'Execute a published pipeline in Matillion',
    tags: ['matillion', 'pipeline', 'execute', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'POST',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/pipeline-executions',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        pipelineName: field({
          name: 'pipelineName',
          description: 'the name of the pipeline to execute',
        }),
        environmentName: field({
          name: 'environmentName',
          description: 'the environment to execute the pipeline in',
        }),
        versionName: field({
          name: 'versionName',
          description:
            'optional artifact version name (if not specified, latest version is executed)',
          optional: true,
        }),
        agentId: field({
          name: 'agentId',
          description:
            'optional agent ID to execute the pipeline (if not specified, default agent is used)',
          optional: true,
        }),
        executionTag: field({
          name: 'executionTag',
          description:
            'optional execution tag for concurrency control (only 1 pipeline per tag per environment)',
          optional: true,
        }),
      },
    },
  }),

  'matillion/pipeline-execution/fetch': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Get Matillion Pipeline Execution Status',
    description: 'Retrieve the status of a pipeline execution',
    tags: ['matillion', 'pipeline', 'status', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/pipeline-executions/',
        field({
          name: 'pipelineExecutionId',
          description: 'the pipeline execution ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'matillion/pipeline-execution/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Pipeline Executions',
    description: 'Retrieve a list of pipeline executions',
    tags: ['matillion', 'pipeline', 'execution', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/pipeline-executions',
      headers: {
        Authorization: secret(),
      },
      query: {
        projectId: field({
          name: 'projectId',
          description: 'filter by project ID',
          optional: true,
        }),
        pipelineName: field({
          name: 'pipelineName',
          description:
            'filter by pipeline name (case-insensitive partial match)',
          optional: true,
        }),
        environmentName: field({
          name: 'environmentName',
          description: 'filter by environment name',
          optional: true,
        }),
        status: field({
          name: 'status',
          enum: [
            'RUNNING',
            'SUCCESS',
            'FAILED',
            'CANCELLING',
            'CANCELLED',
            'UNKNOWN',
          ],
          description: 'filter by execution status',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results to return (max 100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/pipeline-execution/cancel': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Cancel Matillion Pipeline Execution',
    description: 'Cancel a running pipeline execution',
    tags: ['matillion', 'pipeline', 'cancel', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'PATCH',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/pipeline-executions/',
        field({
          name: 'pipelineExecutionId',
          description: 'the pipeline execution ID',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        status: 'CANCELLED',
        forceUpdate: field({
          name: 'forceUpdate',
          type: 'boolean',
          description: 'if true, the execution will be forcefully terminated',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  // --- Schedules ---

  'matillion/schedule/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Schedules',
    description: 'Retrieve a list of all schedules for a project',
    tags: ['matillion', 'schedule', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/schedules',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/schedule/fetch': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Get Matillion Schedule',
    description: 'Retrieve details of a specific schedule',
    tags: ['matillion', 'schedule', 'fetch', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/schedules/',
        field({ name: 'scheduleId', description: 'the schedule UUID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'matillion/schedule/create': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Create Matillion Schedule',
    description: 'Create a new schedule for a pipeline',
    tags: ['matillion', 'schedule', 'create', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'POST',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/schedules',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        pipeline: {
          pipelineName: field({
            name: 'pipelineName',
            description: 'the name of the pipeline to schedule',
          }),
          environmentName: field({
            name: 'environmentName',
            description: 'the environment to execute the pipeline in',
          }),
          versionName: field({
            name: 'versionName',
            description: 'optional artifact version name',
            optional: true,
          }),
          agentId: field({
            name: 'agentId',
            description: 'optional agent ID to execute the pipeline',
            optional: true,
          }),
        },
        schedule: {
          name: field({
            name: 'scheduleName',
            description: 'the name for the schedule',
          }),
          cronExpression: field({
            name: 'cronExpression',
            description: 'the cron expression in Quartz format',
          }),
          cronTimezone: field({
            name: 'cronTimezone',
            description:
              'the timezone for the schedule (e.g., "Europe/Dublin")',
            optional: true,
            default: 'UTC',
          }),
          scheduleEnabled: field({
            name: 'scheduleEnabled',
            type: 'boolean',
            description: 'whether the schedule is enabled',
            optional: true,
            default: true,
          }),
        },
      },
    },
  }),

  'matillion/schedule/update': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Update Matillion Schedule',
    description: 'Update an existing schedule',
    tags: ['matillion', 'schedule', 'update', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'PATCH',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/schedules/',
        field({ name: 'scheduleId', description: 'the schedule UUID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new name for the schedule',
          optional: true,
        }),
        cronExpression: field({
          name: 'cronExpression',
          description: 'the new cron expression in Quartz format',
          optional: true,
        }),
        cronTimezone: field({
          name: 'cronTimezone',
          description: 'the new timezone for the schedule',
          optional: true,
        }),
        scheduleEnabled: field({
          name: 'scheduleEnabled',
          type: 'boolean',
          description: 'whether the schedule is enabled',
          optional: true,
        }),
      },
    },
  }),

  'matillion/schedule/delete': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Delete Matillion Schedule',
    description: 'Delete a schedule from a project',
    tags: ['matillion', 'schedule', 'delete', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'DELETE',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project UUID' }),
        '/schedules/',
        field({ name: 'scheduleId', description: 'the schedule UUID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Agents ---

  'matillion/agent/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Agents',
    description: 'Retrieve a list of all agents in the account',
    tags: ['matillion', 'agent', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/agents',
      headers: {
        Authorization: secret(),
      },
      query: {
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/agent/fetch': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Get Matillion Agent',
    description: 'Retrieve details of a specific agent',
    tags: ['matillion', 'agent', 'fetch', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/agents/',
        field({ name: 'agentId', description: 'the agent ID' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'matillion/agent/create': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Create Matillion Agent',
    description: 'Create a new agent with specified configuration',
    tags: ['matillion', 'agent', 'create', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'POST',
      url: 'https://eu1.api.matillion.com/dpc/v1/agents',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the name of the agent (max 30 characters)',
        }),
        description: field({
          name: 'description',
          description: 'the description for the agent (max 500 characters)',
          optional: true,
        }),
        agentType: field({
          name: 'agentType',
          enum: ['data_productivity_cloud', 'streaming'],
          description: 'the type of agent being created',
        }),
        cloudProvider: field({
          name: 'cloudProvider',
          enum: ['aws', 'azure', 'snowflake', 'gcp'],
          description: 'the cloud provider (must correspond with agent type)',
        }),
        deployment: field({
          name: 'deployment',
          enum: [
            'fargate',
            'eks',
            'container app',
            'aks',
            'aci',
            'native app',
            'gke',
            'gce',
          ],
          description:
            'the deployment type (must correspond with agent type and cloud provider)',
        }),
        trackName: field({
          name: 'trackName',
          enum: ['current', 'stable'],
          description: 'the version track for the agent',
          optional: true,
        }),
        enableAutoUpdates: field({
          name: 'enableAutoUpdates',
          type: 'boolean',
          description:
            'whether the agent should automatically update (not available for Snowflake or Streaming agents)',
          optional: true,
        }),
        restrictedAccess: field({
          name: 'restrictedAccess',
          type: 'boolean',
          description:
            'whether the agent is restricted to specific projects (not available for Streaming agents)',
          optional: true,
        }),
      },
    },
  }),

  'matillion/agent/update': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Update Matillion Agent',
    description: 'Update an existing agent',
    tags: ['matillion', 'agent', 'update', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'PATCH',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/agents/',
        field({ name: 'agentId', description: 'the agent ID to update' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new name for the agent',
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'the new description for the agent',
          optional: true,
        }),
        trackName: field({
          name: 'trackName',
          enum: ['current', 'stable'],
          description: 'the new version track for the agent',
          optional: true,
        }),
        enableAutoUpdates: field({
          name: 'enableAutoUpdates',
          type: 'boolean',
          description: 'whether to enable automatic updates',
          optional: true,
        }),
        restrictedAccess: field({
          name: 'restrictedAccess',
          type: 'boolean',
          description: 'whether to restrict access to specific projects',
          optional: true,
        }),
      },
    },
  }),

  'matillion/agent/delete': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Delete Matillion Agent',
    description:
      'Delete an agent (only works for agents with STOPPED, PENDING, or UNKNOWN status)',
    tags: ['matillion', 'agent', 'delete', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'DELETE',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/agents/',
        field({ name: 'agentId', description: 'the agent ID to delete' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'matillion/agent/command/send': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Send Matillion Agent Command',
    description: 'Send a command to an agent (RESTART, PAUSE, or RESUME)',
    tags: ['matillion', 'agent', 'command', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'POST',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/agents/',
        field({ name: 'agentId', description: 'the agent ID' }),
        '/commands',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        command: field({
          name: 'command',
          enum: ['RESTART', 'PAUSE', 'RESUME'],
          description: 'the command to send to the agent',
        }),
      },
    },
  }),

  // --- Audit Events ---

  'matillion/audit-event/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Audit Events',
    description: 'Retrieve audit events within a specified time range',
    tags: ['matillion', 'audit', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/events',
      headers: {
        Authorization: secret(),
      },
      query: {
        from: field({
          name: 'from',
          description:
            'the earliest date and time to retrieve (ISO 8601 format, e.g., 2024-01-01T00:00:00Z)',
        }),
        to: field({
          name: 'to',
          description:
            'the latest date and time to retrieve (ISO 8601 format, e.g., 2024-01-31T23:59:59Z)',
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  // --- Consumption ---

  'matillion/consumption/fetch': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Get Matillion Consumption',
    description:
      'Retrieve credit consumption breakdown for flat-rated products',
    tags: ['matillion', 'consumption', 'fetch', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/consumption',
      headers: {
        Authorization: secret(),
      },
      query: {
        consumedFrom: field({
          name: 'consumedFrom',
          description:
            'first calendar date to include in results (inclusive, YYYY-MM-DD format)',
        }),
        consumedBefore: field({
          name: 'consumedBefore',
          description:
            'calendar date before which results should be included (exclusive, YYYY-MM-DD format)',
        }),
      },
    },
  }),

  // --- Artifacts ---

  'matillion/artifact/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Artifacts',
    description: 'Retrieve a list of artifacts for a project environment',
    tags: ['matillion', 'artifact', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/artifacts',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        environmentName: field({
          name: 'environmentName',
          description: 'the environment name',
        }),
        enabledOnly: field({
          name: 'enabledOnly',
          type: 'boolean',
          description: 'filter to only enabled artifacts',
          optional: true,
          default: true,
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
          optional: true,
          default: 0,
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 25,
        }),
      },
    },
  }),

  'matillion/artifact/fetch': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Get Matillion Artifact',
    description: 'Retrieve details of a specific artifact by version name',
    tags: ['matillion', 'artifact', 'fetch', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/artifacts/details',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        environmentName: field({
          name: 'environmentName',
          description: 'the environment name',
        }),
        versionName: field({
          name: 'versionName',
          description: 'the version name of the artifact',
          optional: true,
        }),
      },
    },
  }),

  'matillion/artifact/promote': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Promote Matillion Artifact',
    description: 'Promote an artifact from one environment to another',
    tags: ['matillion', 'artifact', 'promote', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'POST',
      url: 'https://eu1.api.matillion.com/dpc/v1',
      path: [
        '/projects/',
        field({ name: 'projectId', description: 'the project ID' }),
        '/artifacts/promotions',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        versionName: field({
          name: 'versionName',
          description: 'the version of the artifact to promote',
        }),
        sourceEnvironmentName: field({
          name: 'sourceEnvironmentName',
          description: 'the name of the environment to promote from',
        }),
        targetEnvironmentName: field({
          name: 'targetEnvironmentName',
          description: 'the name of the environment to promote to',
        }),
      },
    },
  }),

  // --- Custom Connectors ---

  'matillion/custom-connector/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Custom Connectors',
    description: 'Retrieve a list of custom connector profiles',
    tags: ['matillion', 'connector', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/custom-connectors',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // --- Data Lineage ---

  'matillion/lineage/list': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'List Matillion Lineage Events',
    description: 'Retrieve OpenLineage events for data governance',
    tags: ['matillion', 'lineage', 'list', 'data-pipeline'],
    secret: '@matillion',
    instruction: {
      method: 'GET',
      url: 'https://eu1.api.matillion.com/dpc/v1/lineage/events',
      headers: {
        Authorization: secret(),
      },
      query: {
        generatedFrom: field({
          name: 'generatedFrom',
          description:
            'include events from this datetime (inclusive, ISO 8601 format)',
        }),
        generatedBefore: field({
          name: 'generatedBefore',
          description:
            'include events before this datetime (exclusive, ISO 8601 format)',
        }),
        page: field({
          name: 'page',
          type: 'number',
          description: 'page number (0-indexed)',
        }),
        size: field({
          name: 'size',
          type: 'number',
          description: 'number of records per page (1-100)',
          optional: true,
          default: 100,
        }),
      },
    },
  }),

  'matillion/api/call': createFetchTemplate({
    provider: 'matillion',
    icon: '@logo/matillion.com',
    name: 'Call Matillion API',
    description:
      'Make a generic API call to Matillion. This is a flexible template that can be used to call any Matillion API endpoint by specifying the method, URL, and request body.',
    tags: ['matillion', 'api', 'call', 'generic'],
    secret: '@matillion',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Matillion API endpoint to call',
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
