import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'calendly/event/fetch': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'Fetch Calendly Event',
    description: 'Fetch details of a specific scheduled event in Calendly',
    tags: ['calendly', 'event', 'fetch'],
    secret: '@platform/calendly',
    instruction: {
      method: 'GET',
      url: 'https://api.calendly.com/scheduled_events',
      path: ['/', field({ name: 'event_id', description: 'Event ID' })],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'calendly/event/list': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'List Calendly Events',
    description: 'List all scheduled events from Calendly',
    tags: ['calendly', 'event', 'list'],
    secret: '@platform/calendly',
    instruction: {
      method: 'GET',
      url: 'https://api.calendly.com/scheduled_events',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'calendly/event/list[daterange]': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'List Calendly Events by Date Range',
    description:
      'List scheduled events from Calendly within a specific date range',
    tags: ['calendly', 'event', 'list'],
    secret: '@platform/calendly',
    instruction: {
      method: 'GET',
      url: 'https://api.calendly.com/scheduled_events',
      headers: {
        Authorization: secret(),
      },
      query: {
        start_time: field({
          name: 'start_time',
          description: 'Start time',
        }),
        end_time: field({
          name: 'end_time',
          description: 'End time',
        }),
      },
    },
  }),

  'calendly/invitee/list': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'List Event Invitees',
    description: 'List all invitees for a specific scheduled event in Calendly',
    tags: ['calendly', 'invitee', 'list'],
    secret: '@platform/calendly',
    instruction: {
      method: 'GET',
      url: 'https://api.calendly.com',
      path: [
        '/scheduled_events/',
        field({
          name: 'event_uuid',
          description: 'The UUID of the scheduled event',
        }),
        '/invitees',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        email: field({
          name: 'email',
          description: 'Filter by invitee email address',
          optional: true,
        }),
        status: field({
          name: 'status',
          description: 'Filter by invitee status (active or canceled)',
          optional: true,
          enum: ['active', 'canceled'],
        }),
      },
    },
  }),

  'calendly/link/create': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'Create Single-Use Scheduling Link',
    description:
      'Create a single-use scheduling link for a specific event type in Calendly',
    tags: ['calendly', 'link', 'create', 'scheduling'],
    secret: '@platform/calendly',
    instruction: {
      method: 'POST',
      url: 'https://api.calendly.com/scheduling_links',
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        max_event_count: field({
          name: 'max_event_count',
          type: 'number',
          description:
            'Maximum number of events that can be scheduled using this link',
          default: 1,
        }),
        owner: field({
          name: 'owner',
          description:
            'The URI of the event type (e.g., https://api.calendly.com/event_types/UUID)',
        }),
        owner_type: 'EventType',
      },
    },
  }),

  'calendly/invitee/mark-no-show': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'Mark Invitee as No Show',
    description:
      'Mark an invitee as a no-show for a scheduled event in Calendly',
    tags: ['calendly', 'invitee', 'no-show'],
    secret: '@platform/calendly',
    instruction: {
      method: 'POST',
      url: 'https://api.calendly.com/invitee_no_shows',
      headers: {
        'Content-Type': 'application/json',
        Authorization: secret(),
      },
      body: {
        invitee: field({
          name: 'invitee_uri',
          description:
            'The URI of the invitee to mark as no-show (e.g., https://api.calendly.com/scheduled_events/UUID/invitees/UUID)',
        }),
      },
    },
  }),

  'calendly/api/call': createFetchTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'Call Calendly API',
    description:
      'Make a generic API call to Calendly. This is a flexible template that can be used to call any Calendly API endpoint by specifying the method, URL, and request body.',
    tags: ['calendly', 'api', 'call', 'generic'],
    secret: '@platform/calendly',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Calendly API endpoint to call',
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

  'pack/calendly': createPackTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'Install Calendly Tools',
    description:
      'Installs Calendly tools into the conversation. You can manage events, invitees, and scheduling links.',
    tags: ['calendly', 'pack', 'beta'],
    secret: '@platform/calendly',
    instruction: {
      abilities: [
        'calendly/event/fetch',
        'calendly/event/list',
        'calendly/event/list[daterange]',
        'calendly/invitee/list',
        'calendly/link/create',
        'calendly/invitee/mark-no-show',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/calendly[read-only]': createPackTemplate({
    provider: 'calendly',
    icon: '@logo/calendly.com',
    name: 'Install Calendly Search Tools',
    description:
      'Installs read-only Calendly tools into the conversation. You can list events and invitees without modification.',
    tags: ['calendly', 'pack', 'beta'],
    secret: '@platform/calendly',
    instruction: {
      abilities: [
        'calendly/event/fetch',
        'calendly/event/list',
        'calendly/event/list[daterange]',
        'calendly/invitee/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
