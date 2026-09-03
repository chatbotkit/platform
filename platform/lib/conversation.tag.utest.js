/* eslint-disable @next/next/no-assign-module-variable */
import {
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_ERROR,
  TAG_INTENT_DETECTION_BEGIN,
  TAG_INTENT_DETECTION_END,
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_PING,
  TAG_PROGRESS_REPORT,
  TAG_REASONING_TOKEN,
  TAG_RECEIVE_RESULT,
  TAG_RESULT,
  TAG_SEND_RESULT,
  TAG_TOKEN,
  TAG_USAGE,
  TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
  TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
} from '@/lib/conversation.tag'

describe('conversation.tag', () => {
  describe('conversation-specific tags', () => {
    it('should export TAG_PING constant', () => {
      expect(TAG_PING).toBe('ping')
    })

    it('should export TAG_ERROR constant', () => {
      expect(TAG_ERROR).toBe('error')
    })

    it('should export TAG_INTENT_DETECTION_BEGIN constant', () => {
      expect(TAG_INTENT_DETECTION_BEGIN).toBe('intentDetectionBegin')
    })

    it('should export TAG_INTENT_DETECTION_END constant', () => {
      expect(TAG_INTENT_DETECTION_END).toBe('intentDetectionEnd')
    })

    it('should export TAG_OPERATION_BEGIN constant', () => {
      expect(TAG_OPERATION_BEGIN).toBe('operationBegin')
    })

    it('should export TAG_OPERATION_END constant', () => {
      expect(TAG_OPERATION_END).toBe('operationEnd')
    })

    it('should export TAG_PROGRESS_REPORT constant', () => {
      expect(TAG_PROGRESS_REPORT).toBe('progressReport')
    })

    it('should export TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN constant', () => {
      expect(TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN).toBe(
        'waitForChannelMessageBegin'
      )
    })

    it('should export TAG_WAIT_FOR_CHANNEL_MESSAGE_END constant', () => {
      expect(TAG_WAIT_FOR_CHANNEL_MESSAGE_END).toBe('waitForChannelMessageEnd')
    })

    it('should export TAG_SEND_RESULT constant', () => {
      expect(TAG_SEND_RESULT).toBe('sendResult')
    })

    it('should export TAG_RECEIVE_RESULT constant', () => {
      expect(TAG_RECEIVE_RESULT).toBe('receiveResult')
    })

    it('should export TAG_RESULT constant', () => {
      expect(TAG_RESULT).toBe('result')
    })
  })

  describe('re-exported tags from conv module', () => {
    it('should export TAG_USAGE', () => {
      expect(TAG_USAGE).toBeDefined()
      expect(typeof TAG_USAGE).toBe('string')
    })

    it('should export TAG_TOKEN', () => {
      expect(TAG_TOKEN).toBeDefined()
      expect(typeof TAG_TOKEN).toBe('string')
    })

    it('should export TAG_REASONING_TOKEN', () => {
      expect(TAG_REASONING_TOKEN).toBeDefined()
      expect(typeof TAG_REASONING_TOKEN).toBe('string')
    })

    it('should export TAG_MESSAGE', () => {
      expect(TAG_MESSAGE).toBeDefined()
      expect(typeof TAG_MESSAGE).toBe('string')
    })

    it('should export TAG_COMPLETE_BEGIN', () => {
      expect(TAG_COMPLETE_BEGIN).toBeDefined()
      expect(typeof TAG_COMPLETE_BEGIN).toBe('string')
    })

    it('should export TAG_COMPLETE_END', () => {
      expect(TAG_COMPLETE_END).toBeDefined()
      expect(typeof TAG_COMPLETE_END).toBe('string')
    })
  })

  describe('tag naming conventions', () => {
    it('should use camelCase for all tag constants', () => {
      const tags = [
        TAG_PING,
        TAG_ERROR,
        TAG_INTENT_DETECTION_BEGIN,
        TAG_INTENT_DETECTION_END,
        TAG_OPERATION_BEGIN,
        TAG_OPERATION_END,
        TAG_PROGRESS_REPORT,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
        TAG_SEND_RESULT,
        TAG_RECEIVE_RESULT,
        TAG_RESULT,
      ]

      tags.forEach((tag) => {
        expect(tag).toMatch(/^[a-z][a-zA-Z]*$/)
      })
    })

    it('should have matching Begin/End pairs', () => {
      expect(TAG_INTENT_DETECTION_BEGIN).toBe('intentDetectionBegin')
      expect(TAG_INTENT_DETECTION_END).toBe('intentDetectionEnd')

      expect(TAG_OPERATION_BEGIN).toBe('operationBegin')
      expect(TAG_OPERATION_END).toBe('operationEnd')

      expect(TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN).toBe(
        'waitForChannelMessageBegin'
      )
      expect(TAG_WAIT_FOR_CHANNEL_MESSAGE_END).toBe('waitForChannelMessageEnd')

      expect(TAG_COMPLETE_BEGIN).toBeDefined()
      expect(TAG_COMPLETE_END).toBeDefined()
    })
  })

  describe('tag uniqueness', () => {
    it('should have unique values for all conversation-specific tags', () => {
      const tags = [
        TAG_PING,
        TAG_ERROR,
        TAG_INTENT_DETECTION_BEGIN,
        TAG_INTENT_DETECTION_END,
        TAG_OPERATION_BEGIN,
        TAG_OPERATION_END,
        TAG_PROGRESS_REPORT,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
        TAG_SEND_RESULT,
        TAG_RECEIVE_RESULT,
        TAG_RESULT,
      ]

      const uniqueTags = new Set(tags)

      expect(uniqueTags.size).toBe(tags.length)
    })

    it('should not conflict with re-exported tags', () => {
      const conversationTags = [
        TAG_PING,
        TAG_ERROR,
        TAG_INTENT_DETECTION_BEGIN,
        TAG_INTENT_DETECTION_END,
        TAG_OPERATION_BEGIN,
        TAG_OPERATION_END,
        TAG_PROGRESS_REPORT,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
        TAG_SEND_RESULT,
        TAG_RECEIVE_RESULT,
        TAG_RESULT,
      ]

      const reexportedTags = [
        TAG_USAGE,
        TAG_TOKEN,
        TAG_REASONING_TOKEN,
        TAG_MESSAGE,
        TAG_COMPLETE_BEGIN,
        TAG_COMPLETE_END,
      ]

      const allTags = [...conversationTags, ...reexportedTags]
      const uniqueTags = new Set(allTags)

      expect(uniqueTags.size).toBe(allTags.length)
    })
  })

  describe('tag type validation', () => {
    it('should export all tags as strings', () => {
      const allTags = [
        TAG_PING,
        TAG_ERROR,
        TAG_USAGE,
        TAG_INTENT_DETECTION_BEGIN,
        TAG_INTENT_DETECTION_END,
        TAG_OPERATION_BEGIN,
        TAG_OPERATION_END,
        TAG_PROGRESS_REPORT,
        TAG_TOKEN,
        TAG_REASONING_TOKEN,
        TAG_MESSAGE,
        TAG_COMPLETE_BEGIN,
        TAG_COMPLETE_END,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
        TAG_SEND_RESULT,
        TAG_RECEIVE_RESULT,
        TAG_RESULT,
      ]

      allTags.forEach((tag) => {
        expect(typeof tag).toBe('string')
        expect(tag.length).toBeGreaterThan(0)
      })
    })

    it('should not export empty strings', () => {
      const allTags = [
        TAG_PING,
        TAG_ERROR,
        TAG_USAGE,
        TAG_INTENT_DETECTION_BEGIN,
        TAG_INTENT_DETECTION_END,
        TAG_OPERATION_BEGIN,
        TAG_OPERATION_END,
        TAG_PROGRESS_REPORT,
        TAG_TOKEN,
        TAG_REASONING_TOKEN,
        TAG_MESSAGE,
        TAG_COMPLETE_BEGIN,
        TAG_COMPLETE_END,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
        TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
        TAG_SEND_RESULT,
        TAG_RECEIVE_RESULT,
        TAG_RESULT,
      ]

      allTags.forEach((tag) => {
        expect(tag).not.toBe('')
      })
    })
  })

  describe('semantic grouping', () => {
    it('should have result-related tags', () => {
      expect(TAG_SEND_RESULT).toBe('sendResult')
      expect(TAG_RECEIVE_RESULT).toBe('receiveResult')
      expect(TAG_RESULT).toBe('result')
    })

    it('should have detection/operation lifecycle tags', () => {
      const lifecycleTags = [
        TAG_INTENT_DETECTION_BEGIN,
        TAG_INTENT_DETECTION_END,
        TAG_OPERATION_BEGIN,
        TAG_OPERATION_END,
        TAG_COMPLETE_BEGIN,
        TAG_COMPLETE_END,
      ]

      lifecycleTags.forEach((tag) => {
        expect(typeof tag).toBe('string')
        expect(tag.length).toBeGreaterThan(0)
      })
    })

    it('should have progress/status tags', () => {
      expect(TAG_PROGRESS_REPORT).toBe('progressReport')
      expect(TAG_PING).toBe('ping')
      expect(TAG_ERROR).toBe('error')
    })
  })

  describe('Sink type exports', () => {
    it('should export Sink interface', async () => {
      const { Sink } = await import('@/lib/conversation.tag')

      // Sink is a TypeScript type, not a runtime value, so we just verify the module loads
      expect(typeof Sink).toBe('undefined')
    })

    it('should export EngineSinkItem type', async () => {
      const { EngineSinkItem } = await import('@/lib/conversation.tag')

      // EngineSinkItem is a TypeScript type, not a runtime value
      expect(typeof EngineSinkItem).toBe('undefined')
    })

    it('should export individual data type interfaces', async () => {
      // These are TypeScript types that don't exist at runtime
      // Just verify the module exports compile correctly
      const module = await import('@/lib/conversation.tag')

      // Tag constants should be available
      expect(module.TAG_TOKEN).toBe('token')
      expect(module.TAG_MESSAGE).toBe('message')
      expect(module.TAG_ERROR).toBe('error')
    })
  })
})
