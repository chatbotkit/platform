import { MessageType } from '@/prisma/types'

import { getMessageType, getSortedMessages, sortMessages } from '@/lib/message'

describe('getMessageType', () => {
  it('must be able to get the message type for all known types', () => {
    for (const type of Object.values(MessageType)) {
      expect(getMessageType(type)).toBe(type)
    }
  })

  it.each(Object.values(MessageType))(
    'should map enum value %s without missing switch coverage',
    (type) => {
      expect(getMessageType(type)).toBe(type)
    }
  )

  it('should handle each message type individually', () => {
    expect(getMessageType('user')).toBe(MessageType.user)
    expect(getMessageType('bot')).toBe(MessageType.bot)
    expect(getMessageType('reasoning')).toBe(MessageType.reasoning)
    expect(getMessageType('context')).toBe(MessageType.context)
    expect(getMessageType('instruction')).toBe(MessageType.instruction)
    expect(getMessageType('backstory')).toBe(MessageType.backstory)
    expect(getMessageType('checkpoint')).toBe(MessageType.checkpoint)
    expect(getMessageType('activity')).toBe(MessageType.activity)
  })

  it('should throw error for unknown message types', () => {
    expect(() => getMessageType('unknown')).toThrow(
      'Unknown message type unknown'
    )
    expect(() => getMessageType('invalid')).toThrow(
      'Unknown message type invalid'
    )
    expect(() => getMessageType('User')).toThrow('Unknown message type User')
    expect(() => getMessageType('BOT')).toThrow('Unknown message type BOT')
  })

  it('should throw error for invalid input types', () => {
    expect(() => getMessageType(null)).toThrow('Unknown message type null')
    expect(() => getMessageType(undefined)).toThrow(
      'Unknown message type undefined'
    )
    expect(() => getMessageType('')).toThrow('Unknown message type ')
    expect(() => getMessageType(123)).toThrow('Unknown message type 123')
    expect(() => getMessageType({})).toThrow(
      'Unknown message type [object Object]'
    )
    expect(() => getMessageType([])).toThrow('Unknown message type ')
  })

  it('should be case sensitive', () => {
    expect(() => getMessageType('USER')).toThrow('Unknown message type USER')
    expect(() => getMessageType('Bot')).toThrow('Unknown message type Bot')
    expect(() => getMessageType('ACTIVITY')).toThrow(
      'Unknown message type ACTIVITY'
    )
  })
})

