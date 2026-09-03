import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import { decode as decodeB64, encode as encodeB64 } from '@/lib/b64'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'
import { z } from '@/lib/zod.schema'

// --- Handler Names ---

export const CALENDAR_LIST_HANDLER_NAME = 'list' as const
export const EVENT_LIST_HANDLER_NAME = 'event/list' as const
export const EVENT_CREATE_HANDLER_NAME = 'event/create' as const
export const EVENT_UPDATE_HANDLER_NAME = 'event/update' as const
export const AVAILABILITY_LIST_HANDLER_NAME = 'availability/list' as const
export const AVAILABILITY_BOOK_HANDLER_NAME = 'availability/book' as const

// --- Schemas ---

export const calendarListSchema = z.object({})

export type CalendarListSchema = z.infer<typeof calendarListSchema>

export const eventListSchema = z.object({
  calendarId: z.string(),
  count: z.number().optional(),
})

export type EventListSchema = z.infer<typeof eventListSchema>

export const eventCreateSchema = z.object({
  calendarId: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.string(),
  end: z.string(),
  emails: z.string().optional(),
  createMeetLink: z.boolean().optional(),
})

export type EventCreateSchema = z.infer<typeof eventCreateSchema>

export const eventUpdateSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  emails: z.string().optional(),
})

export type EventUpdateSchema = z.infer<typeof eventUpdateSchema>

export const availabilityListSchema = z.object({
  calendarId: z.string(),
  count: z.coerce.number().optional(),
  duration: z.coerce.number().default(30),
  workingStart: z.string().default('09:00'),
  workingEnd: z.string().default('17:00'),
})

export type AvailabilityListSchema = z.infer<typeof availabilityListSchema>

export const availabilityBookSchema = z.object({
  calendarId: z.string(),
  bookingId: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  attendees: z.string(),
  createMeetLink: z.boolean().optional(),
})

export type AvailabilityBookSchema = z.infer<typeof availabilityBookSchema>

// --- Helper Functions ---

/**
 * Get access token from headers or throw authentication error
 *
 * @throws {Error} if not authenticated
 */
function getAccessToken(headers: Headers): string {
  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  return token
}

type CalendarEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  hangoutLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
  conferenceData?: {
    conferenceId?: string
    conferenceSolution?: {
      key?: { type?: string }
      name?: string
    }
    entryPoints?: {
      entryPointType?: string
      uri?: string
      label?: string
    }[]
  }
}

type MeetingLink = {
  type: 'google_meet' | 'zoom' | 'other'
  url: string
  source: 'conferenceData' | 'hangoutLink' | 'description' | 'location'
  label?: string
}

const MEETING_URL_PATTERN =
  /https?:\/\/[^\s<>"']*(?:meet\.google\.com|zoom\.us|zoomgov\.com|teams\.microsoft\.com|webex\.com)[^\s<>"']*/gi

function cleanUrl(url: string) {
  return url.replace(/[),.;\]]+$/, '')
}

function getMeetingLinkType(url: string): MeetingLink['type'] {
  if (url.includes('meet.google.com')) {
    return 'google_meet'
  }

  if (url.includes('zoom.us') || url.includes('zoomgov.com')) {
    return 'zoom'
  }

  return 'other'
}

function addMeetingLink(
  meetingLinks: MeetingLink[],
  link: Omit<MeetingLink, 'type'>
) {
  const url = cleanUrl(link.url)

  if (
    !url ||
    (!url.startsWith('http://') && !url.startsWith('https://')) ||
    meetingLinks.some((meetingLink) => meetingLink.url === url)
  ) {
    return
  }

  meetingLinks.push({
    ...link,
    url,
    type: getMeetingLinkType(url),
  })
}

function extractMeetingLinksFromText(
  meetingLinks: MeetingLink[],
  text: string | undefined,
  source: MeetingLink['source']
) {
  if (!text) {
    return
  }

  for (const match of text.matchAll(MEETING_URL_PATTERN)) {
    addMeetingLink(meetingLinks, {
      url: match[0],
      source,
    })
  }
}

function summarizeCalendarEvent(event: CalendarEvent) {
  const meetingLinks: MeetingLink[] = []

  for (const entryPoint of event.conferenceData?.entryPoints || []) {
    if (!entryPoint.uri) {
      continue
    }

    addMeetingLink(meetingLinks, {
      url: entryPoint.uri,
      source: 'conferenceData',
      label: entryPoint.label,
    })
  }

  if (event.hangoutLink) {
    addMeetingLink(meetingLinks, {
      url: event.hangoutLink,
      source: 'hangoutLink',
    })
  }

  extractMeetingLinksFromText(meetingLinks, event.description, 'description')
  extractMeetingLinksFromText(meetingLinks, event.location, 'location')

  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    htmlLink: event.htmlLink,
    start: event.start,
    end: event.end,
    attendees: event.attendees?.map(({ email, displayName, responseStatus }) => {
      return { email, displayName, responseStatus }
    }),
    hangoutLink: event.hangoutLink,
    conferenceData: event.conferenceData
      ? {
          conferenceId: event.conferenceData.conferenceId,
          conferenceSolution: event.conferenceData.conferenceSolution,
          entryPoints: event.conferenceData.entryPoints,
        }
      : undefined,
    meetingUrl: meetingLinks[0]?.url,
    meetingLinks,
  }
}

