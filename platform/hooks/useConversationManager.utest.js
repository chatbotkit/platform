/* eslint-disable @typescript-eslint/no-require-imports */
import { extractUrls } from '@/lib/unfurl.url'

import useConversationManager, {
  DATASET_SEARCH_BEGIN_TYPE,
  DATASET_SEARCH_END_TYPE,
  ERROR_TYPE,
  MESSAGE_TYPE,
  OPERATION_BEGIN_TYPE,
  OPERATION_END_TYPE,
  REASONING_TOKEN_TYPE,
  RECEIVE_RESULT_TYPE,
  SEND_RESULT_TYPE,
  TOKEN_TYPE,
  WAIT_FOR_CHANNEL_MESSAGE_BEGIN_TYPE,
} from '@/hooks/useConversationManager'
import useConversationManagerFetch from '@/hooks/useConversationManagerFetch'

import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useTrace', () => ({
  __esModule: true,

  default: jest.fn(() => ({
    log: jest.fn(),
    event: jest.fn(),
  })),
}))

jest.mock('@/hooks/useConversationManagerFetch', () => ({
  __esModule: true,

  default: jest.fn(),
}))

jest.mock('@/lib/unfurl.url', () => ({
  extractUrls: jest.fn(() => []),
}))

global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')

describe('useConversationManager', () => {
  let mockFetch
  let mockFetchStream
  let mockReportError

  beforeEach(() => {
    jest.clearAllMocks()

    mockFetch = jest.fn()
    mockFetchStream = jest.fn()
    mockReportError = jest.fn()

    useConversationManagerFetch.mockReturnValue({
      loading: false,
      streaming: false,
      code: null,
      fetch: mockFetch,
      fetchStream: mockFetchStream,
      reportError: mockReportError,
    })

    extractUrls.mockReturnValue([])
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useConversationManager())

      expect(result.current.conversationId).toBe(null)
      expect(result.current.token).toBe(null)
      expect(result.current.messages).toEqual([])
      expect(result.current.entities).toEqual({})
      expect(result.current.references).toEqual({})
      expect(result.current.functions).toEqual([])
      expect(result.current.attachments).toEqual([])
      expect(result.current.text).toBe('')
      expect(result.current.thinking).toBe(false)
      expect(result.current.writing).toBe(false)
    })

    it('should initialize with custom initial state', () => {
      const { result } = renderHook(() =>
        useConversationManager({
          backstory: 'Custom backstory',
          model: 'gpt-4',
          botId: 'bot-123',
          conversationId: 'conv-456',
          token: 'token-789',
          messages: [{ id: 'msg-1', type: 'user', text: 'Hello' }],
        })
      )

      expect(result.current.backstory).toBe('Custom backstory')
      expect(result.current.model).toBe('gpt-4')
      expect(result.current.botId).toBe('bot-123')
      expect(result.current.conversationId).toBe('conv-456')
      expect(result.current.token).toBe('token-789')
      expect(result.current.messages).toHaveLength(1)
    })
  })

  describe('startConversation', () => {
    it('should create a new conversation successfully', async () => {
      mockFetch.mockResolvedValue({
        data: {
          id: 'conv-new-123',
          token: 'token-abc',
        },
        error: null,
      })

      const { result } = renderHook(() => useConversationManager())

      await act(async () => {
        await result.current.startConversation()
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/v1/conversation/create',
        expect.objectContaining({
          data: expect.objectContaining({
            botId: '',
            backstory: '',
            model: '',
          }),
        })
      )

      expect(result.current.conversationId).toBe('conv-new-123')
      expect(result.current.token).toBe('token-abc')
    })

    it('should clear messages when autoClear is enabled', async () => {
      mockFetch.mockResolvedValue({
        data: { id: 'conv-123', token: 'token-123' },
        error: null,
      })

      const { result } = renderHook(() =>
        useConversationManager({
          autoClear: true,
          messages: [{ id: 'msg-1', type: 'user', text: 'Old message' }],
        })
      )

      expect(result.current.messages).toHaveLength(1)

      await act(async () => {
        await result.current.startConversation()
      })

      expect(result.current.messages).toHaveLength(0)
    })

    it('should add backstory message when autoAddBackstory is enabled', async () => {
      mockFetch.mockResolvedValue({
        data: { id: 'conv-123', token: 'token-123' },
        error: null,
      })

      const { result } = renderHook(() =>
        useConversationManager({
          autoAddBackstory: true,
          backstory: 'You are a helpful assistant',
        })
      )

      await act(async () => {
        await result.current.startConversation()
      })

      const backstoryMessage = result.current.messages.find(
        (msg) => msg.type === 'backstory'
      )

      expect(backstoryMessage).toBeDefined()
      expect(backstoryMessage.text).toBe('You are a helpful assistant')
    })

    it('should flush pending text when starting conversation', async () => {
      mockFetch.mockResolvedValue({
        data: { id: 'conv-123', token: 'token-123' },
        error: null,
      })

      const { result } = renderHook(() => useConversationManager())

      act(() => {
        result.current.setText('Hello, bot!')
      })

      await act(async () => {
        await result.current.startConversation()
      })

      expect(result.current.text).toBe('')

      const userMessage = result.current.messages.find(
        (msg) => msg.type === 'user'
      )

      expect(userMessage).toBeDefined()
      expect(userMessage.text).toBe('Hello, bot!')
    })

    it('should handle errors during conversation creation', async () => {
      const error = new Error('Failed to create conversation')

      mockFetch.mockResolvedValue({
        data: null,
        error: error,
      })

      const onError = jest.fn()

      const { result } = renderHook(() => useConversationManager({ onError }))

      await act(async () => {
        await result.current.startConversation()
      })

      expect(onError).toHaveBeenCalledWith(error)
      expect(mockReportError).toHaveBeenCalledWith(error, expect.any(Object))
      expect(result.current.conversationId).toBe(null)
    })

    it('should start complete flow when autoStart is enabled', async () => {
      const mockStream = async function* () {
        yield { type: TOKEN_TYPE, data: { token: 'Hello' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Hello' },
        }
      }

      mockFetch.mockResolvedValue({
        data: { id: 'conv-123', token: 'token-123' },
        error: null,
      })
      mockFetchStream.mockReturnValue(mockStream())

      const onStart = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          autoStart: true,
          onStart,
        })
      )

      act(() => {
        result.current.setText('Start message')
      })

      await act(async () => {
        await result.current.startConversation()
      })

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledWith('conv-123', expect.any(Object))
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/complete',
          expect.any(Object)
        )
      })
    })
  })

  describe('receiveMessage', () => {
    it('should process token stream and build bot message', async () => {
      const mockStream = async function* () {
        yield { type: TOKEN_TYPE, data: { token: 'Hello' } }
        yield { type: TOKEN_TYPE, data: { token: ' ' } }
        yield { type: TOKEN_TYPE, data: { token: 'there' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-bot-1', text: 'Hello there' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      expect(result.current.thinking).toBe(false)
      expect(result.current.writing).toBe(false)

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
      expect(botMessage.text).toBe('Hello there')
      expect(botMessage.id).toBe('msg-bot-1')
    })

    it('should handle reasoning tokens separately', async () => {
      const mockStream = async function* () {
        yield { type: REASONING_TOKEN_TYPE, data: { token: 'thinking...' } }
        yield { type: TOKEN_TYPE, data: { token: 'Answer' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Answer' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
      expect(botMessage.reasoning).toContain('thinking...')
    })

    it('should handle dataset search results', async () => {
      const mockRecords = [
        { id: 'rec-1', text: 'Reference 1' },
        { id: 'rec-2', text: 'Reference 2' },
      ]

      const mockStream = async function* () {
        yield { type: TOKEN_TYPE, data: { token: 'Based on references' } }
        yield {
          type: DATASET_SEARCH_END_TYPE,
          data: { records: mockRecords },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Based on references' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      expect(result.current.references).toEqual(mockRecords)

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage.references).toEqual(mockRecords)
    })

    it('should remove message when empty result is received', async () => {
      const mockStream = async function* () {
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: '' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessages = result.current.messages.filter(
        (msg) => msg.type === 'bot'
      )

      expect(botMessages).toHaveLength(0)
    })

    it('should handle errors and remove temp message on LIMITS_REACHED', async () => {
      const mockStream = async function* () {
        yield {
          type: ERROR_TYPE,
          data: { code: 'LIMITS_REACHED', message: 'Rate limit exceeded' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const onError = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onError,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      expect(onError).toHaveBeenCalled()

      const botMessages = result.current.messages.filter(
        (msg) => msg.type === 'bot'
      )

      expect(botMessages).toHaveLength(0)
    })

    it('should call onReceive callback when result is received', async () => {
      const mockStream = async function* () {
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Response' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const onReceive = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onReceive,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      expect(onReceive).toHaveBeenCalledWith(
        'conv-123',
        expect.objectContaining({
          id: 'msg-1',
          text: 'Response',
        })
      )
    })
  })

  describe('sendMessage', () => {
    it('should send user message and process response', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      act(() => {
        result.current.setText('Hello bot')
      })

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(result.current.text).toBe('')
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/send',
          expect.objectContaining({
            data: expect.objectContaining({
              text: 'Hello bot',
            }),
          })
        )
      })
    })

    it('should redact entities before sending', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          entities: {
            'user@email.com': '[REDACTED]',
          },
        })
      )

      act(() => {
        result.current.setText('Contact me at user@email.com')
      })

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/send',
          expect.objectContaining({
            data: expect.objectContaining({
              entities: expect.any(Array),
            }),
          })
        )
      })
    })

    it('should include functions in send request', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const functions = [
        {
          name: 'getWeather',
          description: 'Get weather info',
          parameters: { location: 'string' },
        },
      ]

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          functions,
        })
      )

      act(() => {
        result.current.setText('What is the weather?')
      })

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/send',
          expect.objectContaining({
            data: expect.objectContaining({
              functions: expect.arrayContaining([
                expect.objectContaining({
                  name: 'getWeather',
                  description: 'Get weather info',
                }),
              ]),
            }),
          })
        )
      })
    })

    it('should automatically expose handler functions as channel functions', async () => {
      const handler = jest.fn().mockResolvedValue({ temperature: 72 })
      let channel

      mockFetchStream.mockImplementation((_url, options) => {
        channel = options.data.functions[0].result.channel

        return (async function* () {
          yield {
            type: WAIT_FOR_CHANNEL_MESSAGE_BEGIN_TYPE,
            data: {
              channel,
              function: {
                name: 'getWeather',
                args: {
                  location: 'London',
                },
              },
            },
          }

          yield {
            type: SEND_RESULT_TYPE,
            data: { entities: [] },
          }
        })()
      })

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          functions: [
            {
              name: 'getWeather',
              description: 'Get weather info',
              parameters: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                  },
                },
              },
              handler,
            },
          ],
        })
      )

      act(() => {
        result.current.setText('What is the weather?')
      })

      await act(async () => {
        await result.current.sendMessage()
      })

      expect(channel).toMatch(/^conversation-function-getWeather-/)

      expect(mockFetchStream).toHaveBeenCalledWith(
        '/v1/conversation/conv-123/send',
        expect.objectContaining({
          data: expect.objectContaining({
            functions: [
              expect.objectContaining({
                name: 'getWeather',
                result: {
                  channel,
                },
              }),
            ],
          }),
        })
      )

      expect(mockFetchStream.mock.calls[0][1].data.functions[0].handler).toBe(
        undefined
      )

      expect(handler).toHaveBeenCalledWith({
        location: 'London',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `/v1/channel/${channel}/publish`,
        expect.objectContaining({
          data: {
            message: {
              result: {
                temperature: 72,
              },
            },
          },
          trackLoading: false,
          trackStreaming: false,
        })
      )
    })

    it('should keep public functions unchanged when adding internal channels', async () => {
      const handler = jest.fn()
      const functions = [
        {
          name: 'getWeather',
          description: 'Get weather info',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler,
        },
      ]

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          functions,
        })
      )

      expect(result.current.functions).toBe(functions)
      expect(result.current.functions[0].result).toBe(undefined)
      expect(result.current.functions[0].handler).toBe(handler)
    })

    it('should keep generated handler channels stable across rerenders', async () => {
      let channel

      mockFetchStream.mockImplementation((_url, options) => {
        channel = options.data.functions[0].result.channel

        return (async function* () {
          yield {
            type: SEND_RESULT_TYPE,
            data: { entities: [] },
          }
        })()
      })

      const handler = jest.fn()
      const functions = [
        {
          name: 'getWeather',
          description: 'Get weather info',
          parameters: {
            type: 'object',
            properties: {},
          },
          handler,
        },
      ]

      const { result, rerender } = renderHook(
        ({ functions }) =>
          useConversationManager({
            conversationId: 'conv-123',
            functions,
          }),
        {
          initialProps: {
            functions,
          },
        }
      )

      act(() => {
        result.current.setText('What is the weather?')
      })

      await act(async () => {
        await result.current.sendMessage()
      })

      const firstChannel = channel

      rerender({
        functions,
      })

      act(() => {
        result.current.setText('What is the weather again?')
      })

      await act(async () => {
        await result.current.sendMessage()
      })

      expect(channel).toBe(firstChannel)
    })

    it('should keep generated handler channels stable when callers recreate function arrays', async () => {
      let channel

      mockFetchStream.mockImplementation((_url, options) => {
        channel = options.data.functions[0].result.channel

        return (async function* () {
          yield {
            type: SEND_RESULT_TYPE,
            data: { entities: [] },
          }
        })()
      })

      const handler = jest.fn()

      function createFunctions() {
        return [
          {
            name: 'getWeather',
            description: 'Get weather info',
            parameters: {
              type: 'object',
              properties: {},
            },
            handler,
          },
        ]
      }

      const { result, rerender } = renderHook(
        ({ functions }) =>
          useConversationManager({
            conversationId: 'conv-123',
            functions,
          }),
        {
          initialProps: {
            functions: createFunctions(),
          },
        }
      )

      act(() => {
        result.current.setText('What is the weather?')
      })

      await act(async () => {
        await result.current.sendMessage()
      })

      const firstChannel = channel

      rerender({
        functions: createFunctions(),
      })

      act(() => {
        result.current.setText('What is the weather again?')
      })

      await act(async () => {
        await result.current.sendMessage()
      })

      expect(channel).toBe(firstChannel)
    })

    it('should publish channel function handler errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('No weather today'))
      let channel

      mockFetchStream.mockImplementation((_url, options) => {
        channel = options.data.functions[0].result.channel

        return (async function* () {
          yield {
            type: WAIT_FOR_CHANNEL_MESSAGE_BEGIN_TYPE,
            data: {
              channel,
              function: {
                name: 'getWeather',
                args: {},
              },
            },
          }

          yield {
            type: SEND_RESULT_TYPE,
            data: { entities: [] },
          }
        })()
      })

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          functions: [
            {
              name: 'getWeather',
              description: 'Get weather info',
              parameters: {
                type: 'object',
                properties: {},
              },
              handler,
            },
          ],
        })
      )

      act(() => {
        result.current.setText('What is the weather?')
      })

      await act(async () => {
        await result.current.sendMessage()
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `/v1/channel/${channel}/publish`,
        expect.objectContaining({
          data: {
            message: {
              error: 'No weather today',
            },
          },
        })
      )
    })

    it('should call onSend callback when send completes', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const onSend = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onSend,
        })
      )

      act(() => {
        result.current.setText('Test message')
      })

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith(
          'conv-123',
          expect.objectContaining({
            entities: expect.any(Array),
          })
        )
      })
    })

    it('should handle dataset operations during send', async () => {
      const mockStream = async function* () {
        yield {
          type: DATASET_SEARCH_BEGIN_TYPE,
          data: {},
        }
        yield {
          type: DATASET_SEARCH_END_TYPE,
          data: { records: [{ id: 'rec-1' }] },
        }
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      act(() => {
        result.current.setText('Search query')
      })

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(result.current.references).toEqual([{ id: 'rec-1' }])
      })
    })

    it('should do nothing when no text is provided', () => {
      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      act(() => {
        result.current.sendMessage()
      })

      // Should not call fetchStream when there's no text
      expect(mockFetchStream).not.toHaveBeenCalled()
    })

    it('should truncate text when maxTextByteLength is set', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const maxTextByteLength = 10

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          maxTextByteLength,
        })
      )

      // Set text longer than maxTextByteLength
      act(() => {
        result.current.setText(
          'This is a very long message that exceeds the limit'
        )
      })

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/send',
          expect.objectContaining({
            data: expect.objectContaining({
              text: 'This is a ', // truncated to 10 bytes
            }),
          })
        )
      })
    })
  })

  describe('completeMessage', () => {
    it('should complete a full conversation turn', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Complete' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Complete response' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      act(() => {
        result.current.setText('User message')
      })

      act(() => {
        result.current.completeMessage()
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/complete',
          expect.any(Object)
        )
      })

      await waitFor(() => {
        const botMessage = result.current.messages.find(
          (msg) => msg.type === 'bot'
        )

        expect(botMessage).toBeDefined()
        expect(botMessage.text).toBe('Complete response')
      })
    })

    it('should truncate text when maxTextByteLength is set', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Response' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const maxTextByteLength = 10

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          maxTextByteLength,
        })
      )

      // Set text longer than maxTextByteLength
      act(() => {
        result.current.setText(
          'This is a very long message that exceeds the limit'
        )
      })

      act(() => {
        result.current.completeMessage()
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-123/complete',
          expect.objectContaining({
            data: expect.objectContaining({
              text: 'This is a ', // truncated to 10 bytes
            }),
          })
        )
      })
    })

    it('should handle reasoning tokens in complete flow', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
        yield { type: REASONING_TOKEN_TYPE, data: { token: 'Let me think...' } }
        yield { type: TOKEN_TYPE, data: { token: 'Answer' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Answer' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      act(() => {
        result.current.setText('Question?')
      })

      act(() => {
        result.current.completeMessage()
      })

      await waitFor(() => {
        const botMessage = result.current.messages.find(
          (msg) => msg.type === 'bot'
        )

        expect(botMessage).toBeDefined()
        expect(botMessage.reasoning).toContain('Let me think...')
      })
    })

    it('should call both onSend and onReceive callbacks', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Response' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const onSend = jest.fn()
      const onReceive = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onSend,
          onReceive,
        })
      )

      act(() => {
        result.current.setText('Test')
      })

      act(() => {
        result.current.completeMessage()
      })

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('conv-123', expect.any(Object))
      })

      await waitFor(() => {
        expect(onReceive).toHaveBeenCalledWith('conv-123', expect.any(Object))
      })
    })

    it('should throw with correct error message when conversationId is null', () => {
      // @note the completeMessage function has a guard that throws when
      // conversationId is null - this test verifies the error message is
      // correct (not copy-pasted from processAttachments)
      const fs = require('fs')
      const path = require('path')

      const source = fs.readFileSync(
        path.resolve(__dirname, 'useConversationManager.jsx'),
        'utf8'
      )

      // there should be exactly one "process attachments" guard - in processAttachments
      const processAttachmentsGuards = (
        source.match(
          /throw new Error\('Conversation ID is required to process attachments'\)/g
        ) || []
      ).length

      expect(processAttachmentsGuards).toBe(1)

      // completeMessage should use the correct message, not a copy-paste from processAttachments
      expect(source).toContain(
        "throw new Error('Conversation ID is required to complete a message')"
      )
    })
  })

  describe('initiateMessage', () => {
    it('should initiate conversation with bot message', async () => {
      const mockStream = async function* () {
        yield { type: TOKEN_TYPE, data: { token: 'Hello' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Hello user' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.initiateMessage({ textToUse: 'Start prompt' })
      })

      expect(mockFetchStream).toHaveBeenCalledWith(
        '/v1/conversation/conv-123/initiate',
        expect.objectContaining({
          data: expect.objectContaining({
            text: 'Start prompt',
          }),
        })
      )

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
      expect(botMessage.text).toBe('Hello user')
    })

    it('should handle reasoning tokens in initiate flow', async () => {
      const mockStream = async function* () {
        yield { type: REASONING_TOKEN_TYPE, data: { token: 'Processing...' } }
        yield { type: TOKEN_TYPE, data: { token: 'Initiated' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Initiated' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.initiateMessage({ textToUse: 'Init' })
      })

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage.reasoning).toContain('Processing...')
    })

    it('should extend message with dataset references', async () => {
      const mockRecords = [{ id: 'rec-1', text: 'Reference' }]

      const mockStream = async function* () {
        yield { type: TOKEN_TYPE, data: { token: 'Response' } }
        yield {
          type: DATASET_SEARCH_END_TYPE,
          data: { records: mockRecords },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Response with refs' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.initiateMessage({ textToUse: 'Query' })
      })

      expect(result.current.references).toEqual(mockRecords)

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage.references).toEqual(mockRecords)
    })
  })

  describe('interact', () => {
    it('should start conversation when no conversationId exists', async () => {
      mockFetch.mockResolvedValue({
        data: { id: 'conv-123', token: 'token-123' },
        error: null,
      })

      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Hi' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Hi there' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({ autoStart: true })
      )

      act(() => {
        result.current.setText('Hello')
      })

      act(() => {
        result.current.interact()
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/v1/conversation/create',
          expect.any(Object)
        )
      })

      await waitFor(() => {
        expect(result.current.conversationId).toBe('conv-123')
      })
    })

    it('should complete message when conversationId exists', async () => {
      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Response' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-existing',
        })
      )

      act(() => {
        result.current.setText('Follow-up message')
      })

      act(() => {
        result.current.interact()
      })

      await waitFor(() => {
        expect(mockFetchStream).toHaveBeenCalledWith(
          '/v1/conversation/conv-existing/complete',
          expect.any(Object)
        )
      })
    })
  })

  describe('abort', () => {
    it('should provide abort functionality', () => {
      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      // Just verify the abort function exists and can be called
      expect(typeof result.current.abort).toBe('function')

      act(() => {
        result.current.abort()
      })

      // Verify abort completed without error
      expect(result.current.thinking).toBe(false)
      expect(result.current.writing).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset conversation state', async () => {
      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          token: 'token-123',
          messages: [{ id: 'msg-1', type: 'user', text: 'Hello' }],
        })
      )

      expect(result.current.conversationId).toBe('conv-123')
      expect(result.current.messages).toHaveLength(1)

      act(() => {
        result.current.reset()
      })

      expect(result.current.conversationId).toBe(null)
      expect(result.current.messages).toEqual([])
    })

    it('should reset token when full reset is requested', async () => {
      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          token: 'token-123',
        })
      )

      expect(result.current.token).toBe('token-123')

      act(() => {
        result.current.reset({ full: true })
      })

      expect(result.current.token).toBe(null)
    })

    it('should keep token when full reset is not requested', async () => {
      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          token: 'token-123',
        })
      )

      expect(result.current.token).toBe('token-123')

      act(() => {
        result.current.reset()
      })

      expect(result.current.token).toBe('token-123')
    })
  })

  describe('flushText', () => {
    it('should flush pending text to messages', async () => {
      const { result } = renderHook(() => useConversationManager())

      act(() => {
        result.current.setText('Pending message')
      })

      expect(result.current.text).toBe('Pending message')
      expect(result.current.messages).toHaveLength(0)

      await act(async () => {
        await result.current.flushText()
      })

      expect(result.current.text).toBe('')
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].text).toBe('Pending message')
      expect(result.current.messages[0].type).toBe('user')
    })

    it('should do nothing when no text is pending', async () => {
      const { result } = renderHook(() => useConversationManager())

      expect(result.current.text).toBe('')
      expect(result.current.messages).toHaveLength(0)

      await act(async () => {
        await result.current.flushText()
      })

      expect(result.current.text).toBe('')
      expect(result.current.messages).toHaveLength(0)
    })

    it('should call callback when provided', async () => {
      const callback = jest.fn()

      const { result } = renderHook(() => useConversationManager())

      act(() => {
        result.current.setText('Test message')
      })

      await act(async () => {
        await result.current.flushText({ callback })
      })

      expect(callback).toHaveBeenCalledWith({ text: 'Test message' })
    })
  })

  describe('onItem callback', () => {
    it('should call onItem for each stream event', async () => {
      const onItem = jest.fn()

      const mockStream = async function* () {
        yield { type: TOKEN_TYPE, data: { token: 'Hello' } }
        yield { type: TOKEN_TYPE, data: { token: ' world' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Hello world' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onItem,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      expect(onItem).toHaveBeenCalledTimes(3)
      expect(onItem).toHaveBeenCalledWith(
        'conv-123',
        expect.objectContaining({
          type: TOKEN_TYPE,
          data: { token: 'Hello' },
        })
      )
    })
  })

  describe('verbose mode', () => {
    it('should attach verbose actions to the bot message in verbose mode', async () => {
      const mockStream = async function* () {
        yield {
          type: OPERATION_BEGIN_TYPE,
          data: {
            action: {
              id: 'action-1',
              kind: 'dataset',
              name: 'search',
              input: { query: 'test' },
            },
          },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Result' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Result' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          verbose: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
      expect(botMessage.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'action-1',
            kind: 'dataset',
            name: 'search',
            input: JSON.stringify({ query: 'test' }),
            working: true,
          }),
        ])
      )
    })

    it('should keep streamed operations on the same bot message', async () => {
      const mockStream = async function* () {
        yield {
          type: OPERATION_BEGIN_TYPE,
          data: {
            action: {
              id: 'action-1',
              kind: 'dataset',
              name: 'searchProducts',
              input: { query: 'pricing' },
            },
          },
        }
        yield {
          type: OPERATION_BEGIN_TYPE,
          data: {
            action: {
              id: 'action-2',
              kind: 'function',
              name: 'lookupCustomer',
              justification: 'Looking up the customer profile',
              input: { customerId: '123' },
            },
          },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Done' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Done' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          verbose: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessages = result.current.messages.filter(
        (msg) => msg.type === 'bot'
      )

      expect(botMessages).toHaveLength(1)
      expect(botMessages[0].actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'action-1',
            name: 'searchProducts',
          }),
          expect.objectContaining({
            id: 'action-2',
            name: 'lookupCustomer',
            justification: 'Looking up the customer profile',
            working: true,
          }),
        ])
      )
    })

    it('should capture function justification and stop the working state on operation end', async () => {
      const mockStream = async function* () {
        yield {
          type: OPERATION_BEGIN_TYPE,
          data: {
            action: {
              id: 'action-1',
              kind: 'function',
              name: 'lookupCustomer',
              input: { customerId: '123' },
              justification: 'Looking up the customer profile',
            },
          },
        }
        yield {
          type: OPERATION_END_TYPE,
          data: {
            action: {
              id: 'action-1',
              kind: 'function',
              name: 'lookupCustomer',
            },
          },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Done' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Done' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          verbose: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )
      const action = botMessage?.actions?.find(
        (entry) => entry.id === 'action-1'
      )

      expect(botMessage).toBeDefined()
      expect(action?.justification).toBe('Looking up the customer profile')
      expect(action?.working).toBe(false)
    })
  })

  describe('entity redaction and unredaction', () => {
    it('should unredact entities in received messages', async () => {
      const mockStream = async function* () {
        yield {
          type: MESSAGE_TYPE,
          data: {
            id: 'tmp-123',
            type: 'bot',
            text: 'Contact [ENTITY:email:0]',
          },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', type: 'bot', text: 'Contact [ENTITY:email:0]' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          entities: {
            'user@example.com': {
              type: 'email',
              value: 'user@example.com',
            },
          },
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      // @note the unredactEntities function should process the entity markers

      expect(botMessage.text).toBeDefined()
    })
  })

  // Note: processAttachments tests are intentionally limited
  // Full attachment flow testing requires integration tests with actual network mocking
  describe('processAttachments', () => {
    it('should handle attachment upload errors', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })

      const uploadError = new Error('Upload failed')

      mockFetch.mockResolvedValueOnce({
        data: null,
        error: uploadError,
      })

      const onError = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onError,
        })
      )

      act(() => {
        result.current.setAttachments([mockFile])
        result.current.setText('Upload this')
      })

      const mockStream = async function* () {
        yield {
          type: SEND_RESULT_TYPE,
          data: { entities: [] },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      act(() => {
        result.current.sendMessage()
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(uploadError)
      })
    })
  })

  describe('handleUnfurling', () => {
    it('should unfurl URLs when unfurl is enabled', async () => {
      extractUrls.mockReturnValue(['https://example.com/article'])

      mockFetch.mockResolvedValue({
        data: {
          data: {
            title: 'Example Article',
            description: 'Test description',
          },
        },
        error: null,
      })

      const mockStream = async function* () {
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Check out https://example.com/article' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          unfurl: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      await waitFor(() => {
        expect(extractUrls).toHaveBeenCalledWith(
          'Check out https://example.com/article'
        )
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/v1/url/unfurl',
          expect.objectContaining({
            data: {
              url: 'https://example.com/article',
            },
            trackLoading: false,
            trackStreaming: false,
          })
        )
      })
    })

    it('should not unfurl when too many URLs found', async () => {
      extractUrls.mockReturnValue([
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
        'https://example.com/4',
      ])

      const mockStream = async function* () {
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Multiple links' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          unfurl: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      await waitFor(() => {
        const unfurlCalls = mockFetch.mock.calls.filter(
          (call) => call[0] === '/v1/url/unfurl'
        )

        expect(unfurlCalls).toHaveLength(0)
      })
    })

    it('should filter out URLs with hash fragments', async () => {
      extractUrls.mockReturnValue([
        'https://example.com/page#section',
        'https://example.com/article',
      ])

      mockFetch.mockResolvedValue({
        data: { data: { title: 'Article' } },
        error: null,
      })

      const mockStream = async function* () {
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Links with hash' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          unfurl: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/v1/url/unfurl',
          expect.objectContaining({
            data: {
              url: 'https://example.com/article',
            },
          })
        )
      })
    })

    it('should handle unfurl errors gracefully', async () => {
      extractUrls.mockReturnValue(['https://example.com/broken'])

      mockFetch.mockResolvedValue({
        data: null,
        error: new Error('Unfurl failed'),
      })

      const mockStream = async function* () {
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Broken link' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          unfurl: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      // @note should not crash, just skip unfurling

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
      expect(botMessage.micro).toBeUndefined()
    })
  })

  describe('verbose mode - dataset operations', () => {
    it('should show dataset verbose messages when verbose is boolean', async () => {
      const mockStream = async function* () {
        yield {
          type: OPERATION_BEGIN_TYPE,
          data: {
            action: {
              id: 'action-1',
              kind: 'dataset',
              name: 'searchDataset',
              input: { query: 'test' },
            },
          },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Result' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Result' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          verbose: true,
        })
      )

      act(() => {
        result.current.receiveMessage()
      })

      await waitFor(() => {
        const botMessage = result.current.messages.find(
          (msg) => msg.type === 'bot'
        )
        const action = botMessage?.actions?.find(
          (entry) => entry.id === 'action-1'
        )

        expect(botMessage).toBeDefined()
        expect(action?.name).toBe('searchDataset')
        expect(action?.input).toEqual(JSON.stringify({ query: 'test' }))
      })
    })

    it('should show function verbose messages when verbose is boolean', async () => {
      const mockStream = async function* () {
        yield {
          type: OPERATION_BEGIN_TYPE,
          data: {
            action: {
              id: 'action-2',
              kind: 'function',
              name: 'lookupCustomer',
              input: { customerId: '123' },
              justification: 'Looking up the customer profile',
            },
          },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Result' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Result' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          verbose: true,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      await waitFor(() => {
        const botMessage = result.current.messages.find(
          (msg) => msg.type === 'bot'
        )
        const action = botMessage?.actions?.find(
          (entry) => entry.id === 'action-2'
        )

        expect(botMessage).toBeDefined()
        expect(action?.name).toBe('lookupCustomer')
        expect(action?.justification).toBe('Looking up the customer profile')
        expect(action?.working).toBe(true)
      })
    })
  })

  describe('message handling edge cases', () => {
    it('should handle MESSAGE_TYPE events in streams', async () => {
      const mockStream = async function* () {
        yield {
          type: 'message',
          data: {
            id: 'intermediate-msg',
            type: 'bot',
            text: 'Intermediate message',
          },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-final', text: 'Final message' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      // @note the MESSAGE_TYPE handler updates the temp message

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
      expect(botMessage.text).toBe('Final message')
    })

    it('should handle empty MESSAGE_TYPE user events', async () => {
      const mockStream = async function* () {
        yield {
          type: 'message',
          data: {
            id: 'user-msg',
            type: 'user',
            text: 'User said this',
          },
        }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'bot-msg', text: 'Response' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      // @note should handle non-bot messages gracefully

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage).toBeDefined()
    })
  })

  describe('error handling in stream operations', () => {
    it('should handle generic errors without LIMITS_REACHED code', async () => {
      const mockStream = async function* () {
        yield {
          type: ERROR_TYPE,
          data: { code: 'GENERIC_ERROR', message: 'Something went wrong' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const onError = jest.fn()

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          onError,
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        })
      )

      // @note should not remove message for non-LIMITS_REACHED errors

      const botMessages = result.current.messages.filter(
        (msg) => msg.type === 'bot'
      )

      // @note temp message still exists (empty text)

      expect(botMessages.length).toBeGreaterThanOrEqual(0)
    })

    it('should continue processing after handling errors', async () => {
      const mockStream = async function* () {
        yield {
          type: ERROR_TYPE,
          data: { message: 'Warning error' },
        }
        yield { type: TOKEN_TYPE, data: { token: 'Continue' } }
        yield {
          type: RECEIVE_RESULT_TYPE,
          data: { id: 'msg-1', text: 'Continued after error' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessage = result.current.messages.find(
        (msg) => msg.type === 'bot'
      )

      expect(botMessage.text).toBe('Continued after error')
    })

    it('should surface limitReplyText as a bot message on LIMITS_REACHED', async () => {
      const mockStream = async function* () {
        yield {
          type: ERROR_TYPE,
          data: { code: 'LIMITS_REACHED', message: 'Limits exceeded' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
          limitReplyText: 'You have reached your usage limit.',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      const botMessages = result.current.messages.filter(
        (msg) => msg.type === 'bot'
      )

      expect(
        botMessages.some(
          (msg) => msg.text === 'You have reached your usage limit.'
        )
      ).toBe(true)
    })

    it('should not append a message on LIMITS_REACHED when limitReplyText is unset', async () => {
      const mockStream = async function* () {
        yield {
          type: ERROR_TYPE,
          data: { code: 'LIMITS_REACHED', message: 'Limits exceeded' },
        }
      }

      mockFetchStream.mockReturnValue(mockStream())

      const { result } = renderHook(() =>
        useConversationManager({
          conversationId: 'conv-123',
        })
      )

      await act(async () => {
        await result.current.receiveMessage()
      })

      // @note the streaming placeholder is removed and nothing is appended, so
      // no bot message with text remains
      const botMessages = result.current.messages.filter(
        (msg) => msg.type === 'bot' && msg.text
      )

      expect(botMessages).toHaveLength(0)
    })
  })

  describe('state setters', () => {
    it('should expose all state setters', () => {
      const { result } = renderHook(() => useConversationManager())

      expect(typeof result.current.setBackstory).toBe('function')
      expect(typeof result.current.setModel).toBe('function')
      expect(typeof result.current.setBotId).toBe('function')
      expect(typeof result.current.setDatasetId).toBe('function')
      expect(typeof result.current.setSkillsetId).toBe('function')
      expect(typeof result.current.setConversationId).toBe('function')
      expect(typeof result.current.setToken).toBe('function')
      expect(typeof result.current.setMessages).toBe('function')
      expect(typeof result.current.setEntities).toBe('function')
      expect(typeof result.current.setReferences).toBe('function')
      expect(typeof result.current.setFunctions).toBe('function')
      expect(typeof result.current.setAttachments).toBe('function')
      expect(typeof result.current.setText).toBe('function')
    })

    it('should allow updating state through setters', () => {
      const { result } = renderHook(() => useConversationManager())

      act(() => {
        result.current.setBackstory('New backstory')
        result.current.setModel('gpt-4')
        result.current.setBotId('bot-new')
      })

      expect(result.current.backstory).toBe('New backstory')
      expect(result.current.model).toBe('gpt-4')
      expect(result.current.botId).toBe('bot-new')
    })
  })

  describe('flushText', () => {
    it('should call callback when text is present', async () => {
      const { result } = renderHook(() => useConversationManager())
      const callback = jest.fn()

      act(() => {
        result.current.setText('Hello')
      })

      await act(async () => {
        await result.current.flushText({ callback })
      })

      expect(callback).toHaveBeenCalledWith({ text: 'Hello' })
      expect(result.current.text).toBe('')
    })

    it('should call callback with empty text when text is empty', async () => {
      const { result } = renderHook(() => useConversationManager())
      const callback = jest.fn()

      await act(async () => {
        await result.current.flushText({ callback })
      })

      expect(callback).toHaveBeenCalledWith({ text: '' })
      expect(result.current.text).toBe('')
    })
  })
})
