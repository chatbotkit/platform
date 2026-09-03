import { splitBubbleText, splitStackText } from '@/lib/md.chat'
import { equal } from '@/lib/object'

import useConversationManager from '@/hooks/useConversationManager'

import useConversationManager2 from './useConversationManager2'

import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useConversationManager', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/md.chat', () => ({
  splitBubbleText: jest.fn((text) => [text]),
  splitStackText: jest.fn((text) => [text]),
}))

jest.mock('@/lib/object', () => ({
  equal: jest.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}))

describe('useConversationManager2', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useConversationManager.mockReturnValue({
      receivedMessages: [],
      incomingMessage: null,
      otherProp: 'value',
    })

    splitBubbleText.mockImplementation((text) => [text])
    splitStackText.mockImplementation((text) => [text])
    equal.mockImplementation((a, b) => JSON.stringify(a) === JSON.stringify(b))
  })

  describe('basic functionality', () => {
    it('should call useConversationManager with stream: true', () => {
      renderHook(() => useConversationManager2({}))

      expect(useConversationManager).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true })
      )
    })

    it('should return receivedMessages', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [{ id: '1', text: 'Hello' }],
        incomingMessage: null,
        otherProp: 'value',
      })

      const { result } = renderHook(() => useConversationManager2({}))

      expect(result.current.receivedMessages).toEqual([
        { id: '1', text: 'Hello' },
      ])
    })

    it('should return incomingMessage', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '2', text: 'Hi' },
        otherProp: 'value',
      })

      const { result } = renderHook(() => useConversationManager2({}))

      expect(result.current.incomingMessage).toEqual({ id: '2', text: 'Hi' })
    })

    it('should spread other props from useConversationManager', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: null,
        otherProp: 'value',
        anotherProp: 123,
      })

      const { result } = renderHook(() => useConversationManager2({}))

      expect(result.current.otherProp).toBe('value')
      expect(result.current.anotherProp).toBe(123)
    })
  })

  describe('bubble mode', () => {
    it('should split bot messages when bubble is true', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2'])

      useConversationManager.mockReturnValue({
        receivedMessages: [{ id: '1', type: 'bot', text: 'Part 1\n\nPart 2' }],
        incomingMessage: null,
      })

      renderHook(() => useConversationManager2({ bubble: true }))

      expect(splitBubbleText).toHaveBeenCalledWith('Part 1\n\nPart 2')
    })

    it('should create sub-messages for split bot messages', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2', 'Part 3'])

      useConversationManager.mockReturnValue({
        receivedMessages: [{ id: 'msg1', type: 'bot', text: 'Full text' }],
        incomingMessage: null,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      const messages = result.current.receivedMessages

      expect(messages).toHaveLength(3)
      expect(messages[0].id).toBe('sub/msg1/0')
      expect(messages[1].id).toBe('sub/msg1/1')
      expect(messages[2].id).toBe('msg1')
    })

    it('should preserve original message ID', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2'])

      useConversationManager.mockReturnValue({
        receivedMessages: [{ id: 'msg1', type: 'bot', text: 'Full text' }],
        incomingMessage: null,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      const messages = result.current.receivedMessages

      expect(messages[0].originalMessageId).toBe('msg1')
      expect(messages[1].originalMessageId).toBe('msg1')
    })

    it('should only include meta/micro/extra/actions/references/attachments on last message', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2'])

      useConversationManager.mockReturnValue({
        receivedMessages: [
          {
            id: 'msg1',
            type: 'bot',
            text: 'Full text',
            meta: { key: 'value' },
            micro: { data: 1 },
            extra: { info: 2 },
            actions: [{ action: 'test' }],
            references: [{ ref: 'test' }],
            attachments: [{ file: 'test.txt' }],
          },
        ],
        incomingMessage: null,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      const messages = result.current.receivedMessages

      expect(messages[0].meta).toBeUndefined()
      expect(messages[0].micro).toBeUndefined()
      expect(messages[0].extra).toBeUndefined()
      expect(messages[0].actions).toBeUndefined()
      expect(messages[0].references).toBeUndefined()
      expect(messages[0].attachments).toBeUndefined()

      expect(messages[1].meta).toEqual({ key: 'value' })
      expect(messages[1].micro).toEqual({ data: 1 })
      expect(messages[1].extra).toEqual({ info: 2 })
      expect(messages[1].actions).toEqual([{ action: 'test' }])
      expect(messages[1].references).toEqual([{ ref: 'test' }])
      expect(messages[1].attachments).toEqual([{ file: 'test.txt' }])
    })

    it('should not split non-bot messages', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [{ id: '1', type: 'user', text: 'Hello' }],
        incomingMessage: null,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      expect(result.current.receivedMessages).toEqual([
        { id: '1', type: 'user', text: 'Hello' },
      ])
      expect(splitBubbleText).not.toHaveBeenCalled()
    })

    it('should handle incoming message splitting', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2', 'Part 3'])

      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: 'inc1', type: 'bot', text: 'Full text' },
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      expect(result.current.receivedMessages).toHaveLength(2)
      expect(result.current.incomingMessage.text).toBe('Part 3')
    })

    it('should add sequence message IDs to split incoming messages', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2', 'Part 3'])

      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: 'inc1', type: 'bot', text: 'Full text' },
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      expect(result.current.receivedMessages[0].sequenceMessageId).toBe('seq/0')
      expect(result.current.receivedMessages[1].sequenceMessageId).toBe('seq/1')
      expect(result.current.incomingMessage.sequenceMessageId).toBe('seq/2')
    })
  })

  describe('stream mode', () => {
    it('should call splitStackText when stream is true', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '1', text: 'Test text' },
      })

      renderHook(() => useConversationManager2({ stream: true }))

      expect(splitStackText).toHaveBeenCalledWith(
        'Test text',
        expect.objectContaining({
          emitCompleteFencedCodeBlocks: false,
          emitCompleteAnchors: false,
          emitCompleteImages: false,
        })
      )
    })

    it('should pass emitCompleteFencedCodeBlocks option', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '1', text: 'Test' },
      })

      renderHook(() =>
        useConversationManager2({
          stream: true,
          emitCompleteFencedCodeBlocks: true,
        })
      )

      expect(splitStackText).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({ emitCompleteFencedCodeBlocks: true })
      )
    })

    it('should pass emitCompleteAnchors option', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '1', text: 'Test' },
      })

      renderHook(() =>
        useConversationManager2({
          stream: true,
          emitCompleteAnchors: true,
        })
      )

      expect(splitStackText).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({ emitCompleteAnchors: true })
      )
    })

    it('should pass emitCompleteImages option', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '1', text: 'Test' },
      })

      renderHook(() =>
        useConversationManager2({
          stream: true,
          emitCompleteImages: true,
        })
      )

      expect(splitStackText).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({ emitCompleteImages: true })
      )
    })

    it('should join split text with double newlines', () => {
      splitStackText.mockReturnValue(['Line 1', 'Line 2', 'Line 3'])

      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '1', text: 'Original' },
      })

      const { result } = renderHook(() =>
        useConversationManager2({ stream: true })
      )

      expect(result.current.incomingMessage.text).toBe(
        'Line 1\n\nLine 2\n\nLine 3'
      )
    })

    it('should not modify incoming message if text unchanged', () => {
      splitStackText.mockReturnValue(['Test'])

      const originalMessage = { id: '1', text: 'Test', other: 'data' }

      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: originalMessage,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ stream: true })
      )

      expect(result.current.incomingMessage).toEqual(originalMessage)
    })
  })

  describe('combined bubble and stream mode', () => {
    it('should work with both bubble and stream enabled', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2'])
      splitStackText.mockReturnValue(['Processed'])

      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: { id: '1', text: 'Original' },
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true, stream: true })
      )

      expect(splitBubbleText).toHaveBeenCalled()
      expect(splitStackText).toHaveBeenCalled()
      expect(result.current.incomingMessage.text).toBe('Processed')
    })
  })

  describe('edge cases', () => {
    it('should handle null incomingMessage', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: null,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ stream: true })
      )

      expect(result.current.incomingMessage).toBeNull()
    })

    it('should handle empty receivedMessages', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: null,
      })

      const { result } = renderHook(() => useConversationManager2({}))

      expect(result.current.receivedMessages).toEqual([])
    })

    it('should memoize receivedMessages when length unchanged', () => {
      useConversationManager.mockReturnValue({
        receivedMessages: [{ id: '1', text: 'Hello' }],
        incomingMessage: null,
      })

      const { result, rerender } = renderHook(() => useConversationManager2({}))

      const firstMessages = result.current.receivedMessages

      rerender()

      expect(result.current.receivedMessages).toBe(firstMessages)
    })

    it('should memoize incomingMessage when equal', () => {
      const message = { id: '1', text: 'Hello' }

      useConversationManager.mockReturnValue({
        receivedMessages: [],
        incomingMessage: message,
      })

      const { result, rerender } = renderHook(() => useConversationManager2({}))

      const firstMessage = result.current.incomingMessage

      rerender()

      expect(result.current.incomingMessage).toBe(firstMessage)
    })

    it('should handle messages without IDs', () => {
      splitBubbleText.mockReturnValue(['Part 1', 'Part 2'])

      useConversationManager.mockReturnValue({
        receivedMessages: [{ type: 'bot', text: 'No ID' }],
        incomingMessage: null,
      })

      const { result } = renderHook(() =>
        useConversationManager2({ bubble: true })
      )

      expect(result.current.receivedMessages[0].id).toBe('sub/0/0')
    })
  })
})