// --- Calendar List Handler ---

async function calendarListHandler(
  _session: Session,
  parameters: CalendarListSchema,
  headers: Headers
) {
  debug(`google/calendar/list`, { parameters, headers }).log(
    'auxiliary.google.calendar.calendarListHandler'
  )

  const token = getAccessToken(headers)

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/users/me/calendarList`
  )

  url.searchParams.set('minAccessRole', 'owner')

  const response = await call(url.href, {
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const { items } = await response.json()

  return items.map(
    ({
      id,
      summary,
      description,
    }: {
      id: string
      summary: string
      description: string
    }) => {
      return {
        id,
        summary,
        description,
      }
    }
  )
}

// --- Event Handlers ---

async function eventListHandler(_session: Session, parameters: EventListSchema, headers: Headers) {
  debug(`google/calendar/event/list`, { parameters, headers }).log(
    'auxiliary.google.calendar.eventListHandler'
  )

  const { calendarId, count } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  )

  url.searchParams.set('timeMin', new Date().toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('conferenceDataVersion', '1')

  if (count) {
    url.searchParams.set('maxResults', count.toString())
  }

  const response = await call(url.href, {
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const { items } = await response.json()

  return items.map((event: CalendarEvent) => summarizeCalendarEvent(event))
}

async function eventCreateHandler(
  _session: Session,
  parameters: EventCreateSchema,
  headers: Headers
) {
  debug(`google/calendar/event/create`, { parameters, headers }).log(
    'auxiliary.google.calendar.eventCreateHandler'
  )

  const {
    calendarId,
    summary,
    description,
    start,
    end,
    emails,
    createMeetLink,
  } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  )

  url.searchParams.set('conferenceDataVersion', '1')

  const startDateTime = new Date(start).toISOString()

  const endDateTime = isNaN(+end)
    ? new Date(end).toISOString()
    : new Date(new Date(start).getTime() + +end * 60 * 1000).toISOString()

  const body: {
    summary: string
    description?: string
    start: { dateTime: string }
    end: { dateTime: string }
    attendees: { email: string }[]
    conferenceData?: {
      createRequest: {
        requestId: string
        conferenceSolutionKey: { type: string }
      }
    }
  } = {
    summary,
    description,
    start: { dateTime: startDateTime },
    end: { dateTime: endDateTime },
    attendees: emails ? emails.split(',').map((email) => ({ email })) : [],
  }

  if (createMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  return summarizeCalendarEvent(data)
}

async function eventUpdateHandler(
  _session: Session,
  parameters: EventUpdateSchema,
  headers: Headers
) {
  debug(`google/calendar/event/update`, { parameters, headers }).log(
    'auxiliary.google.calendar.eventUpdateHandler'
  )

  const { calendarId, eventId, summary, description, start, end, emails } =
    parameters

  const token = getAccessToken(headers)

  if (end && !start && !isNaN(+end)) {
    throw new Error('Start is required when end is a duration.')
  }

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`
  )

  url.searchParams.set('conferenceDataVersion', '1')

  const body: {
    summary?: string
    description?: string
    start?: { dateTime: string }
    end?: { dateTime: string }
    attendees?: { email: string }[]
  } = {}

  if (summary) {
    body.summary = summary
  }

  if (description) {
    body.description = description
  }

  if (start) {
    const startDateTime = new Date(start).toISOString()

    body.start = { dateTime: startDateTime }

    if (end) {
      const endDateTime = isNaN(+end)
        ? new Date(end).toISOString()
        : new Date(new Date(start).getTime() + +end * 60 * 1000).toISOString()

      body.end = { dateTime: endDateTime }
    }
  } else if (end) {
    body.end = { dateTime: new Date(end).toISOString() }
  }

  if (emails) {
    body.attendees = emails.split(',').map((email) => ({
      email: email.trim(),
    }))
  }

  const response = await call(url.href, {
    method: 'PATCH',
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  return summarizeCalendarEvent(data)
}

// --- Availability Handlers ---

async function availabilityListHandler(
  _session: Session,
  parameters: AvailabilityListSchema,
  headers: Headers
) {
  debug(`google/calendar/availability/list`, { parameters, headers }).log(
    'auxiliary.google.calendar.availabilityListHandler'
  )

  const {
    calendarId,
    count,
    duration = 30,
    workingStart = '09:00',
    workingEnd = '17:00',
  } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  )

  url.searchParams.set('timeMin', new Date().toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('conferenceDataVersion', '1')

  if (count) {
    url.searchParams.set('maxResults', count.toString())
  }

  const response = await call(url.href, {
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const { items } = await response.json()

  const openings: { bookingId: string; start: string; end: string }[] = []

  let previousEnd = new Date()

  const [workStartHour, workStartMinute] = workingStart.split(':').map(Number)
  const [workEndHour, workEndMinute] = workingEnd.split(':').map(Number)

  items.forEach(
    ({
      start,
      end,
    }: {
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
    }) => {
      const eventStart = new Date(start.dateTime || start.date || '')

      const previousEndHour = previousEnd.getUTCHours()
      const previousEndMinute = previousEnd.getUTCMinutes()

      if (
        previousEndHour < workStartHour ||
        (previousEndHour === workStartHour &&
          previousEndMinute < workStartMinute)
      ) {
        previousEnd.setUTCHours(workStartHour, workStartMinute, 0, 0)
      }

      if (eventStart > previousEnd) {
        const blockStart = new Date(previousEnd)

        if (
          blockStart.getUTCHours() >= workEndHour &&
          blockStart.getUTCMinutes() > workEndMinute
        ) {
          blockStart.setUTCHours(workStartHour, workStartMinute, 0, 0)
          blockStart.setUTCDate(blockStart.getUTCDate() + 1)
        }

        while (blockStart < eventStart) {
          const blockEnd = new Date(blockStart.getTime() + duration * 60000)

          if (
            blockEnd.getUTCHours() >= workEndHour &&
            blockEnd.getUTCMinutes() > workEndMinute
          ) {
            break
          }

          // @todo maybe we can create a short ID and memorize it into redis
          // to avoid the need to encode the whole object and waste tokens

          openings.push({
            bookingId: encodeB64(
              JSON.stringify({
                s: blockStart.toISOString(),
                e: blockEnd.toISOString(),
              })
            ),
            start: blockStart.toISOString(),
            end: blockEnd.toISOString(),
          })

          blockStart.setTime(blockStart.getTime() + duration * 60000)
        }
      }

      previousEnd = new Date(end.dateTime || end.date || '')
    }
  )

  debug(`openings`, { openings }).log(
    'auxiliary.google.calendar.availabilityListHandler'
  )

  if (count) {
    return openings.slice(0, count)
  } else {
    return openings
  }
}

async function availabilityBookHandler(
  _session: Session,
  parameters: AvailabilityBookSchema,
  headers: Headers
) {
  debug(`google/calendar/availability/book`, { parameters, headers }).log(
    'auxiliary.google.calendar.availabilityBookHandler'
  )

  const {
    calendarId,
    bookingId,
    summary,
    description,
    attendees,
    createMeetLink,
  } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`
  )

  url.searchParams.set('conferenceDataVersion', '1')

  let start: string
  let end: string

  {
    const decodedString = decodeB64(bookingId)

    const result = JSON.parse(decodedString)

    start = result.s
    end = result.e
  }

  const body: {
    summary: string
    description?: string
    start: { dateTime: string }
    end: { dateTime: string }
    attendees: { email: string }[]
    conferenceData?: {
      createRequest: {
        requestId: string
        conferenceSolutionKey: { type: string }
      }
    }
  } = {
    summary,
    description,

    start: {
      dateTime: start,
    },
    end: {
      dateTime: end,
    },

    attendees: attendees.split(',').map((email) => ({
      email: email.trim(),
    })),
  }

  if (createMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  return summarizeCalendarEvent(data)
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [CALENDAR_LIST_HANDLER_NAME]: {
    schema: calendarListSchema,
    fn: calendarListHandler,
  },
  [EVENT_LIST_HANDLER_NAME]: {
    schema: eventListSchema,
    fn: eventListHandler,
  },
  [EVENT_CREATE_HANDLER_NAME]: {
    schema: eventCreateSchema,
    fn: eventCreateHandler,
  },
  [EVENT_UPDATE_HANDLER_NAME]: {
    schema: eventUpdateSchema,
    fn: eventUpdateHandler,
  },
  [AVAILABILITY_LIST_HANDLER_NAME]: {
    schema: availabilityListSchema,
    fn: availabilityListHandler,
  },
  [AVAILABILITY_BOOK_HANDLER_NAME]: {
    schema: availabilityBookSchema,
    fn: availabilityBookHandler,
  },
})
