/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlers = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    capturedHandlers = Object.fromEntries(
      Object.entries(handlers).map(([name, handler]) => [
        name,
        {
          ...handler,
          fn: (parameters, headers) =>
            handler.fn({ user: { id: 'test-user-id' } }, parameters, headers),
        },
      ])
    )

    return jest.fn()
  }),
}))

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

require('@/pages/api/auxiliary/skillset/ability/google/calendar')

const call = require('@/lib/call').default

describe('auxiliary/skillset/ability/google/calendar', () => {
  const headers = new Headers({ 'x-access-token': 'Bearer test-token' })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns meeting links from Google Calendar events', async () => {
    call.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            {
              id: 'event-123',
              summary: 'Launch review',
              description:
                'Backup room: https://example.zoom.us/j/123?pwd=abc.',
              location: 'https://meet.google.com/location-link',
              htmlLink: 'https://calendar.google.com/event?eid=event-123',
              hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc',
              start: { dateTime: '2026-06-01T10:00:00.000Z' },
              end: { dateTime: '2026-06-01T10:30:00.000Z' },
              conferenceData: {
                conferenceId: 'aaa-bbbb-ccc',
                conferenceSolution: {
                  key: { type: 'hangoutsMeet' },
                  name: 'Google Meet',
                },
                entryPoints: [
                  {
                    entryPointType: 'video',
                    uri: 'https://meet.google.com/aaa-bbbb-ccc',
                    label: 'meet.google.com/aaa-bbbb-ccc',
                  },
                  {
                    entryPointType: 'phone',
                    uri: 'tel:+15551234567',
                  },
                ],
              },
            },
          ],
        }),
    })

    const result = await capturedHandlers['event/list'].fn(
      { calendarId: 'primary' },
      headers
    )

    const url = new URL(call.mock.calls[0][0])

    expect(url.searchParams.get('conferenceDataVersion')).toBe('1')
    expect(result).toEqual([
      expect.objectContaining({
        id: 'event-123',
        summary: 'Launch review',
        htmlLink: 'https://calendar.google.com/event?eid=event-123',
        hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc',
        meetingUrl: 'https://meet.google.com/aaa-bbbb-ccc',
        meetingLinks: [
          {
            type: 'google_meet',
            url: 'https://meet.google.com/aaa-bbbb-ccc',
            source: 'conferenceData',
            label: 'meet.google.com/aaa-bbbb-ccc',
          },
          {
            type: 'zoom',
            url: 'https://example.zoom.us/j/123?pwd=abc',
            source: 'description',
          },
          {
            type: 'google_meet',
            url: 'https://meet.google.com/location-link',
            source: 'location',
          },
        ],
      }),
    ])
  })

  it('can request and return a Google Meet link when creating an event', async () => {
    call.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'event-456',
          summary: 'Customer call',
          hangoutLink: 'https://meet.google.com/ddd-eeee-fff',
          conferenceData: {
            conferenceId: 'ddd-eeee-fff',
            entryPoints: [
              {
                entryPointType: 'video',
                uri: 'https://meet.google.com/ddd-eeee-fff',
              },
            ],
          },
        }),
    })

    const result = await capturedHandlers['event/create'].fn(
      {
        calendarId: 'primary',
        summary: 'Customer call',
        start: '2026-06-01T10:00:00.000Z',
        end: '30',
        emails: 'ada@example.com',
        createMeetLink: true,
      },
      headers
    )

    const url = new URL(call.mock.calls[0][0])
    const body = JSON.parse(call.mock.calls[0][1].body)

    expect(url.searchParams.get('conferenceDataVersion')).toBe('1')
    expect(body.conferenceData).toEqual({
      createRequest: {
        requestId: expect.any(String),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    })
    expect(result).toEqual(
      expect.objectContaining({
        id: 'event-456',
        meetingUrl: 'https://meet.google.com/ddd-eeee-fff',
        meetingLinks: [
          {
            type: 'google_meet',
            url: 'https://meet.google.com/ddd-eeee-fff',
            source: 'conferenceData',
          },
        ],
      })
    )
  })
})
