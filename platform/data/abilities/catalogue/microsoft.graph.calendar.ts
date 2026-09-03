import { createFetchTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of Microsoft Graph Calendar/Event abilities.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/calendar
 */
const abilities = {
  'microsoft/graph/event/search': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Search Calendar Events',
    description:
      "Find calendar events that match a search query in a user's primary calendar",
    tags: ['microsoft', 'outlook', 'calendar', 'events'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/events',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $search: field({
          name: 'search',
          description: 'string to search in events',
        }),
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., subject, start, end, location',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of events to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of events to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  subject: subject,
  start: start.dateTime,
  end: end.dateTime,
  location: location.displayName
}`,
      },
    },
  }),

  'microsoft/graph/event/list': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'List Calendar Events',
    description: "Retrieve upcoming events from a user's primary calendar",
    tags: ['microsoft', 'outlook', 'calendar', 'events'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/events',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        $select: field({
          name: 'select',
          description: 'fields to select, e.g., subject, start, end, location',
          optional: true,
        }),
        $top: field({
          name: 'top',
          type: 'number',
          description: 'number of events to return',
          placeholder: true,
          default: 10,
          optional: true,
        }),
        $skip: field({
          name: 'skip',
          type: 'number',
          description: 'number of events to skip for pagination',
          optional: true,
        }),
      },
      options: {
        jmespath: `value[*].{
  id: id,
  subject: subject,
  start: start.dateTime,
  end: end.dateTime,
  location: location.displayName
}`,
      },
    },
  }),

  'microsoft/graph/event/create': createFetchTemplate({
    provider: 'microsoft',
    icon: '@logo/microsoft.com',
    name: 'Create Calendar Event',
    description: "Schedule a new event in a user's primary calendar",
    tags: ['microsoft', 'outlook', 'calendar', 'events'],
    secret: '@platform/microsoft/365',
    instruction: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/me/events',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        subject: field({
          name: 'subject',
          description: 'event subject',
        }),
        start: {
          dateTime: field({
            name: 'startDateTime',
            description: 'start date and time in ISO 8601 format',
          }),
          timeZone: 'UTC',
        },
        end: {
          dateTime: field({
            name: 'endDateTime',
            description: 'end date and time in ISO 8601 format',
          }),
          timeZone: 'UTC',
        },
        location: {
          displayName: field({
            name: 'location',
            description: 'event location',
          }),
        },
        attendees: field({
          name: 'attendees',
          description: 'list of attendee email addresses',
          optional: true,
        }),
      },
      options: {
        jmespath: `{
  id: id,
  subject: subject,
  start: start.dateTime,
  end: end.dateTime,
  location: location.displayName
}`,
      },
    },
  }),
}

export default abilities
