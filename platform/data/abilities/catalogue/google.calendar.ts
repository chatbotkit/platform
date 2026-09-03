import {
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  AVAILABILITY_BOOK_HANDLER_NAME,
  AVAILABILITY_LIST_HANDLER_NAME,
  AvailabilityBookSchema,
  AvailabilityListSchema,
  CALENDAR_LIST_HANDLER_NAME,
  CalendarListSchema,
  EVENT_CREATE_HANDLER_NAME,
  EVENT_LIST_HANDLER_NAME,
  EVENT_UPDATE_HANDLER_NAME,
  EventCreateSchema,
  EventListSchema,
  EventUpdateSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/calendar'

// --- Path Constants ---

const CALENDAR_API_PATH = '/api/auxiliary/skillset/ability/google/calendar'

/**
 * Catalogue of Google Calendar abilities.
 */
const abilities = {
  // --- Calendar Abilities ---

  'google/calendar/list': createAuxiliaryTemplate<CalendarListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Calendars',
    description:
      'List all available Google Calendars for the authenticated user.',
    tags: ['google', 'calendar', 'list'],
    path: CALENDAR_API_PATH,
    handler: 'list' satisfies typeof CALENDAR_LIST_HANDLER_NAME,
    secret: '@platform/google/calendar',
    instruction: {},
    options: {
      auth: 'internal',
    },
  }),

  // --- Event Abilities ---

  'google/calendar/event/list': createAuxiliaryTemplate<EventListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Google Calendar Events',
    description: 'List upcoming events from a specific Google Calendar.',
    tags: ['google', 'calendar', 'events', 'list'],
    path: CALENDAR_API_PATH,
    handler: 'event/list' satisfies typeof EVENT_LIST_HANDLER_NAME,
    secret: '@platform/google/calendar',
    instruction: {
      calendarId: field({
        name: 'calendarId',
        description: 'The calendar ID',
        placeholder: true,
      }),
      count: field({
        name: 'count',
        description: 'The number of events to return',
        type: 'number',
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/calendar/event/create': createAuxiliaryTemplate<EventCreateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Google Calendar Event',
    description: 'Create a new event in a Google Calendar.',
    tags: ['google', 'calendar', 'events', 'create'],
    path: CALENDAR_API_PATH,
    handler: 'event/create' satisfies typeof EVENT_CREATE_HANDLER_NAME,
    secret: '@platform/google/calendar',
    instruction: {
      calendarId: field({
        name: 'calendarId',
        description: 'The calendar ID',
        placeholder: true,
      }),
      summary: field({
        name: 'summary',
        description: 'The event title',
        placeholder: true,
      }),
      description: field({
        name: 'description',
        description: 'The event description',
        optional: true,
      }),
      start: field({
        name: 'start',
        description: 'The event start date and time',
        placeholder: true,
      }),
      end: field({
        name: 'end',
        description:
          'The event end date and time or duration in minutes if it is a number',
        placeholder: true,
      }),
      emails: field({
        name: 'emails',
        description: 'Comma-separated list of attendee emails',
        optional: true,
      }),
      createMeetLink: field({
        name: 'createMeetLink',
        description: 'Whether to create a Google Meet link for the event',
        type: 'boolean',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/calendar/event/update': createAuxiliaryTemplate<EventUpdateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Update Google Calendar Event',
    description: 'Update an existing event in a Google Calendar.',
    tags: ['google', 'calendar', 'events', 'update'],
    path: CALENDAR_API_PATH,
    handler: 'event/update' satisfies typeof EVENT_UPDATE_HANDLER_NAME,
    secret: '@platform/google/calendar',
    instruction: {
      calendarId: field({
        name: 'calendarId',
        description: 'The calendar ID',
        placeholder: true,
      }),
      eventId: field({
        name: 'eventId',
        description: 'The event ID',
        placeholder: true,
      }),
      summary: field({
        name: 'summary',
        description: 'The event title',
        placeholder: true,
        optional: true,
      }),
      description: field({
        name: 'description',
        description: 'The event description',
        optional: true,
      }),
      start: field({
        name: 'start',
        description: 'The event start date and time',
        placeholder: true,
        optional: true,
      }),
      end: field({
        name: 'end',
        description:
          'The event end date and time or duration in minutes if it is a number',
        placeholder: true,
        optional: true,
      }),
      emails: field({
        name: 'emails',
        description: 'Comma-separated list of attendee emails',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Availability Abilities ---

  'google/calendar/availability/list':
    createAuxiliaryTemplate<AvailabilityListSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'List Google Calendar Availability',
      description:
        'List available time slots for a Google Calendar based on existing events.',
      tags: ['google', 'calendar', 'availability', 'list'],
      path: CALENDAR_API_PATH,
      handler:
        'availability/list' satisfies typeof AVAILABILITY_LIST_HANDLER_NAME,
      secret: '@platform/google/calendar',
      instruction: {
        calendarId: field({
          name: 'calendarId',
          description: 'The calendar ID',
          placeholder: true,
        }),
        count: field({
          name: 'count',
          description: 'The number of available slots to return',
          type: 'number',
          placeholder: true,
          optional: true,
        }),
        duration: field({
          name: 'duration',
          description: 'The duration of each slot in minutes',
          type: 'number',
          placeholder: true,
          default: 30,
        }),
        workingStart: field({
          name: 'workingStart',
          description: 'The start of the working day',
          placeholder: true,
          default: '09:00',
        }),
        workingEnd: field({
          name: 'workingEnd',
          description: 'The end of the working day',
          placeholder: true,
          default: '17:00',
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/calendar/availability/book':
    createAuxiliaryTemplate<AvailabilityBookSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Book Google Calendar Availability',
      description: 'Book an available time slot by creating a calendar event.',
      tags: ['google', 'calendar', 'availability', 'book'],
      path: CALENDAR_API_PATH,
      handler:
        'availability/book' satisfies typeof AVAILABILITY_BOOK_HANDLER_NAME,
      secret: '@platform/google/calendar',
      instruction: {
        calendarId: field({
          name: 'calendarId',
          description: 'The calendar ID',
          placeholder: true,
        }),
        bookingId: field({
          name: 'bookingId',
          description: 'The booking ID from the availability list',
          placeholder: true,
        }),
        summary: field({
          name: 'summary',
          description: 'The event title',
          placeholder: true,
        }),
        description: field({
          name: 'description',
          description: 'The event description',
          optional: true,
        }),
        attendees: field({
          name: 'attendees',
          description: 'Comma-separated list of attendee emails',
          placeholder: true,
        }),
        createMeetLink: field({
          name: 'createMeetLink',
          description: 'Whether to create a Google Meet link for the booking',
          type: 'boolean',
          optional: true,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  // --- Pack Abilities ---

  'pack/google/calendar': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Calendar Tools',
    description:
      'Installs Google Calendar tools into the conversation to list calendars, list, create, and update events, and check availability.',
    tags: ['beta'],
    secret: '@platform/google/calendar',
    instruction: {
      abilities: [
        'google/calendar/list',
        'google/calendar/event/list',
        'google/calendar/event/create',
        'google/calendar/event/update',
        'google/calendar/availability/list',
        'google/calendar/availability/book',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/google/calendar[booking]': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Calendar Event Booking Tools',
    description:
      'Installs Google Calendar booking tools into the conversation for booking time slots.',
    tags: ['beta'],
    secret: '@platform/google/calendar',
    instruction: {
      abilities: [
        'google/calendar/availability/list',
        'google/calendar/availability/book',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/google/calendar[read-only]': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Calendar Read-Only Tools',
    description:
      'Installs read-only Google Calendar tools into the conversation to list calendars and events and check availability without modification.',
    tags: ['beta'],
    secret: '@platform/google/calendar',
    instruction: {
      abilities: [
        'google/calendar/list',
        'google/calendar/event/list',
        'google/calendar/availability/list',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
