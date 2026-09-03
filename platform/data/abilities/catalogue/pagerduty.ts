import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of PagerDuty abilities.
 */
const abilities = {
  'pagerduty/incident/create': createFetchTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'Create Incident',
    description:
      'Create a new incident in PagerDuty to alert the appropriate team',
    tags: ['pagerduty', 'incident', 'create', 'on-call'],
    secret: '@platform/pagerduty',
    instruction: {
      method: 'POST',
      url: 'https://api.pagerduty.com/incidents',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/vnd.pagerduty+json;version=2',
      },
      body: {
        incident: {
          type: 'incident',
          title: field({
            name: 'title',
            description:
              'a succinct description of the nature, symptoms, or cause of the incident',
          }),
          service: {
            id: field({
              name: 'serviceId',
              description: 'the ID of the service this incident is for',
            }),
            type: 'service_reference',
          },
          urgency: field({
            name: 'urgency',
            description: 'the urgency of the incident (high or low)',
            optional: true,
            enum: ['high', 'low'],
          }),
          incident_key: field({
            name: 'incidentKey',
            description:
              'a string which identifies the incident for deduplication',
            optional: true,
          }),
          body: {
            type: 'incident_body',
            details: field({
              name: 'details',
              description: 'additional incident details',
              optional: true,
            }),
          },
          escalation_policy: {
            id: field({
              name: 'escalationPolicyId',
              description: 'the ID of the escalation policy',
              optional: true,
            }),
            type: 'escalation_policy_reference',
          },
        },
      },
    },
  }),

  'pagerduty/incident/list': createFetchTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'List Incidents',
    description:
      'List incidents in PagerDuty, optionally filtered by status or service',
    tags: ['pagerduty', 'incident', 'list', 'on-call'],
    secret: '@platform/pagerduty',
    instruction: {
      method: 'GET',
      url: 'https://api.pagerduty.com/incidents',
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.pagerduty+json;version=2',
      },
      query: {
        statuses: field({
          name: 'statuses',
          description:
            'filter by incident status (triggered, acknowledged, or resolved)',
          optional: true,
        }),
        service_ids: field({
          name: 'serviceIds',
          description: 'filter by service IDs (comma-separated)',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'number of results to return (max 100)',
          optional: true,
          default: 25,
          placeholder: true,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'pagination offset',
          optional: true,
          default: 0,
          placeholder: true,
        }),
      },
    },
  }),

  'pagerduty/incident/fetch': createFetchTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'Fetch Incident',
    description: 'Retrieve detailed information about a specific incident',
    tags: ['pagerduty', 'incident', 'get', 'on-call'],
    secret: '@platform/pagerduty',
    instruction: {
      method: 'GET',
      url: 'https://api.pagerduty.com',
      path: [
        '/incidents/',
        field({ name: 'incidentId', description: 'the incident ID' }),
      ],
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.pagerduty+json;version=2',
      },
    },
  }),

  'pagerduty/incident/update': createFetchTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'Update Incident',
    description:
      'Update an incident status (acknowledge, resolve) or other properties',
    tags: ['pagerduty', 'incident', 'update', 'on-call'],
    secret: '@platform/pagerduty',
    instruction: {
      method: 'PUT',
      url: 'https://api.pagerduty.com',
      path: [
        '/incidents/',
        field({ name: 'incidentId', description: 'the incident ID' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        Accept: 'application/vnd.pagerduty+json;version=2',
      },
      body: {
        incident: {
          type: 'incident_reference',
          status: field({
            name: 'status',
            description: 'the new status (acknowledged or resolved)',
            enum: ['acknowledged', 'resolved'],
          }),
        },
      },
    },
  }),

  'pagerduty/oncall/list': createFetchTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'List On-Call Users',
    description:
      'List users currently on-call, optionally filtered by schedule or escalation policy',
    tags: ['pagerduty', 'on-call', 'list', 'schedule'],
    secret: '@platform/pagerduty',
    instruction: {
      method: 'GET',
      url: 'https://api.pagerduty.com/oncalls',
      headers: {
        Authorization: secret(),
        Accept: 'application/vnd.pagerduty+json;version=2',
      },
      query: {
        schedule_ids: field({
          name: 'scheduleIds',
          description: 'filter by schedule IDs (comma-separated)',
          optional: true,
        }),
        escalation_policy_ids: field({
          name: 'escalationPolicyIds',
          description: 'filter by escalation policy IDs (comma-separated)',
          optional: true,
        }),
        since: field({
          name: 'since',
          description: 'start of time range (ISO 8601 format)',
          optional: true,
        }),
        until: field({
          name: 'until',
          description: 'end of time range (ISO 8601 format)',
          optional: true,
        }),
      },
    },
  }),

  'pagerduty/api/call': createFetchTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'Call Pagerduty API',
    description:
      'Make a generic API call to Pagerduty. This is a flexible template that can be used to call any Pagerduty API endpoint by specifying the method, URL, and request body.',
    tags: ['pagerduty', 'api', 'call', 'generic'],
    secret: '@platform/pagerduty',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Pagerduty API endpoint to call',
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

  'pack/pagerduty': createPackTemplate({
    provider: 'pagerduty',
    icon: '@logo/pagerduty.com',
    name: 'Install PagerDuty Tools',
    description:
      'Installs PagerDuty tools into the conversation for managing incidents and on-call schedules.',
    tags: ['pagerduty', 'incident-management', 'on-call', 'pack'],
    secret: '@platform/pagerduty',
    instruction: {
      abilities: [
        'pagerduty/incident/create',
        'pagerduty/incident/list',
        'pagerduty/incident/fetch',
        'pagerduty/incident/update',
        'pagerduty/oncall/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
