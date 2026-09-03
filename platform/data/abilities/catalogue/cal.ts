import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'cal/event/create': createFetchTemplate({
    provider: 'cal',
    icon: '@logo/cal.com',
    name: 'Create Cal.com Event',
    description: 'Create a new event in Cal.com',
    tags: ['cal.com', 'event', 'create'],
    secret: '@cal',
    instruction: {
      method: 'POST',
      url: 'https://api.cal.com/v1/events',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        title: field({
          name: 'title',
          description: 'Event title',
        }),
        description: field({
          name: 'description',
          description: 'Event description',
        }),
        start: field({
          name: 'start',
          description: 'Start time',
        }),
        end: field({
          name: 'end',
          description: 'End time',
        }),
        timezone: field({
          name: 'timezone',
          description: 'Time zone',
        }),
      },
    },
  }),

  'cal/event/details': createFetchTemplate({
    provider: 'cal',
    icon: '@logo/cal.com',
    name: 'Retrieve Cal.com Event Details',
    description: 'Retrieve details of a specific event in Cal.com',
    tags: ['cal.com', 'event', 'details'],
    secret: '@cal',
    instruction: {
      method: 'GET',
      url: 'https://api.cal.com/v1/events/',
      path: [
        field({
          name: 'event_id',
          description: 'Event ID',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cal/events/retrieve/all': createFetchTemplate({
    provider: 'cal',
    icon: '@logo/cal.com',
    name: 'Retrieve All Cal.com Events',
    description: 'Retrieve all events from Cal.com',
    tags: ['cal.com', 'events', 'retrieve'],
    secret: '@cal',
    instruction: {
      method: 'GET',
      url: 'https://api.cal.com/v1/events',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cal/events/retrieve/daterange': createFetchTemplate({
    provider: 'cal',
    icon: '@logo/cal.com',
    name: 'Retrieve Cal.com Events for Date Range',
    description: 'Retrieve events from Cal.com for a specific date range',
    tags: ['cal.com', 'events', 'retrieve'],
    secret: '@cal',
    instruction: {
      method: 'GET',
      url: 'https://api.cal.com/v1/events',
      query: {
        start: field({
          name: 'start_date',
          description: 'Start date',
        }),
        end: field({
          name: 'end_date',
          description: 'End date',
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cal/api/call': createFetchTemplate({
    provider: 'cal',
    icon: '@logo/cal.com',
    name: 'Call Cal API',
    description:
      'Make a generic API call to Cal. This is a flexible template that can be used to call any Cal API endpoint by specifying the method, URL, and request body.',
    tags: ['cal', 'api', 'call', 'generic'],
    secret: '@cal',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Cal API endpoint to call',
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
