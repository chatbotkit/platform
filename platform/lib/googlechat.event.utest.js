import { normaliseChatEventBody } from './googlechat.event'

describe('normaliseChatEventBody', () => {
  describe('non-object inputs', () => {
    it.each([null, undefined, '', 'string', 0, 42, true])(
      'returns an empty normalised body for %p (no type field, no payload)',
      (value) => {
        expect(normaliseChatEventBody(value)).toEqual({})
      }
    )
  })

  describe('classic Chat app shape', () => {
    it('returns the body unchanged when it already has a top-level type', () => {
      const body = {
        type: 'MESSAGE',
        message: { text: 'hello' },
        space: { name: 'spaces/abc' },
      }

      expect(normaliseChatEventBody(body)).toBe(body)
    })

    it('preserves all top-level fields for classic-shape bodies', () => {
      const body = {
        type: 'ADDED_TO_SPACE',
        space: { name: 'spaces/abc' },
        user: { name: 'users/xyz' },
        eventTime: '2026-05-16T06:45:44Z',
      }

      const result = normaliseChatEventBody(body)

      expect(result).toEqual(body)
    })

    it('passes through bodies with no type and no chat wrapper', () => {
      const body = { something: 'else' }

      expect(normaliseChatEventBody(body)).toBe(body)
    })
  })

  describe('Workspace add-on shape', () => {
    const baseEnvelope = {
      commonEventObject: { hostApp: 'CHAT' },
      authorizationEventObject: { systemIdToken: 'eyJ...' },
    }

    it('maps chat.messagePayload to a MESSAGE event', () => {
      const message = {
        name: 'spaces/abc/messages/m1',
        text: 'Hello',
        sender: { name: 'users/xyz', type: 'HUMAN' },
        thread: { name: 'spaces/abc/threads/t1' },
      }

      const space = { name: 'spaces/abc', type: 'DM' }

      const body = {
        ...baseEnvelope,
        chat: {
          user: { name: 'users/xyz', displayName: 'Petko' },
          eventTime: '2026-05-16T06:45:44Z',
          messagePayload: { message, space },
        },
      }

      const result = normaliseChatEventBody(body)

      expect(result).toEqual({
        type: 'MESSAGE',
        message,
        space,
        user: { name: 'users/xyz', displayName: 'Petko' },
        eventTime: '2026-05-16T06:45:44Z',
      })
    })

    it('maps chat.appCommandPayload to an APP_COMMAND event', () => {
      const message = {
        name: 'spaces/abc/messages/m2',
        text: '/callbobo hi there',
        argumentText: ' hi there',
        sender: { name: 'users/xyz', type: 'HUMAN' },
        slashCommand: { commandId: 123 },
      }

      const space = { name: 'spaces/abc', type: 'DM' }

      const body = {
        ...baseEnvelope,
        chat: {
          user: { name: 'users/xyz', displayName: 'Petko' },
          eventTime: '2026-05-16T08:07:26Z',
          appCommandPayload: {
            appCommandMetadata: {
              appCommandId: 123,
              appCommandType: 'SLASH_COMMAND',
            },
            message,
            space,
          },
        },
      }

      const result = normaliseChatEventBody(body)

      expect(result).toEqual({
        type: 'APP_COMMAND',
        message,
        space,
        appCommandMetadata: {
          appCommandId: 123,
          appCommandType: 'SLASH_COMMAND',
        },
        user: { name: 'users/xyz', displayName: 'Petko' },
        eventTime: '2026-05-16T08:07:26Z',
      })
    })

    it('maps chat.addedToSpacePayload to an ADDED_TO_SPACE event', () => {
      const space = { name: 'spaces/abc', type: 'ROOM' }

      const body = {
        chat: {
          user: { name: 'users/xyz' },
          eventTime: '2026-05-16T06:45:44Z',
          addedToSpacePayload: { space },
        },
      }

      const result = normaliseChatEventBody(body)

      expect(result).toEqual({
        type: 'ADDED_TO_SPACE',
        space,
        user: { name: 'users/xyz' },
        eventTime: '2026-05-16T06:45:44Z',
      })
    })

    it('maps chat.removedFromSpacePayload to a REMOVED_FROM_SPACE event', () => {
      const space = { name: 'spaces/abc' }

      const body = {
        chat: {
          user: { name: 'users/xyz' },
          eventTime: '2026-05-16T06:45:44Z',
          removedFromSpacePayload: { space },
        },
      }

      const result = normaliseChatEventBody(body)

      expect(result).toEqual({
        type: 'REMOVED_FROM_SPACE',
        space,
        user: { name: 'users/xyz' },
        eventTime: '2026-05-16T06:45:44Z',
      })
    })

    it('maps chat.buttonClickedPayload to a CARD_CLICKED event', () => {
      const message = { name: 'spaces/abc/messages/m1' }
      const space = { name: 'spaces/abc' }

      const body = {
        chat: {
          user: { name: 'users/xyz' },
          buttonClickedPayload: { message, space },
        },
      }

      const result = normaliseChatEventBody(body)

      expect(result).toEqual({
        type: 'CARD_CLICKED',
        message,
        space,
        user: { name: 'users/xyz' },
        eventTime: undefined,
      })
    })

    it('maps chat.widgetUpdatedPayload to a CARD_CLICKED event', () => {
      const message = { name: 'spaces/abc/messages/m1' }
      const space = { name: 'spaces/abc' }

      const body = {
        chat: {
          widgetUpdatedPayload: { message, space },
        },
      }

      const result = normaliseChatEventBody(body)

      expect(result).toMatchObject({
        type: 'CARD_CLICKED',
        message,
        space,
      })
    })

    it('returns the input unchanged when chat has no recognised payload key', () => {
      const body = {
        chat: { user: { name: 'users/xyz' }, unknownPayload: {} },
      }

      expect(normaliseChatEventBody(body)).toBe(body)
    })
  })
})