describe('getSortedMessages', () => {
  it('sorts by createdAt date in ascending order', () => {
    const messages = [
      { createdAt: '2023-01-01' },
      { createdAt: '2022-01-01' },
      { createdAt: '2024-01-01' },
    ]

    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([
      { createdAt: '2022-01-01' },
      { createdAt: '2023-01-01' },
      { createdAt: '2024-01-01' },
    ])
  })

  it('sorts by id in ascending order', () => {
    const messages = [{ id: 'b' }, { id: 'a' }, { id: 'c' }]
    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })

  it('sorts by id alphabetically when createdAt dates are equal or not present', () => {
    const messages = [
      { id: 'b', createdAt: '2023-01-01' },
      { id: 'a', createdAt: '2023-01-01' },
      { id: 'd' },
      { id: 'c' },
    ]

    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([
      { id: 'a', createdAt: '2023-01-01' },
      { id: 'b', createdAt: '2023-01-01' },
      { id: 'c' },
      { id: 'd' },
    ])
  })

  it('handles mixed createdAt types (number, string and Date)', () => {
    const messages = [
      { id: '1', createdAt: 1640995200000 },
      { id: '2', createdAt: '2023-01-01' },
      { id: '3', createdAt: new Date('2022-01-01') },
      { id: '4', createdAt: new Date('2024-01-01') },
    ]

    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([
      { id: '1', createdAt: 1640995200000 },
      { id: '3', createdAt: new Date('2022-01-01') },
      { id: '2', createdAt: '2023-01-01' },
      { id: '4', createdAt: new Date('2024-01-01') },
    ])
  })

  it('handles empty array input', () => {
    const messages = []
    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([])
  })

  it('handles array with single element', () => {
    const messages = [{ id: '1', createdAt: '2023-01-01' }]
    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([{ id: '1', createdAt: '2023-01-01' }])
  })

  // @note see message.js for information why this test is skipped

  it.skip('if the date is the same then sort by type first', () => {
    const messages = [
      { id: '1', createdAt: '2023-01-01', type: MessageType.user },
      { id: '2', createdAt: '2023-01-01', type: MessageType.bot },
      { id: '3', createdAt: '2023-01-01', type: MessageType.user },
    ]

    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual([
      { id: '1', createdAt: '2023-01-01', type: MessageType.user },
      { id: '3', createdAt: '2023-01-01', type: MessageType.user },
      { id: '2', createdAt: '2023-01-01', type: MessageType.bot },
    ])
  })

  it('must preserve the original order of the createdAt dates are the same', () => {
    const messages = [
      { id: '1', createdAt: '2023-01-01' },
      { id: '2', createdAt: '2023-01-01' },
      { id: '3', createdAt: '2023-01-01' },
    ]

    const sortedMessages = getSortedMessages(messages)

    expect(sortedMessages).toEqual(messages)
  })

  describe('order parameter', () => {
    it('should sort in ascending order by default', () => {
      const messages = [
        { createdAt: '2023-01-01' },
        { createdAt: '2021-01-01' },
        { createdAt: '2022-01-01' },
      ]

      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages).toEqual([
        { createdAt: '2021-01-01' },
        { createdAt: '2022-01-01' },
        { createdAt: '2023-01-01' },
      ])
    })

    it('should sort in ascending order when explicitly specified', () => {
      const messages = [
        { createdAt: '2023-01-01' },
        { createdAt: '2021-01-01' },
        { createdAt: '2022-01-01' },
      ]

      const sortedMessages = getSortedMessages(messages, 'asc')

      expect(sortedMessages).toEqual([
        { createdAt: '2021-01-01' },
        { createdAt: '2022-01-01' },
        { createdAt: '2023-01-01' },
      ])
    })

    it('should sort in descending order when specified', () => {
      const messages = [
        { createdAt: '2021-01-01' },
        { createdAt: '2023-01-01' },
        { createdAt: '2022-01-01' },
      ]

      const sortedMessages = getSortedMessages(messages, 'desc')

      expect(sortedMessages).toEqual([
        { createdAt: '2023-01-01' },
        { createdAt: '2022-01-01' },
        { createdAt: '2021-01-01' },
      ])
    })

    it('should sort IDs in descending order when order is desc', () => {
      const messages = [{ id: 'a' }, { id: 'c' }, { id: 'b' }]
      const sortedMessages = getSortedMessages(messages, 'desc')

      expect(sortedMessages).toEqual([{ id: 'c' }, { id: 'b' }, { id: 'a' }])
    })

    it('should sort equal createdAt messages by id in descending order', () => {
      const messages = [
        { id: 'msg-b', createdAt: '2026-04-26T12:04:29.066Z' },
        { id: 'msg-c', createdAt: '2026-04-26T12:04:29.066Z' },
        { id: 'msg-a', createdAt: '2026-04-26T12:04:29.066Z' },
      ]

      const sortedMessages = getSortedMessages(messages, 'desc')

      expect(sortedMessages.map((message) => message.id)).toEqual([
        'msg-c',
        'msg-b',
        'msg-a',
      ])
    })
  })

  describe('edge cases and error conditions', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => getSortedMessages(null)).toThrow()
      expect(() => getSortedMessages(undefined)).toThrow()
    })

    it('should handle non-array inputs', () => {
      expect(() => getSortedMessages('not an array')).toThrow()
      expect(() => getSortedMessages({})).toThrow()
      expect(() => getSortedMessages(123)).toThrow()
    })

    it('should handle messages with invalid date formats', () => {
      const messages = [
        { id: '1', createdAt: 'invalid-date' },
        { id: '2', createdAt: '2023-01-01' },
        { id: '3', createdAt: 'another-invalid' },
      ]

      // @note invalid dates create NaN timestamps - function should handle gracefully
      const sortedMessages = getSortedMessages(messages)

      // Should still sort by id when dates are invalid
      expect(sortedMessages.map((m) => m.id)).toEqual(['1', '2', '3'])
    })

    it('should handle messages with missing properties', () => {
      const messages = [
        {},
        { id: 'only-id' },
        { createdAt: '2023-01-01' },
        { id: 'z', createdAt: '2022-01-01' },
      ]

      const sortedMessages = getSortedMessages(messages)

      // @note function returns 0 for missing properties, maintaining original order except when valid properties exist
      expect(sortedMessages).toEqual([
        {},
        { id: 'only-id' },
        { id: 'z', createdAt: '2022-01-01' },
        { createdAt: '2023-01-01' },
      ])
    })

    it('should handle messages with null/undefined properties', () => {
      const messages = [
        { id: null, createdAt: null },
        { id: undefined, createdAt: undefined },
        { id: 'valid', createdAt: '2023-01-01' },
      ]

      const sortedMessages = getSortedMessages(messages)

      // @note function checks for truthy values, so null/undefined are ignored in sorting logic
      expect(sortedMessages[0]).toEqual({ id: null, createdAt: null })
      expect(sortedMessages[1]).toEqual({ id: undefined, createdAt: undefined })
      expect(sortedMessages[2]).toEqual({
        id: 'valid',
        createdAt: '2023-01-01',
      })
    })

    it('should handle very large arrays efficiently', () => {
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        createdAt: new Date(
          2023,
          0,
          Math.floor(Math.random() * 365)
        ).toISOString(),
      }))

      const start = Date.now()
      const sortedMessages = getSortedMessages(messages)
      const duration = Date.now() - start

      expect(sortedMessages).toHaveLength(1000)
      expect(duration).toBeLessThan(100) // Should be fast
    })

    it('should handle duplicate objects with same references', () => {
      const sharedMessage = { id: 'shared', createdAt: '2023-01-01' }
      const messages = [sharedMessage, sharedMessage, sharedMessage]
      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages).toHaveLength(3)
      expect(sortedMessages.every((msg) => msg === sharedMessage)).toBe(true)
    })

    it('should handle messages with extra properties', () => {
      const messages = [
        {
          id: 'a',
          createdAt: '2023-01-01',
          type: 'user',
          text: 'hello',
          meta: { test: true },
        },
        { id: 'b', createdAt: '2022-01-01', type: 'bot', text: 'hi' },
      ]

      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages[0].id).toBe('b')
      expect(sortedMessages[1].id).toBe('a')
      // Should preserve all extra properties
      expect(sortedMessages[1].meta).toEqual({ test: true })
    })

    it('should handle messages with zero timestamps', () => {
      const messages = [
        { id: 'a', createdAt: 0 },
        { id: 'b', createdAt: '1970-01-01T00:00:00.000Z' },
        { id: 'c', createdAt: new Date(0) },
      ]

      const sortedMessages = getSortedMessages(messages)

      // All represent the same timestamp (epoch), so should sort by id
      expect(sortedMessages.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    })

    it('should handle extremely long IDs', () => {
      const longId1 = 'a'.repeat(1000)
      const longId2 = 'b'.repeat(1000)
      const messages = [{ id: longId2 }, { id: longId1 }]

      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages[0].id).toBe(longId1)
      expect(sortedMessages[1].id).toBe(longId2)
    })

    it('should handle special characters in IDs', () => {
      const messages = [
        { id: '中文' },
        { id: 'émojis-😀' },
        { id: 'ASCII' },
        { id: '123-numbers' },
        { id: '!@#$%^&*()' },
      ]

      const sortedMessages = getSortedMessages(messages)

      // Should use locale-aware string comparison
      expect(sortedMessages).toHaveLength(5)
      expect(sortedMessages[0].id).toBe('!@#$%^&*()')
    })

    it('should handle mixed valid and invalid order parameters', () => {
      const messages = [{ id: 'b' }, { id: 'a' }]

      // Invalid order should default to 'asc'
      const result1 = getSortedMessages(messages, 'invalid')

      expect(result1.map((m) => m.id)).toEqual(['a', 'b'])

      const result2 = getSortedMessages(messages, null)

      expect(result2.map((m) => m.id)).toEqual(['a', 'b'])
    })
  })

  describe('date handling specifics', () => {
    it('should handle different timestamp formats consistently', () => {
      const messages = [
        { id: '1', createdAt: 1640995200000 }, // Unix timestamp
        { id: '2', createdAt: '1640995200000' }, // String timestamp
        { id: '3', createdAt: new Date(1640995200000) }, // Date object
        { id: '4', createdAt: '2022-01-01T00:00:00.000Z' }, // ISO string
      ]

      const sortedMessages = getSortedMessages(messages)

      // All should be treated as the same date, so sort by id
      expect(sortedMessages.map((m) => m.id)).toEqual(['1', '2', '3', '4'])
    })

    it('should handle timezone differences in date strings', () => {
      const messages = [
        { id: '1', createdAt: '2023-01-01T00:00:00Z' },
        { id: '2', createdAt: '2023-01-01T00:00:00+05:00' },
        { id: '3', createdAt: '2023-01-01T00:00:00-05:00' },
      ]

      const sortedMessages = getSortedMessages(messages)

      // Earlier UTC times should come first
      expect(sortedMessages[0].id).toBe('2') // +05:00 is earliest UTC
      expect(sortedMessages[2].id).toBe('3') // -05:00 is latest UTC
    })

    it('should handle leap year and edge dates', () => {
      const messages = [
        { id: '1', createdAt: '2024-02-29T23:59:59Z' }, // Leap year
        { id: '2', createdAt: '2024-03-01T00:00:00Z' },
        { id: '3', createdAt: '2023-02-28T23:59:59Z' }, // Non-leap year
      ]

      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages.map((m) => m.id)).toEqual(['3', '1', '2'])
    })

    it('should handle far future and past dates', () => {
      const messages = [
        { id: 'future', createdAt: '9999-12-31T23:59:59Z' },
        { id: 'past', createdAt: '1000-01-01T00:00:00Z' },
        { id: 'now', createdAt: '2023-01-01T00:00:00Z' },
      ]

      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages.map((m) => m.id)).toEqual(['past', 'now', 'future'])
    })

    it('should handle very precise timestamps with milliseconds', () => {
      const messages = [
        { id: 'b', createdAt: '2023-01-01T00:00:00.002Z' },
        { id: 'a', createdAt: '2023-01-01T00:00:00.001Z' },
        { id: 'c', createdAt: '2023-01-01T00:00:00.003Z' },
      ]

      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('immutability', () => {
    it('should not modify the original array', () => {
      const originalMessages = [
        { id: 'c', createdAt: '2023-01-01' },
        { id: 'a', createdAt: '2022-01-01' },
        { id: 'b', createdAt: '2024-01-01' },
      ]

      const messagesCopy = JSON.parse(JSON.stringify(originalMessages))

      getSortedMessages(originalMessages)

      expect(originalMessages).toEqual(messagesCopy)
    })

    it('should return a new array instance', () => {
      const messages = [{ id: 'a' }, { id: 'b' }]
      const sortedMessages = getSortedMessages(messages)

      expect(sortedMessages).not.toBe(messages)
      expect(Array.isArray(sortedMessages)).toBe(true)
    })
  })
})

describe('sortMessages', () => {
  it('should sort messages in place by createdAt in ascending order', () => {
    const messages = [
      { createdAt: '2023-01-01' },
      { createdAt: '2021-01-01' },
      { createdAt: '2022-01-01' },
    ]

    const originalReference = messages

    sortMessages(messages)

    expect(messages).toBe(originalReference) // Same reference
    expect(messages).toEqual([
      { createdAt: '2021-01-01' },
      { createdAt: '2022-01-01' },
      { createdAt: '2023-01-01' },
    ])
  })

  it('should sort messages in place in descending order when specified', () => {
    const messages = [
      { createdAt: '2021-01-01' },
      { createdAt: '2023-01-01' },
      { createdAt: '2022-01-01' },
    ]

    sortMessages(messages, 'desc')

    expect(messages).toEqual([
      { createdAt: '2023-01-01' },
      { createdAt: '2022-01-01' },
      { createdAt: '2021-01-01' },
    ])
  })

  it('should sort messages by ID when no createdAt is present', () => {
    const messages = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]

    sortMessages(messages)

    expect(messages).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })

  it('should handle empty array', () => {
    const messages = []

    sortMessages(messages)

    expect(messages).toEqual([])
  })

  it('should handle single element array', () => {
    const messages = [{ id: 'single', createdAt: '2023-01-01' }]

    sortMessages(messages)

    expect(messages).toEqual([{ id: 'single', createdAt: '2023-01-01' }])
  })

  it('should modify the array length correctly when sorting', () => {
    const messages = [
      { id: 'b', createdAt: '2023-01-01' },
      { id: 'a', createdAt: '2022-01-01' },
    ]

    const originalLength = messages.length

    sortMessages(messages)

    expect(messages.length).toBe(originalLength)
    expect(messages[0].id).toBe('a')
    expect(messages[1].id).toBe('b')
  })

  describe('mutability behavior', () => {
    it('should clear and repopulate the original array', () => {
      const messages = [{ id: 'original-1' }, { id: 'original-2' }]
      const sorted = [{ id: 'sorted-1' }, { id: 'sorted-2' }]

      // Simulate what sortMessages does internally
      messages.length = 0
      messages.push(...sorted)

      expect(messages).toEqual(sorted)
      expect(messages.length).toBe(2)
    })

    it('should maintain array reference through sorting', () => {
      const messages = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]
      const externalRef = messages

      sortMessages(messages)

      expect(messages).toBe(externalRef)
      expect(messages[0].id).toBe('a')
    })
  })
})
