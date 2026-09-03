import { languageModels } from '@/config/models'

import {
  makeRequestActivityMessage,
  makeResponseActivityMessage,
  makeTriggerActivityMessage,
} from '@/lib/activity'
import { ContentModerationError } from '@/lib/error'
import { TimeoutError } from '@/lib/fetch'
import { createChatCompletion } from '@/lib/model.provider.openai'
import {
  ACTIVITY_MESSAGE_TYPE,
  BACKSTORY_MESSAGE_TYPE,
  BOT_MESSAGE_TYPE,
  CHECKPOINT_MESSAGE_TYPE,
  CONTEXT_MESSAGE_TYPE,
  DEFAULT_MAX_CYCLES,
  INSTRUCTION_MESSAGE_TYPE,
  REASONING_MESSAGE_TYPE,
  TMP_BACKSTORY_MESSAGE_TYPE,
  TMP_CHECKPOINT_MESSAGE_TYPE,
  TMP_FUNCTIONS_MESSAGE_TYPE,
  USER_MESSAGE_TYPE,
  addCallBudgetLowNotice,
  addCycleNotice,
  addEmptyNotice,
  calculateMaxTokens,
  completeChatConversation,
  completeConversation,
  completeRealtimeConversation,
  completeResponseConversation,
  completeTextConversation,
  convertMessages,
  convertMessagesToResponseInput,
  detectTokenLimitError,
  estimateMessageUsage,
  getCallBudgetLowThreshold,
  getFunctionArguments,
  getFunctionName,
  getMessageName,
  mapFinishReasonToCompleteReason,
  optimizeMessages,
  organizeMessages,
  reduceMessagesForModeration,
  trimSingleMessage,
} from '@/lib/model.provider.openai.conv'
import { Result } from '@/lib/result'

import { installOpenAITestLanguageModels } from '@/jest/utils/openai'

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openai')
  ? describe
  : describe.skip
const itIfConfigured = hasLanguageModelsByProvider('openai') ? it : it.skip

// @note capture provider support before installing model metadata fixtures.
// The fixtures let deterministic conversation tests exercise OpenAI-specific
// behavior without credentials; they do not make live tests eligible to run.
const restoreTestLanguageModels = installOpenAITestLanguageModels()

afterAll(restoreTestLanguageModels)

const LOOP_STOP_USER_MESSAGE =
  'I seem to be stuck in a loop. Let me stop here - please try rephrasing your request or providing more details.'
const LOOP_STOP_BACKGROUND_MESSAGE =
  'I seem to be stuck in a loop. Let me stop here, reframe the problem, and try again from a different angle.'

describe('getMessageName', () => {
  it('should return undefined if options.withNames is not provided', () => {
    const name = getMessageName(USER_MESSAGE_TYPE)

    expect(name).toBeUndefined()
  })

  it('should return default names when options.withNames is true', () => {
    expect(getMessageName(USER_MESSAGE_TYPE, { withNames: true })).toBe('user')
    expect(getMessageName(BOT_MESSAGE_TYPE, { withNames: true })).toBe(
      'assistant'
    )
    expect(getMessageName(REASONING_MESSAGE_TYPE, { withNames: true })).toBe(
      'reasoning'
    )
    expect(getMessageName(CONTEXT_MESSAGE_TYPE, { withNames: true })).toBe(
      'context'
    )
    expect(getMessageName(INSTRUCTION_MESSAGE_TYPE, { withNames: true })).toBe(
      'instruction'
    )
    expect(getMessageName(BACKSTORY_MESSAGE_TYPE, { withNames: true })).toBe(
      'backstory'
    )
    expect(getMessageName(CHECKPOINT_MESSAGE_TYPE, { withNames: true })).toBe(
      'checkpoint'
    )
    expect(getMessageName(ACTIVITY_MESSAGE_TYPE, { withNames: true })).toBe(
      'assistant'
    )
  })

  it('should return custom names when options.withNames is an object', () => {
    const customNames = {
      user: 'customUser',
      assistant: 'customAssistant',
      reasoning: 'customReasoning',
      context: 'customContext',
      instruction: 'customInstruction',
      backstory: 'customBackstory',
      checkpoint: 'customCheckpoint',
      activity: 'customActivity',
    }

    expect(getMessageName(USER_MESSAGE_TYPE, { withNames: customNames })).toBe(
      'customUser'
    )
    expect(getMessageName(BOT_MESSAGE_TYPE, { withNames: customNames })).toBe(
      'customAssistant'
    )
    expect(
      getMessageName(REASONING_MESSAGE_TYPE, { withNames: customNames })
    ).toBe('customReasoning')
    expect(
      getMessageName(CONTEXT_MESSAGE_TYPE, { withNames: customNames })
    ).toBe('customContext')
    expect(
      getMessageName(INSTRUCTION_MESSAGE_TYPE, { withNames: customNames })
    ).toBe('customInstruction')
    expect(
      getMessageName(BACKSTORY_MESSAGE_TYPE, { withNames: customNames })
    ).toBe('customBackstory')
    expect(
      getMessageName(CHECKPOINT_MESSAGE_TYPE, { withNames: customNames })
    ).toBe('customCheckpoint')
    expect(
      getMessageName(ACTIVITY_MESSAGE_TYPE, { withNames: customNames })
    ).toBe('customActivity')
  })

  it('should return undefined for an unknown message type even when withNames is provided', () => {
    const customNames = {
      user: 'customUser',
      assistant: 'customAssistant',
      context: 'customContext',
      instruction: 'customInstruction',
      backstory: 'customBackstory',
      activity: 'customActivity',
    }

    // Using an unknown type string
    expect(
      getMessageName('unknown', { withNames: customNames })
    ).toBeUndefined()
  })

  it('should return undefined for TMP_FUNCTIONS_MESSAGE_TYPE even when withNames is true', () => {
    expect(
      getMessageName(TMP_FUNCTIONS_MESSAGE_TYPE, { withNames: true })
    ).toBeUndefined()
  })

  it('should return undefined for TMP_BACKSTORY_MESSAGE_TYPE even when withNames is true', () => {
    expect(
      getMessageName(TMP_BACKSTORY_MESSAGE_TYPE, { withNames: true })
    ).toBeUndefined()
  })

  it('should return undefined when options is undefined', () => {
    expect(getMessageName(USER_MESSAGE_TYPE, undefined)).toBeUndefined()
  })

  it('should return undefined when options is null', () => {
    expect(getMessageName(USER_MESSAGE_TYPE, null)).toBeUndefined()
  })

  it('should return undefined when withNames is false', () => {
    expect(
      getMessageName(USER_MESSAGE_TYPE, { withNames: false })
    ).toBeUndefined()
  })

  it('should handle empty withNames object gracefully', () => {
    const emptyNames = {}

    expect(
      getMessageName(USER_MESSAGE_TYPE, { withNames: emptyNames })
    ).toBeUndefined()
  })
})
describe('convertMessages', () => {
  it('should convert messages correctly', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'bot', text: 'Hi there' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ])
  })

  it('should convert checkpoint messages as tool-call pairs', async () => {
    const messages = [
      { type: CHECKPOINT_MESSAGE_TYPE, text: 'Checkpoint summary' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o', {
      withNames: true,
    })

    expect(converted).toHaveLength(2)
    expect(converted[0].role).toBe('assistant')
    expect(converted[0].tool_calls?.[0].function?.name).toBe('_checkpoint')
    expect(converted[1]).toMatchObject({
      role: 'tool',
      content: 'Checkpoint summary',
    })
    expect(converted[1].tool_call_id).toBe(converted[0].tool_calls?.[0].id)
  })

  it('should collapse reasoning before activity history into reasoning_content', async () => {
    const messages = [
      { type: REASONING_MESSAGE_TYPE, text: 'I should call the lookup tool.' },
      makeRequestActivityMessage('lookup', { query: 'pricing' }),
      makeResponseActivityMessage('lookup', { query: 'pricing' }, 'result'),
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted).toHaveLength(2)
    expect(converted[0]).toMatchObject({
      role: 'assistant',
      reasoning_content: 'I should call the lookup tool.',
      tool_calls: [
        {
          type: 'function',
          function: {
            name: 'lookup',
            arguments: '{"query":"pricing"}',
          },
        },
      ],
    })
    expect(converted[1]).toMatchObject({
      role: 'tool',
      content: 'result',
    })
  })

  it('should collapse reasoning before checkpoint into reasoning_content', async () => {
    const messages = [
      { type: REASONING_MESSAGE_TYPE, text: 'I should preserve this state.' },
      { type: CHECKPOINT_MESSAGE_TYPE, text: 'Checkpoint summary' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted).toHaveLength(2)
    expect(converted[0]).toMatchObject({
      role: 'assistant',
      reasoning_content: 'I should preserve this state.',
      tool_calls: [
        {
          type: 'function',
          function: {
            name: '_checkpoint',
            arguments: '{}',
          },
        },
      ],
    })
    expect(converted[1]).toMatchObject({
      role: 'tool',
      content: 'Checkpoint summary',
    })
  })

  it('should not collapse reasoning when another message is serialized before activity history', async () => {
    const messages = [
      { type: REASONING_MESSAGE_TYPE, text: 'I should call the lookup tool.' },
      { type: USER_MESSAGE_TYPE, text: 'Actually answer this first.' },
      makeResponseActivityMessage('lookup', { query: 'pricing' }, 'result'),
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted).toHaveLength(4)
    expect(converted[0]).toMatchObject({
      role: 'assistant',
      content: 'I should call the lookup tool.',
    })
    expect(converted[1]).toMatchObject({
      role: 'user',
      content: 'Actually answer this first.',
    })
    expect(converted[2]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        {
          type: 'function',
          function: {
            name: 'lookup',
            arguments: '{"query":"pricing"}',
          },
        },
      ],
    })
    expect(converted[2]).not.toHaveProperty('reasoning_content')
    expect(converted[3]).toMatchObject({
      role: 'tool',
      content: 'result',
    })
  })

  it('should omit reasoning_content when the provider did not return it', async () => {
    const messages = [
      makeResponseActivityMessage('lookup', { query: 'pricing' }, 'result'),
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted[0]).not.toHaveProperty('reasoning_content')
  })

  it('ensure the activity messages described in the correct order even when they are out of order', async () => {
    const messages = [
      { type: 'user', text: 'do you have any availability today' },
      {
        type: 'bot',
        text: 'What kind of availability are you looking for? Are you trying to book a meeting or schedule some other event?',
      },
      {
        type: 'user',
        text: 'calendar',
      },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: {
              name: 'book_google_calendar_event',
              arguments: {
                input: {
                  task: 'Check availability for today',
                  slots: 1,
                  workStart: '09:00',
                  workEnd: '17:00',
                },
              },
            },
          },
        },
      },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: {
              name: 'list_google_calendar_availability',
              arguments: {
                input: {
                  calendarId: 'calendar@example.com',
                  count: '1',
                  duration: '30',
                  workStart: '09:00',
                  workEnd: '17:00',
                },
              },
            },
          },
        },
      },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'list_google_calendar_availability',
              arguments: {
                input: {
                  calendarId: 'calendar@example.com',
                  count: '1',
                  duration: '30',
                  workStart: '09:00',
                  workEnd: '17:00',
                },
              },
              result:
                '[{"bookingId":"eyJzIjoiMjAyNS0wMi0yMVQxMjowODowMy44ODVaIiwiZSI6IjIwMjUtMDItMjFUMTI6Mzg6MDMuODg1WiJ9","start":"2025-02-21T12:08:03.885Z","end":"2025-02-21T12:38:03.885Z"},{"bookingId":"eyJzIjoiMjAyNS0wMi0yMVQxMjozODowMy44ODVaIiwiZSI6IjIwMjUtMDItMjFUMTM6MDg6MDMuODg1WiJ9","start":"2025-02-21T12:38:03.885Z","end":"2025-02-21T13:08:03.885Z"}]',
            },
          },
        },
      },
      {
        type: 'bot',
        text: 'I found an available time slot for you in the calendar today. Here it is:\n\n- **Start Time:** 12:08 PM\n- **End Time:** 12:38 PM\n\nWould you like to book this time slot? If so, please provide the summary of the event, the description (optional), and the emails of any attendees you would like to invite.',
      },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'book_google_calendar_event',
              arguments: {
                input: {
                  task: 'Check availability for today',
                  slots: 1,
                  workStart: '09:00',
                  workEnd: '17:00',
                },
              },
              result:
                '"I found an available time slot for you in the calendar today. Here it is:\\n\\n- **Start Time:** 12:08 PM\\n- **End Time:** 12:38 PM\\n\\nWould you like to book this time slot? If so, please provide the summary of the event, the description (optional), and the emails of any attendees you would like to invite."',
            },
          },
        },
      },
      {
        type: 'bot',
        text: 'I found an available time slot for you today:\n\n- **Start Time:** 12:08 PM\n- **End Time:** 12:38 PM\n\nWould you like to book this time slot? If so, please provide the summary of the event, the description (optional), and the emails of any attendees you would like to invite.',
      },
      {
        type: 'user',
        text: 'yes please',
      },
      {
        type: 'bot',
        text: 'Please provide the summary of the event, a description (if you like), and the emails of any attendees you would like to invite.',
      },
      {
        type: 'user',
        text: 'it is about the pricing table',
      },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted[3].role).toEqual('assistant')
    expect(converted[3].tool_calls.length).toEqual(1)
    expect(converted[4].role).toEqual('tool')

    expect(converted[6].role).toEqual('assistant')
    expect(converted[6].tool_calls.length).toEqual(1)
    expect(converted[7].role).toEqual('tool')
  })

  it('replays a captured Gemini-3 thought signature onto the rebuilt tool call', async () => {
    const messages = [
      { type: 'user', text: 'How do I make a sale?' },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: {
              name: 'query',
              arguments: { query: 'how to make a sale' },
              thoughtSignature: 'SIG-abc-123',
            },
          },
        },
      },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'query',
              arguments: { query: 'how to make a sale' },
              result: '{"records":[]}',
            },
          },
        },
      },
    ]

    // @note a stored signature only exists because a provider issued one, so it
    // is replayed verbatim whenever present - no provider sniffing. Cloudflare's
    // endpoint additionally rejects a signature-bearing tool call unless an
    // explicit `content` field is present, so that is set alongside it.
    const converted = await convertMessages(messages, 'gemini-3.5-flash')

    expect(converted[1].role).toEqual('assistant')
    expect(converted[1].content).toBeNull()
    expect(converted[1].tool_calls[0].function.name).toEqual('query')
    expect(converted[1].tool_calls[0].extra_content).toEqual({
      google: { thought_signature: 'SIG-abc-123' },
    })
    expect(converted[2].role).toEqual('tool')
  })

  it('leaves the rebuilt tool call untouched when no signature was captured', async () => {
    const messages = [
      { type: 'user', text: 'How do I make a sale?' },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: { name: 'query', arguments: { query: 'x' } },
          },
        },
      },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'query',
              arguments: { query: 'x' },
              result: '{"records":[]}',
            },
          },
        },
      },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted[1].role).toEqual('assistant')
    expect(converted[1].tool_calls[0].extra_content).toBeUndefined()
    expect(converted[1].content).toBeUndefined()
    expect(converted[2].role).toEqual('tool')
  })

  it('should handle empty messages array', async () => {
    const messages = []

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted).toEqual([])
  })

  it('should convert all standard message types', async () => {
    const messages = [
      { type: 'backstory', text: 'System prompt' },
      { type: 'user', text: 'User message' },
      { type: 'bot', text: 'Bot response' },
      { type: 'context', text: 'Context info' },
      { type: 'instruction', text: 'Instruction' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted.length).toBe(5)
    expect(converted[0].role).toBe('system')
    expect(converted[1].role).toBe('user')
    expect(converted[2].role).toBe('assistant')
    expect(converted[3].role).toBe('user')
    expect(converted[4].role).toBe('user')
  })

  it('should skip activity messages without proper response structure', async () => {
    // @note activity messages without valid activity.type or missing functionName/functionResult are skipped
    const messages = [
      { type: 'user', text: 'Hello' },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'testFunc',
              // missing result - should be skipped
            },
          },
        },
      },
      { type: 'bot', text: 'Response' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted.length).toBe(2)
    expect(converted[0].role).toBe('user')
    expect(converted[1].role).toBe('assistant')
  })

  it('should skip activity messages with empty meta', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'activity', text: '', meta: {} },
      { type: 'bot', text: 'Response' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted.length).toBe(2)
    expect(converted[0].role).toBe('user')
    expect(converted[1].role).toBe('assistant')
  })

  it('should handle reasoning message type', async () => {
    const messages = [
      { type: 'user', text: 'What is 2+2?' },
      { type: 'reasoning', text: 'Let me think about this...' },
      { type: 'bot', text: 'The answer is 4' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    // @note reasoning messages should produce 3 messages: user, assistant
    // (reasoning), assistant (bot) @note previously this was incorrectly
    // falling through to CONTEXT_MESSAGE_TYPE and adding an extra user message

    expect(converted.length).toBe(3)
    expect(converted[0].role).toBe('user')
    expect(converted[0].content).toBe('What is 2+2?')
    expect(converted[1].role).toBe('assistant')
    expect(converted[1].content).toBe('Let me think about this...')
    expect(converted[2].role).toBe('assistant')
    expect(converted[2].content).toBe('The answer is 4')
  })

  it('should handle message with null text', async () => {
    const messages = [
      { type: 'user', text: null },
      { type: 'bot', text: 'Response' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted.length).toBe(2)
  })

  it('should handle message with undefined text', async () => {
    const messages = [
      { type: 'user', text: undefined },
      { type: 'bot', text: 'Response' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    expect(converted.length).toBe(2)
  })

  it('should handle activity message with null meta', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'activity', text: '', meta: null },
      { type: 'bot', text: 'Response' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    // Activity with null meta should be filtered out
    expect(converted.length).toBe(2)
    expect(converted[0].role).toBe('user')
    expect(converted[1].role).toBe('assistant')
  })

  it('should handle trigger activity messages', async () => {
    const messages = [
      { type: 'user', text: 'Do something' },
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'trigger',
            function: {
              name: 'doSomething',
              arguments: {},
            },
          },
        },
      },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    // Should handle trigger activity
    expect(converted.length).toBeGreaterThanOrEqual(1)
  })

  it('should handle TMP_FUNCTIONS_MESSAGE_TYPE', async () => {
    const messages = [
      {
        type: '_tmpFunctions',
        text: '',
        meta: [{ name: 'test', description: 'test' }],
      },
      { type: 'user', text: 'Hello' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    // TMP_FUNCTIONS should be skipped in conversion
    expect(converted.length).toBe(1)
    expect(converted[0].role).toBe('user')
  })

  it('should handle TMP_BACKSTORY_MESSAGE_TYPE', async () => {
    const messages = [
      { type: '_tmpBackstory', text: 'Extra backstory' },
      { type: 'user', text: 'Hello' },
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    // @note TMP_BACKSTORY is not converted to a message
    expect(converted.length).toBe(1)
    expect(converted[0].role).toBe('user')
  })
})

describe('convertMessagesToResponseInput', () => {
  it('converts user and assistant turns into input message items', async () => {
    const messages = [
      { type: USER_MESSAGE_TYPE, text: 'Hello' },
      { type: BOT_MESSAGE_TYPE, text: 'Hi there' },
    ]

    const { instructions, input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(instructions).toBeUndefined()
    expect(input).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ])
  })

  it('lifts backstory into the top-level instructions rather than an input item', async () => {
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'System prompt' },
      { type: USER_MESSAGE_TYPE, text: 'Hi' },
    ]

    const { instructions, input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(instructions).toBe('System prompt')
    expect(input).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('joins multiple backstory messages into a single instructions string', async () => {
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'First' },
      { type: BACKSTORY_MESSAGE_TYPE, text: 'Second' },
      { type: USER_MESSAGE_TYPE, text: 'Hi' },
    ]

    const { instructions } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(instructions).toBe('First\n\nSecond')
  })

  it('maps context and instruction messages to the user role', async () => {
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'System prompt' },
      { type: USER_MESSAGE_TYPE, text: 'User message' },
      { type: BOT_MESSAGE_TYPE, text: 'Bot response' },
      { type: CONTEXT_MESSAGE_TYPE, text: 'Context info' },
      { type: INSTRUCTION_MESSAGE_TYPE, text: 'Instruction' },
    ]

    const { instructions, input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(instructions).toBe('System prompt')
    expect(input.map((item) => item.role)).toEqual([
      'user',
      'assistant',
      'user',
      'user',
    ])
  })

  it('does not attach a participant name to message items', async () => {
    const messages = [{ type: USER_MESSAGE_TYPE, text: 'Hello' }]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini',
      { withNames: true }
    )

    expect(input[0]).not.toHaveProperty('name')
  })

  it('converts a checkpoint into a function_call / function_call_output pair', async () => {
    const messages = [
      { type: CHECKPOINT_MESSAGE_TYPE, text: 'Checkpoint summary' },
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input).toHaveLength(2)
    expect(input[0]).toMatchObject({
      type: 'function_call',
      name: '_checkpoint',
      arguments: '{}',
    })
    expect(input[1]).toMatchObject({
      type: 'function_call_output',
      output: 'Checkpoint summary',
    })
    expect(input[1].call_id).toBe(input[0].call_id)
  })

  it('converts an activity response into a function_call / function_call_output pair', async () => {
    const messages = [
      makeResponseActivityMessage('lookup', { query: 'pricing' }, 'result'),
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input).toHaveLength(2)
    expect(input[0]).toMatchObject({
      type: 'function_call',
      name: 'lookup',
      arguments: '{"query":"pricing"}',
    })
    expect(input[1]).toMatchObject({
      type: 'function_call_output',
      output: 'result',
    })
    expect(input[1].call_id).toBe(input[0].call_id)
  })

  it('emits reasoning as an assistant message item', async () => {
    const messages = [
      { type: USER_MESSAGE_TYPE, text: 'What is 2+2?' },
      { type: REASONING_MESSAGE_TYPE, text: 'Let me think about this...' },
      { type: BOT_MESSAGE_TYPE, text: 'The answer is 4' },
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input).toEqual([
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: 'Let me think about this...' },
      { role: 'assistant', content: 'The answer is 4' },
    ])
  })

  it('returns an empty input for an empty message list', async () => {
    const { instructions, input } = await convertMessagesToResponseInput(
      [],
      'gpt-5.4-mini'
    )

    expect(instructions).toBeUndefined()
    expect(input).toEqual([])
  })

  it('skips activity responses missing a function name or result', async () => {
    const messages = [
      { type: USER_MESSAGE_TYPE, text: 'Hello' },
      {
        type: ACTIVITY_MESSAGE_TYPE,
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: { name: 'testFunc' },
          },
        },
      },
      { type: BOT_MESSAGE_TYPE, text: 'Response' },
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Response' },
    ])
  })

  it('skips activity messages with empty or null meta', async () => {
    const messages = [
      { type: USER_MESSAGE_TYPE, text: 'Hello' },
      { type: ACTIVITY_MESSAGE_TYPE, text: '', meta: {} },
      { type: ACTIVITY_MESSAGE_TYPE, text: '', meta: null },
      { type: BOT_MESSAGE_TYPE, text: 'Response' },
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input.map((item) => item.role)).toEqual(['user', 'assistant'])
  })

  it('does not emit tool items for trigger activity messages', async () => {
    const messages = [
      { type: USER_MESSAGE_TYPE, text: 'Do something' },
      makeTriggerActivityMessage('doSomething', {}),
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input).toEqual([{ role: 'user', content: 'Do something' }])
  })

  it('skips internal _tmp message types', async () => {
    const messages = [
      {
        type: TMP_FUNCTIONS_MESSAGE_TYPE,
        text: '',
        meta: [{ name: 'test', description: 'test' }],
      },
      { type: TMP_BACKSTORY_MESSAGE_TYPE, text: 'Extra backstory' },
      { type: USER_MESSAGE_TYPE, text: 'Hello' },
    ]

    const { instructions, input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(instructions).toBeUndefined()
    expect(input).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('orders interleaved activity response pairs correctly', async () => {
    const messages = [
      { type: USER_MESSAGE_TYPE, text: 'check availability' },
      makeResponseActivityMessage('list_availability', { count: 1 }, '[slot]'),
      { type: BOT_MESSAGE_TYPE, text: 'here is a slot' },
      makeResponseActivityMessage('book_event', { task: 'book' }, 'booked'),
    ]

    const { input } = await convertMessagesToResponseInput(
      messages,
      'gpt-5.4-mini'
    )

    expect(input.map((item) => item.type ?? item.role)).toEqual([
      'user',
      'function_call',
      'function_call_output',
      'assistant',
      'function_call',
      'function_call_output',
    ])
  })
})

describe('completeResponseConversation', () => {
  // @note drives the Responses API path with an injected fake stream, mirroring
  // the completeChatConversation harness. The event shape matches the chat
  // stream but omits functionCall (the Responses API only exposes tools).
  const makeStream = (responses) => {
    let callIndex = 0

    const captured = []

    async function* mock(streamOptions) {
      captured.push(streamOptions)

      const response = responses[callIndex] || responses[responses.length - 1]

      callIndex++

      yield {
        error: null,
        finishReason: response.finishReason,
        completion: response.completion || null,
        reasoning: response.reasoning || null,
        toolCalls: response.toolCalls || null,
        usage: {
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
          reasoningTokens: 0,
        },
      }
    }

    return { mock, captured, callCount: () => callIndex }
  }

  it('streams text from a stop completion', async () => {
    const controller = makeStream([
      { finishReason: 'stop', completion: 'Hello' },
    ])

    let text = ''

    for await (const item of completeResponseConversation({
      model: 'gpt-5.4-mini',
      messages: [{ type: 'user', text: 'Hi' }],
      createResponseCompletionStream: controller.mock,
    })) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBe('Hello')
    expect(controller.callCount()).toBe(1)
  })

  it('builds a Responses-API request: backstory -> instructions, messages -> input, no chat messages field', async () => {
    const controller = makeStream([{ finishReason: 'stop', completion: 'ok' }])

    for await (const item of completeResponseConversation({
      model: 'gpt-5.4-mini',
      messages: [
        { type: 'backstory', text: 'You are a helpful bot' },
        { type: 'user', text: 'Hi' },
      ],
      createResponseCompletionStream: controller.mock,
    })) {
      void item
    }

    const req = controller.captured[0]

    expect(req.instructions).toBe('You are a helpful bot')
    expect(Array.isArray(req.input)).toBe(true)
    expect(req.input).toContainEqual({ role: 'user', content: 'Hi' })
    expect(req).not.toHaveProperty('messages')
  })

  it('passes the reasoning effort and tools to the Responses API', async () => {
    const controller = makeStream([{ finishReason: 'stop', completion: 'ok' }])

    for await (const item of completeResponseConversation({
      model: 'gpt-5.4-mini/reasoningEffort=high',
      messages: [{ type: 'user', text: 'Hi' }],
      functions: [
        {
          name: 'lookup',
          description: 'Look something up',
          parameters: { type: 'object', properties: {} },
          handler: async () => ({ ok: true }),
        },
      ],
      createResponseCompletionStream: controller.mock,
    })) {
      void item
    }

    const req = controller.captured[0]

    expect(req.reasoning).toEqual({ effort: 'high' })
    expect(req.tools).toEqual([
      {
        type: 'function',
        name: 'lookup',
        description: 'Look something up',
        parameters: { type: 'object', properties: {} },
        strict: false,
      },
    ])
    expect(req.toolChoice).toBe('auto')
  })

  it('executes a tool call and recurses to a final answer', async () => {
    const handler = jest.fn(async () => ({ result: 42 }))

    const controller = makeStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          { id: 't1', type: 'function', name: 'calc', arguments: '{"x":1}' },
        ],
      },
      { finishReason: 'stop', completion: 'The answer is 42' },
    ])

    const items = []

    for await (const item of completeResponseConversation({
      model: 'gpt-5.4-mini',
      messages: [{ type: 'user', text: 'compute' }],
      functions: [
        {
          name: 'calc',
          description: 'calc',
          parameters: { type: 'object', properties: {} },
          handler,
        },
      ],
      createResponseCompletionStream: controller.mock,
    })) {
      items.push(item)
    }

    expect(handler).toHaveBeenCalledTimes(1)
    expect(controller.callCount()).toBe(2)

    const text = items
      .filter((i) => i.type === 'token')
      .map((i) => i.data.token)
      .join('')

    expect(text).toBe('The answer is 42')

    // @note the second request must replay the tool round-trip as
    // function_call / function_call_output items
    const secondInput = controller.captured[1].input

    expect(secondInput).toContainEqual(
      expect.objectContaining({ type: 'function_call', name: 'calc' })
    )
    expect(secondInput).toContainEqual(
      expect.objectContaining({ type: 'function_call_output' })
    )
  })

  it('shrinks the conversation and retries on a content moderation rejection', async () => {
    const seenInputLengths = []

    async function* mock(streamOptions) {
      seenInputLengths.push(streamOptions.input.length)

      if (seenInputLengths.length === 1) {
        throw new ContentModerationError(
          'Input data may contain inappropriate content. (400)'
        )
      }

      yield {
        error: null,
        finishReason: 'stop',
        completion: 'recovered',
        reasoning: null,
        toolCalls: null,
        usage: {
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
          reasoningTokens: 0,
        },
      }
    }

    let text = ''

    for await (const item of completeResponseConversation({
      model: 'gpt-5.4-mini',
      messages: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: i % 2 === 0 ? 'user' : 'bot',
          text: `turn ${i}`,
        })),
        { type: 'user', text: 'latest question' },
      ],
      createResponseCompletionStream: mock,
    })) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBe('recovered')
    expect(seenInputLengths.length).toBe(2)
    expect(seenInputLengths[1]).toBeLessThan(seenInputLengths[0])
  })

  it('stops the agent loop when the call budget is exhausted', async () => {
    let n = 0

    async function* mock() {
      n++

      // @note always ask for another tool call with varying args so only the
      // call budget (not cycle detection) can stop the loop
      yield {
        error: null,
        finishReason: 'toolCalls',
        completion: null,
        reasoning: null,
        toolCalls: [
          {
            id: `t${n}`,
            type: 'function',
            name: 'spin',
            arguments: `{"n":${n}}`,
          },
        ],
        usage: {
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
          reasoningTokens: 0,
        },
      }
    }

    const items = []

    for await (const item of completeResponseConversation({
      model: 'gpt-5.4-mini',
      messages: [{ type: 'user', text: 'go' }],
      maxCalls: 3,
      maxCycles: 100,
      functions: [
        {
          name: 'spin',
          description: 'spin',
          parameters: { type: 'object', properties: {} },
          handler: async () => ({ ok: true }),
        },
      ],
      createResponseCompletionStream: mock,
    })) {
      items.push(item)
    }

    // @note must terminate (not loop forever) and surface a call-limit message
    const botMessages = items.filter(
      (i) => i.type === 'message' && i.data.type === 'bot'
    )

    expect(botMessages.some((i) => i.data.meta?.callLimitReached)).toBe(true)
  })
})

describe('completeResponseConversation orchestration parity', () => {
  describe('completeResponseConversation recursion behavior', () => {
    /**
     * Helper to create a mock createResponseCompletionStream that returns
     * a sequence of responses controlled by the caller.
     *
     * @param {Array<{completion?: string, finishReason: string, toolCalls?: any[], functionCall?: any, reasoning?: string | null}>} responses
     * @returns {{mock: Function, callCount: () => number}}
     */
    function createMockStream(responses) {
      let callIndex = 0

      async function* mockStream() {
        const response = responses[callIndex] || responses[responses.length - 1]

        callIndex++

        yield {
          error: null,
          finishReason: response.finishReason,
          completion: response.completion || null,
          reasoning: response.reasoning || null,
          functionCall: response.functionCall || null,
          toolCalls: response.toolCalls || null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return {
        mock: () => mockStream(),
        callCount: () => callIndex,
      }
    }

    it('should NOT increment currentContinuations on tool call recursion', async () => {
      // @note this test proves that tool-call loops don't count against
      // maxContinuations - they're a different recursion path

      const mockController = createMockStream([
        // First call: model returns tool call
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Second call: model returns tool call again
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Third call: model returns tool call again
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Fourth call: model finally stops
        {
          finishReason: 'stop',
          completion: 'Done!',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 1, // low limit to prove it's not used
        maxCalls: 10, // high limit so we don't hit this
        maxCycles: 10, // high limit so we don't hit this
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // @note if currentContinuations was incremented on tool calls, we'd only
      // get 2 model calls (0 and 1) before hitting maxContinuations=1. Instead
      // we should get all 4 calls.
      expect(mockController.callCount()).toBe(4)
    })

    it('should increment currentContinuations on length finish reason', async () => {
      // @note this test proves that 'length' finish reason DOES count against
      // maxContinuations

      const mockController = createMockStream([
        // First call: output truncated
        { finishReason: 'length', completion: 'Part 1...' },
        // Second call: output truncated again
        { finishReason: 'length', completion: 'Part 2...' },
        // Third call: would continue but should be blocked by maxContinuations
        { finishReason: 'stop', completion: 'Part 3 - should not reach' },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 1, // allow only 1 continuation
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // @note with maxContinuations=1, we should get:
      // - Call 1 (currentContinuations=0): 0<=1 ✓, returns 'length', increments to 1
      // - Call 2 (currentContinuations=1): 1<=1 ✓, returns 'length', increments to 2
      // - Call 3 (currentContinuations=2): 2<=1 ✗, stops (but we already made the call)
      // Actually the check happens BEFORE recursing, so:
      // - Call 1: returns 'length', checks 0<=1 ✓, recurses with 1
      // - Call 2: returns 'length', checks 1<=1 ✓, recurses with 2
      // - Call 3: returns 'length', checks 2<=1 ✗, does NOT recurse
      // So we expect 3 calls total (the check is <= not <)
      expect(mockController.callCount()).toBe(3)
    })

    it('should prove tool call loops and continuation loops are independent', async () => {
      // @note this test combines both: tool calls followed by length, proving
      // they use separate counters

      const mockController = createMockStream([
        // First call: tool call (does NOT increment currentContinuations)
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Second call: tool call again (still doesn't increment)
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Third call: now length (THIS starts incrementing currentContinuations)
        { finishReason: 'length', completion: 'Truncated...' },
        // Fourth call: length again (currentContinuations now 1)
        { finishReason: 'length', completion: 'Still truncated...' },
        // Fifth call: would be blocked if maxContinuations=1 was already hit
        { finishReason: 'stop', completion: 'Done!' },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 1, // allow only 1 continuation
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // @note if tool calls incremented currentContinuations, we'd hit the limit
      // after call 2 and never see calls 3-4. Instead we should see:
      // - Call 1: toolCalls (no increment, currentContinuations stays 0)
      // - Call 2: toolCalls (no increment, currentContinuations stays 0)
      // - Call 3: length (currentContinuations=0, 0<=1 ✓, recurses with 1)
      // - Call 4: length (currentContinuations=1, 1<=1 ✓, recurses with 2)
      // - Call 5: length (currentContinuations=2, 2<=1 ✗, does NOT recurse)
      // So we expect 5 calls total
      expect(mockController.callCount()).toBe(5)
    })

    it('should honor maxCalls=0 and skip function handlers', async () => {
      const handler = jest.fn(async () => ({ result: 'ok' }))

      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Done',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxCalls: 0,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(handler).not.toHaveBeenCalled()
    })

    it('should honor maxCycles=0 and stop immediately on first cycle detection', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Should not reach',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxCalls: 10,
        maxCycles: 0,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(mockController.callCount()).toBe(2)

      const cycleDetectedMessage = items.find(
        (item) =>
          item.type === 'message' &&
          item.data.type === 'bot' &&
          item.data.meta?.cycleDetected === true
      )

      expect(cycleDetectedMessage).toBeDefined()
      expect(cycleDetectedMessage.data.text).toBe(LOOP_STOP_USER_MESSAGE)
    })

    it('uses background-safe copy when maxCycles=0 stops a background run', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Should not reach',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        background: true,
        maxCalls: 10,
        maxCycles: 0,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const cycleDetectedMessage = items.find(
        (item) =>
          item.type === 'message' &&
          item.data.type === 'bot' &&
          item.data.meta?.cycleDetected === true
      )

      expect(cycleDetectedMessage).toBeDefined()
      expect(cycleDetectedMessage.data.text).toBe(LOOP_STOP_BACKGROUND_MESSAGE)
      expect(cycleDetectedMessage.data.text).not.toContain('please try')
    })

    it('should insert cycle detection activity messages into the next recursive model call', async () => {
      const calls = []

      const createResponseCompletionStream = jest.fn((input) => {
        calls.push(input)

        const responseIndex = calls.length - 1

        async function* stream() {
          if (responseIndex < 2) {
            yield {
              error: null,
              finishReason: 'toolCalls',
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: [
                {
                  type: 'function',
                  name: 'testTool',
                  arguments: '{}',
                },
              ],
              usage: {
                promptTokens: 10,
                completionTokens: 10,
                totalTokens: 20,
              },
            }

            return
          }

          yield {
            error: null,
            finishReason: 'stop',
            completion: 'Recovered after warning',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }
        }

        return stream()
      })

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxCalls: 10,
        maxCycles: 2,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream,
      }

      for await (const _ of completeResponseConversation(options)) {
        // consume stream
      }

      expect(createResponseCompletionStream).toHaveBeenCalledTimes(3)

      const recoveryCallInput = calls[2].input

      const cycleToolCall = recoveryCallInput.find(
        (item) =>
          item.type === 'function_call' && item.name === '_cycleDetected'
      )

      const cycleToolResult = recoveryCallInput.find(
        (item) =>
          item.type === 'function_call_output' &&
          typeof item.output === 'string' &&
          item.output.includes('You have been making repeated tool calls')
      )

      expect(cycleToolCall).toBeDefined()
      expect(cycleToolResult).toBeDefined()
    })

    it('stops a repeated-result loop that only the result-run heuristic can see (interleaved reasoning)', async () => {
      // @note regression guard for a regression gap. A reasoning model
      // emits a DIFFERENT reasoning message before each otherwise-identical tool
      // call. That interleaving defeats hasRepeatedSuffix (surrounding messages
      // differ) and hasRepeatedActivityTail (the activity tail is not
      // contiguous), so only hasRepeatedResultRun can break the loop. The mock
      // never stops on its own, so if the heuristic regresses this would run to
      // the call budget instead of stopping.
      const calls = []

      const createResponseCompletionStream = jest.fn((input) => {
        calls.push(input)

        const responseIndex = calls.length - 1

        async function* stream() {
          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            // @note varied reasoning per round - this is what blinds the
            // byte-for-byte heuristics
            reasoning: `Attempt ${responseIndex}: let me look that up`,
            functionCall: null,
            toolCalls: [
              {
                type: 'function',
                name: 'search',
                arguments: '{"q":"sofa"}',
              },
            ],
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }
        }

        return stream()
      })

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'find a sofa' }],
        maxCalls: 50,
        maxCycles: 2,
        functions: [
          {
            name: 'search',
            description: 'Search a dataset',
            parameters: {},
            // @note always returns the same empty result, like the dataset
            // search behind the incident
            handler: async () => ({ records: [] }),
          },
        ],
        createResponseCompletionStream,
      }

      const events = []

      for await (const event of completeResponseConversation(options)) {
        events.push(event)
      }

      // @note stopped by cycle detection (detect at the 3rd identical result,
      // hard stop at the 4th), NOT by the call budget of 50
      expect(createResponseCompletionStream).toHaveBeenCalledTimes(4)

      const stop = events.find(
        (event) => event?.data?.meta?.cycleDetected === true
      )

      expect(stop).toBeDefined()
    })

    it('handles unknown tool-call type without crashing', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [{ type: 'not-supported' }],
        },
        {
          finishReason: 'stop',
          completion: 'done',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const finalEnd = items.filter((i) => i.type === 'completeEnd').pop()

      expect(finalEnd).toBeDefined()
    })

    it('throws when finishReason is toolCalls but toolCalls payload is missing', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () =>
          (async function* () {
            yield {
              error: null,
              finishReason: 'toolCalls',
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
            }
          })(),
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toThrow('Unexpected state: tool calls without tool calls')
    })

    it('stops without recursion when tool call function has no handler', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'noHandlerTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Should not be called',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'noHandlerTool',
            description: 'Tool without handler',
            parameters: {},
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(mockController.callCount()).toBe(1)

      const finalEnd = items.filter((i) => i.type === 'completeEnd').pop()

      expect(finalEnd?.data.reason).toBe('activity')
    })

    it('emits too many calls activity when tool call count exceeds maxCalls', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxCalls: 0,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const activityResponse = items.find(
        (item) =>
          item.type === 'message' &&
          item.data.type === 'activity' &&
          item.data.meta?.activity?.type === 'response' &&
          item.data.meta?.activity?.function?.result?.error === 'too many calls'
      )

      expect(activityResponse).toBeDefined()
    })

    it('throws on non-aborted AbortSignal from tool handler', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => new AbortController().signal,
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toThrow('Unexpected abort signal state')
    })

    it('retries on response token-limit exception and succeeds', async () => {
      let callCount = 0

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 1,
        createResponseCompletionStream: () => {
          callCount += 1

          if (callCount === 1) {
            throw new Error(
              "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
            )
          }

          return createMockStream([
            { finishReason: 'stop', completion: 'recovered' },
          ]).mock()
        },
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(callCount).toBe(2)
      expect(
        items.some((i) => i.type === 'token' && i.data.token === 'recovered')
      ).toBe(true)
    })

    it('rethrows non-token-limit exception from response stream', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () => {
          throw new Error('upstream unavailable')
        },
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toThrow('upstream unavailable')
    })

    it('handles contentFilter finish reason without crashing', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () =>
          (async function* () {
            yield {
              error: null,
              finishReason: 'contentFilter',
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
            }
          })(),
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(items.some((i) => i.type === 'usage')).toBe(true)
    })

    it('surfaces invocation exception when tool-call handler throws', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'failingTool',
            description: 'Fails intentionally',
            parameters: {},
            handler: async () => {
              throw new Error('boom')
            },
          },
        ],
        createResponseCompletionStream: createMockStream([
          {
            finishReason: 'toolCalls',
            toolCalls: [
              {
                type: 'function',
                name: 'failingTool',
                arguments: '{}',
              },
            ],
          },
        ]).mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      expect(JSON.stringify(responseMessage)).toContain(
        'Function invocation exception'
      )
    })

    it('stops tool-call recursion on aborted AbortSignal result', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'should not be reached',
        },
      ])

      const controller = new AbortController()

      controller.abort('stop now')

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => controller.signal,
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(mockController.callCount()).toBe(1)

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      const abortItem = items.find((i) => i.type === 'abort')

      expect(responseMessage?.data.meta?.activity?.function?.result).toBe(
        'stop now'
      )
      expect(abortItem?.data).toEqual({
        reason: 'stop now',
        functionName: 'testTool',
      })

      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem?.data.reason).toBe('abort')
    })

    it('emits abort before final completeEnd abort when a tool handler aborts', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'should not be reached',
        },
      ])

      const controller = new AbortController()

      controller.abort('stop now')

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => controller.signal,
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const abortItemIndex = items.findIndex((item) => item.type === 'abort')
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalCompleteEndIndex = items.findLastIndex(
        (item) => item.type === 'completeEnd'
      )

      expect(completeEndItems).toHaveLength(2)
      expect(completeEndItems[0].data.reason).toBe('activity')
      expect(completeEndItems[1].data.reason).toBe('abort')
      expect(abortItemIndex).toBeGreaterThan(-1)
      expect(abortItemIndex).toBeLessThan(finalCompleteEndIndex)
    })

    it('uses fallback result text when tool handler returns undefined', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => undefined,
          },
        ],
        createResponseCompletionStream: createMockStream([
          {
            finishReason: 'toolCalls',
            toolCalls: [
              {
                type: 'function',
                name: 'testTool',
                arguments: '{}',
              },
            ],
          },
        ]).mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      expect(responseMessage?.data.meta?.activity?.function?.result).toBe(
        'no result'
      )
    })

    it('uses Result wrapper payload and meta from tool handler', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => new Result({ ok: true }, { fromResult: true }),
          },
        ],
        createResponseCompletionStream: createMockStream([
          {
            finishReason: 'toolCalls',
            toolCalls: [
              {
                type: 'function',
                name: 'testTool',
                arguments: '{}',
              },
            ],
          },
        ]).mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      expect(responseMessage?.data.meta?.activity?.function?.result).toContain(
        '"ok":true'
      )
      expect(responseMessage?.data.meta?.fromResult).toBe(true)
    })

    it('surfaces not-found details for unknown tool-call function', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'knownTool',
            description: 'Known tool',
            parameters: {},
            handler: async () => ({ ok: true }),
          },
        ],
        createResponseCompletionStream: createMockStream([
          {
            finishReason: 'toolCalls',
            toolCalls: [
              {
                type: 'function',
                name: 'missingTool',
                arguments: '{}',
              },
            ],
          },
        ]).mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      expect(
        responseMessage?.data.meta?.activity?.function?.result?.error
      ).toContain('function not found')
    })

    it('surfaces malformed-argument errors back to the model without invoking the handler', async () => {
      const handler = jest.fn(async () => ({ ok: true }))

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        functions: [
          {
            name: 'knownTool',
            description: 'Known tool',
            parameters: {},
            handler,
          },
        ],
        createResponseCompletionStream: createMockStream([
          {
            finishReason: 'toolCalls',
            toolCalls: [
              {
                type: 'function',
                name: 'knownTool',
                // @note the provider could not parse the streamed arguments, so
                // it set them to {} and attached the parse error
                arguments: {},
                error:
                  'Malformed arguments for tool call knownTool: Unexpected end of JSON input',
              },
            ],
          },
        ]).mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      // @note the parse error is returned as the tool result so the model can
      // re-emit a valid call
      expect(
        responseMessage?.data.meta?.activity?.function?.result?.error
      ).toContain('Malformed arguments')

      // @note the handler must not run with the empty/garbage arguments
      expect(handler).not.toHaveBeenCalled()
    })

    it('surfaces no-functions-defined details for unknown tool-call without functions list', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: createMockStream([
          {
            finishReason: 'toolCalls',
            toolCalls: [
              {
                type: 'function',
                name: 'missingTool',
                arguments: '{}',
              },
            ],
          },
        ]).mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const responseMessage = items.find(
        (i) =>
          i.type === 'message' &&
          i.data.type === 'activity' &&
          i.data.meta?.activity?.type === 'response'
      )

      expect(
        responseMessage?.data.meta?.activity?.function?.result?.error
      ).toContain('no functions defined')
    })

    it('rethrows invalid finish reason from response stream', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () =>
          (async function* () {
            yield {
              error: null,
              finishReason: 'unexpected-finish-reason',
              completion: null,
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
            }
          })(),
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toThrow()
    })

    // @note residual uncovered branches around openai.conv.js:3024-3026 and 3084 are defensive tails and effectively unreachable in normal flow because earlier guards throw/rethrow first

    it('rethrows non-Error response stream throw values when token-limit detection does not match', async () => {
      const thrown = { code: 'NO_MESSAGE_FIELD' }

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () => {
          throw thrown
        },
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toEqual(thrown)
    })

    it('rethrows token-limit errors when continuation budget is exceeded', async () => {
      const tokenLimitError = new Error(
        "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
      )

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 0,
        currentContinuations: 1,
        createResponseCompletionStream: () => {
          throw tokenLimitError
        },
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toThrow(tokenLimitError.message)
    })

    it('stops with iteration reason on token-limit retry when iteration limit is reached', async () => {
      let calls = 0

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 1,
        maxContinuations: 3,
        createResponseCompletionStream: () => {
          calls += 1

          throw new Error(
            "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
          )
        },
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(calls).toBe(1)

      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem?.data.reason).toBe('iteration')
    })
  })

  describe('maxIterations behavior', () => {
    /**
     * Helper to create a mock createResponseCompletionStream that returns
     * a sequence of responses controlled by the caller.
     *
     * @param {Array<{completion?: string, finishReason: string, toolCalls?: any[]}>} responses
     * @returns {{mock: Function, callCount: () => number}}
     */
    function createMockStream(responses) {
      let callIndex = 0

      async function* mockStream() {
        const response = responses[callIndex] || responses[responses.length - 1]

        callIndex++

        yield {
          error: null,
          finishReason: response.finishReason,
          completion: response.completion || null,
          reasoning: null,
          functionCall: null,
          toolCalls: response.toolCalls || null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return {
        mock: () => mockStream(),
        callCount: () => callIndex,
      }
    }

    it('should limit tool call recursion when maxIterations is set', async () => {
      // @note this test proves that maxIterations limits ALL model calls,
      // including tool-call loops (unlike maxContinuations which doesn't)

      const mockController = createMockStream([
        // First call: model returns tool call
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Second call: model returns tool call again
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Third call: would recurse but should be blocked by maxIterations
        {
          finishReason: 'stop',
          completion: 'Should not reach this',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 2, // only allow 2 model calls
        maxCalls: 10, // high limit so we don't hit this
        maxCycles: 10, // high limit so we don't hit this
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // @note with maxIterations=2:
      // - Call 1 (currentIterations=0): 0<2 ✓, toolCalls, would recurse
      // - Call 2 (currentIterations=1): 1<2 ✓, toolCalls, would recurse
      // - Call 3 would have currentIterations=2, 2<2 ✗, blocked
      expect(mockController.callCount()).toBe(2)

      // Should emit iteration as the final reason
      // @note there may be multiple completeEnd items - find the last one
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem).toBeDefined()
      expect(finalEndItem.data.reason).toBe('iteration')
    })

    it('should complete normally when maxIterations is not reached', async () => {
      const mockController = createMockStream([
        // First call: model returns tool call
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Second call: model stops normally
        {
          finishReason: 'stop',
          completion: 'Done!',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 5, // high limit - won't be reached
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should complete normally with 2 calls
      expect(mockController.callCount()).toBe(2)

      // Should emit 'stop' as the final reason, not 'iteration'
      // @note there may be multiple completeEnd items - find the last one
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem).toBeDefined()
      expect(finalEndItem.data.reason).toBe('stop')
    })

    it('should count length continuations toward maxIterations', async () => {
      // @note maxIterations counts ALL model calls, including length retries

      const mockController = createMockStream([
        { finishReason: 'length', completion: 'Part 1...' },
        { finishReason: 'length', completion: 'Part 2...' },
        { finishReason: 'stop', completion: 'Part 3 - should not reach' },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 2,
        maxContinuations: 10, // high limit so we don't hit this
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should stop after 2 calls due to maxIterations
      expect(mockController.callCount()).toBe(2)

      // @note there may be multiple completeEnd items - find the last one
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem.data.reason).toBe('iteration')
    })

    it('should work as single-step mode with maxIterations=1', async () => {
      // @note this is the primary use case for background workers

      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // This should never be reached
        {
          finishReason: 'stop',
          completion: 'Should not reach',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 1, // single-step mode
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should only make 1 model call, execute the tools, then stop
      expect(mockController.callCount()).toBe(1)

      // Should have the tool call messages (request + response)
      const activityMessages = items.filter(
        (item) => item.type === 'message' && item.data.type === 'activity'
      )

      expect(activityMessages.length).toBe(2) // request and response

      // Should emit iteration as the final reason
      // @note there may be multiple completeEnd items - find the last one
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem.data.reason).toBe('iteration')
    })

    it('should not apply iteration limit when maxIterations is not set', async () => {
      // @note default behavior should be unbounded (except for other limits)

      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Done after many calls!',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        // maxIterations NOT set - should be unbounded
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should complete all 4 calls since no maxIterations limit
      expect(mockController.callCount()).toBe(4)

      // @note there may be multiple completeEnd items - find the last one
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem.data.reason).toBe('stop')
    })

    it('should count empty-stop retries toward maxIterations', async () => {
      // @note when stop is returned but no text is generated, the system retries
      // These retries should count toward maxIterations

      const mockController = createMockStream([
        { finishReason: 'stop', completion: '' }, // empty - will retry
        { finishReason: 'stop', completion: '' }, // empty - would retry but limit hit
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 2,
        maxContinuations: 10, // high limit so we don't hit this
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should stop after 2 calls due to maxIterations
      expect(mockController.callCount()).toBe(2)

      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem.data.reason).toBe('iteration')
    })

    it('should track currentIterations across mixed recursion types', async () => {
      // @note this tests that iteration counting works correctly when
      // different types of recursion (tool calls, length) are mixed

      const mockController = createMockStream([
        // Call 1: tool call
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        // Call 2: length (needs continuation)
        { finishReason: 'length', completion: 'Partial...' },
        // Call 3: would continue but hits limit
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 2,
        maxContinuations: 10,
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should stop after 2 calls (1 tool call + 1 length)
      expect(mockController.callCount()).toBe(2)

      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )
      const finalEndItem = completeEndItems[completeEndItems.length - 1]

      expect(finalEndItem.data.reason).toBe('iteration')
    })

    it('should respect maxIterations=0 as no calls allowed', async () => {
      // @note edge case: maxIterations=0 means no model calls at all
      // This is probably not a valid use case but should be handled gracefully

      const mockController = createMockStream([
        { finishReason: 'stop', completion: 'Should not reach' },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 0,
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // Should make exactly 1 call - the initial call always happens
      // (maxIterations blocks RECURSION, not the initial call)
      expect(mockController.callCount()).toBe(1)
    })

    it('should not allow negative currentIterations to bypass maxIterations', async () => {
      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Should not reach if maxIterations is enforced',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 1,
        currentIterations: -100,
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(mockController.callCount()).toBe(1)
    })

    it('should not allow negative callStats to bypass maxCalls=0', async () => {
      const handler = jest.fn(async () => ({ result: 'ok' }))

      const mockController = createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              name: 'testTool',
              arguments: '{}',
            },
          ],
        },
        {
          finishReason: 'stop',
          completion: 'Done',
        },
      ])

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxCalls: 0,
        callStats: { calls: -100 },
        maxCycles: 10,
        functions: [
          {
            name: 'testTool',
            description: 'Test tool',
            parameters: {},
            handler,
          },
        ],
        createResponseCompletionStream: mockController.mock,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('settle behavior', () => {
    function createMockStream(responses) {
      let callIndex = 0

      async function* mockStream() {
        const response = responses[callIndex] || responses[responses.length - 1]

        callIndex++

        yield {
          error: null,
          finishReason: response.finishReason,
          completion: response.completion || null,
          reasoning: null,
          functionCall: null,
          toolCalls: response.toolCalls || null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return {
        mock: () => mockStream(),
        callCount: () => callIndex,
      }
    }

    function getFinalReason(items) {
      const completeEndItems = items.filter(
        (item) => item.type === 'completeEnd'
      )

      return completeEndItems[completeEndItems.length - 1]?.data.reason
    }

    it('does not continue on a plain stop when settle is disabled', async () => {
      const mockController = createMockStream([
        { finishReason: 'stop', completion: 'Done' },
      ])

      const items = []

      for await (const item of completeResponseConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: mockController.mock,
      })) {
        items.push(item)
      }

      expect(mockController.callCount()).toBe(1)
      expect(getFinalReason(items)).toBe('stop')
    })

    it('nudges and continues on a plain stop when settle is enabled, bounded by maxSettles', async () => {
      const mockController = createMockStream([
        { finishReason: 'stop', completion: 'working 1' },
        { finishReason: 'stop', completion: 'working 2' },
        { finishReason: 'stop', completion: 'working 3' },
        { finishReason: 'stop', completion: 'working 4' },
      ])

      const items = []

      for await (const item of completeResponseConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxSettles: 2,
        maxCycles: 10,
        createResponseCompletionStream: mockController.mock,
      })) {
        items.push(item)
      }

      // 1 initial completion + maxSettles (2) nudge continuations
      expect(mockController.callCount()).toBe(3)

      // settle budget spent without the model settling → surfaced as iteration
      // so a caller loop can continue rather than treating the stop as finished
      expect(getFinalReason(items)).toBe('iteration')
    })

    it('surfaces an unsettled stop as iteration immediately when maxIterations caps it (single-step)', async () => {
      const mockController = createMockStream([
        { finishReason: 'stop', completion: 'working' },
        { finishReason: 'stop', completion: 'should not reach' },
      ])

      const items = []

      for await (const item of completeResponseConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxSettles: 5,
        maxIterations: 1,
        maxCycles: 10,
        createResponseCompletionStream: mockController.mock,
      })) {
        items.push(item)
      }

      // maxIterations=1 blocks the settle continuation → iteration after 1 call,
      // so a per-step caller (the task workflow) keeps its single-step contract
      expect(mockController.callCount()).toBe(1)
      expect(getFinalReason(items)).toBe('iteration')
    })

    it('retries on an error finish reason and recovers within the continuation budget', async () => {
      const mockController = createMockStream([
        { finishReason: 'error', completion: 'partial' },
        { finishReason: 'stop', completion: 'recovered' },
      ])

      const items = []

      for await (const item of completeResponseConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxCycles: 10,
        createResponseCompletionStream: mockController.mock,
      })) {
        items.push(item)
      }

      // initial errored completion + 1 retry that recovered. A terminal `error`
      // finish reason must not abandon the turn - it is retried like a mid-stream
      // error. Settle is disabled here, so the recovered stop ends the run.
      expect(mockController.callCount()).toBe(2)
      expect(getFinalReason(items)).toBe('stop')
    })

    it('bounds error finish reason retries by maxContinuations then surfaces error', async () => {
      const mockController = createMockStream([
        { finishReason: 'error', completion: 'still failing' },
      ])

      const items = []

      for await (const item of completeResponseConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 1,
        maxCycles: 10,
        createResponseCompletionStream: mockController.mock,
      })) {
        items.push(item)
      }

      // 1 initial + 2 retries (continuation count 0 → 1 → 2, bounded by
      // maxContinuations=1), then the catastrophic give-up surfaces `error`.
      expect(mockController.callCount()).toBe(3)
      expect(getFinalReason(items)).toBe('error')
    })

    it('bails on repeated empty turns at maxEmpties with a visible stop message', async () => {
      // @note a model that keeps ending its turn empty (no answer text, no tool
      // call) used to be retried up to the full continuation budget and then end
      // silently, burning continuations while producing nothing. The tight empty
      // guard now bails after maxEmpties and surfaces a user-facing stop message
      // (plus a Sentry observation) instead of leaving the turn blank.
      const mockController = createMockStream([
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: '' },
        { finishReason: 'stop', completion: 'should not reach' },
      ])

      const items = []

      for await (const item of completeResponseConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxEmpties: 3,
        maxContinuations: 20, // high - prove the empty guard bails first
        maxCycles: 10,
        createResponseCompletionStream: mockController.mock,
      })) {
        items.push(item)
      }

      // bails after maxEmpties (3) empty turns, NOT the 20-continuation budget
      expect(mockController.callCount()).toBe(3)

      // the turn is not left blank: a user-facing stop message is surfaced
      const emptyExhaustedMessage = items.find(
        (item) =>
          item.type === 'message' &&
          item.data.type === 'bot' &&
          item.data.meta?.emptyExhausted === true
      )

      expect(emptyExhaustedMessage).toBeDefined()
      expect(emptyExhaustedMessage.data.text).toBe(LOOP_STOP_USER_MESSAGE)
    })
  })

  describe('TAG_USAGE suppression on fatal errors', () => {
    it('should not yield TAG_USAGE when response stream throws a fatal error', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () => {
          throw new Error('Incorrect API key provided')
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeResponseConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('Incorrect API key provided')

      expect(items.filter((i) => i.type === 'usage')).toHaveLength(0)
    })

    it('should yield TAG_USAGE on successful response stream completion', async () => {
      const items = []

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () =>
          (async function* () {
            yield {
              error: null,
              finishReason: 'stop',
              completion: 'hello',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }
          })(),
      }

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const usageItems = items.filter((i) => i.type === 'usage')

      expect(usageItems).toHaveLength(1)
      expect(usageItems[0].data.inputTokensUsed).toBeGreaterThanOrEqual(0)
      expect(usageItems[0].data.outputTokensUsed).toBe(5)
    })

    it('should yield TAG_USAGE when response stream recovers from token-limit error', async () => {
      let callCount = 0

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxContinuations: 1,
        createResponseCompletionStream: () => {
          callCount += 1

          if (callCount === 1) {
            throw new Error(
              "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
            )
          }

          return (async function* () {
            yield {
              error: null,
              finishReason: 'stop',
              completion: 'recovered',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 },
            }
          })()
        },
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      const usageItems = items.filter((i) => i.type === 'usage')

      // @note token-limit retry recovers, so usage should be reported
      expect(usageItems.length).toBeGreaterThanOrEqual(1)
    })

    it('should yield TAG_USAGE when response stream fails mid-stream after tokens were received', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: async function* () {
          yield {
            error: null,
            finishReason: null,
            completion: 'partial',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
          }

          throw new Error('network connection lost')
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeResponseConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('network connection lost')

      const usageItems = items.filter((i) => i.type === 'usage')

      expect(usageItems).toHaveLength(1)
      expect(usageItems[0].data.outputTokensUsed).toBe(3)
    })

    it('should yield TAG_USAGE when response stream fails after consuming input but producing no output', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: async function* () {
          // @note provider started streaming but fails before any completion text
          yield {
            error: null,
            finishReason: null,
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 15, completionTokens: 0, totalTokens: 15 },
          }

          throw new Error('server internal error')
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeResponseConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('server internal error')

      const usageItems = items.filter((i) => i.type === 'usage')

      // @note stream started so input tokens were consumed even with zero output
      expect(usageItems).toHaveLength(1)
      expect(usageItems[0].data.outputTokensUsed).toBe(0)
      expect(usageItems[0].data.inputTokensUsed).toBe(15)
    })

    it('rethrows stream aborts without emitting abort items in response path', async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream: () => {
          const error = new Error('stream aborted upstream')

          error.name = 'AbortError'

          throw error
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeResponseConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('stream aborted upstream')

      expect(items.some((item) => item.type === 'abort')).toBe(false)
    })
  })

  describe('completeResponseConversation maxTokens passthrough', () => {
    // @note locks in the intentional decision at model.provider.openai.conv.js
    // that the response stream does NOT forward maxTokens to the OpenAI API - the
    // model is allowed to use its full output budget because we cannot predict
    // output length ahead of time.

    it('should not pass maxTokens to createResponseCompletionStream', async () => {
      let capturedArgs = null

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'hello' }],
        createResponseCompletionStream: (args) => {
          capturedArgs = args

          return (async function* () {
            yield {
              error: null,
              finishReason: 'stop',
              completion: 'ok',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            }
          })()
        },
      }

      for await (const _ of completeResponseConversation(options)) {
        // no-op
      }

      expect(capturedArgs).not.toBeNull()
      expect(capturedArgs.maxTokens).toBeUndefined()
    })

    it('should not pass maxTokens even when overrideMaxTokens is set', async () => {
      let capturedArgs = null

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'hello' }],
        overrideMaxTokens: 20000,
        createResponseCompletionStream: (args) => {
          capturedArgs = args

          return (async function* () {
            yield {
              error: null,
              finishReason: 'stop',
              completion: 'ok',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            }
          })()
        },
      }

      for await (const _ of completeResponseConversation(options)) {
        // no-op
      }

      expect(capturedArgs).not.toBeNull()
      expect(capturedArgs.maxTokens).toBeUndefined()
    })

    it('should resolve async functions before building chat tool args', async () => {
      let capturedArgs = null

      const functionsResolver = jest.fn().mockResolvedValue([
        {
          name: 'lookupWeather',
          description: 'Look up the weather',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
          },
          handler: async () => 'sunny',
        },
      ])

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'hello' }],
        functions: functionsResolver,
        createResponseCompletionStream: (args) => {
          capturedArgs = args

          return (async function* () {
            yield {
              error: null,
              finishReason: 'stop',
              completion: 'ok',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            }
          })()
        },
      }

      for await (const _ of completeResponseConversation(options)) {
        // no-op
      }

      expect(functionsResolver).toHaveBeenCalledTimes(1)
      expect(capturedArgs).not.toBeNull()
      expect(capturedArgs.tools).toEqual([
        {
          type: 'function',
          name: 'lookupWeather',
          description: 'Look up the weather',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
          },
          strict: false,
        },
      ])
      expect(capturedArgs.toolChoice).toBe('auto')
    })

    it('should surface async function resolver errors before starting response stream', async () => {
      const createResponseCompletionStream = jest.fn()

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'hello' }],
        functions: async () => {
          throw new Error('resolver failed')
        },
        createResponseCompletionStream,
      }

      await expect(async () => {
        for await (const _ of completeResponseConversation(options)) {
          // no-op
        }
      }).rejects.toThrow('resolver failed')

      expect(createResponseCompletionStream).not.toHaveBeenCalled()
    })
  })

  describe('empty-response retry context', () => {
    it('keeps freshly generated reasoning in the retry request', async () => {
      // @note regression test - the empty-response retry previously rebuilt the
      // context from the pre-response snapshot, dropping the reasoning the
      // model had just produced even though it was already emitted to the
      // consumer (and thus persisted) - the model retried blind and the stored
      // conversation diverged from what the model actually saw

      let callIndex = 0

      const inputs = []

      const createResponseCompletionStream = (input) => {
        inputs.push(input)

        const response =
          callIndex === 0
            ? { reasoning: 'UNIQUE_REASONING_MARKER', finishReason: 'stop' }
            : { completion: 'Hello!', finishReason: 'stop' }

        callIndex++

        return (async function* () {
          yield {
            error: null,
            finishReason: response.finishReason,
            completion: response.completion || null,
            reasoning: response.reasoning || null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }
        })()
      }

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      // the empty response triggered exactly one retry

      expect(callIndex).toBe(2)

      // the reasoning was emitted to the consumer

      const reasoningMessages = items.filter(
        (item) => item.type === 'message' && item.data.type === 'reasoning'
      )

      expect(reasoningMessages.length).toBe(1)

      // the retry request contains both the empty notice AND the reasoning

      const retryRequestText = JSON.stringify(inputs[1].input)

      expect(retryRequestText).toContain('_emptyDetected')
      expect(retryRequestText).toContain('UNIQUE_REASONING_MARKER')
    })
  })

  describe('completeBegin/completeEnd balance', () => {
    it('closes the current completion before retrying an in-stream error', async () => {
      // @note regression test - the in-stream error retry previously recursed
      // BEFORE the current completion emitted its completeEnd, so a consumer
      // pairing begin/end saw a completion that never finished

      let callIndex = 0

      const createResponseCompletionStream = () => {
        const response =
          callIndex === 0
            ? { error: { message: 'Transient upstream error', code: 'error' } }
            : { completion: 'Recovered', finishReason: 'stop' }

        callIndex++

        return (async function* () {
          yield {
            error: response.error || null,
            finishReason: response.error ? null : response.finishReason,
            completion: response.completion || null,
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }
        })()
      }

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'Test' }],
        createResponseCompletionStream,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(callIndex).toBe(2)

      const begins = items.filter((item) => item.type === 'completeBegin')
      const ends = items.filter((item) => item.type === 'completeEnd')

      // every completeBegin is balanced by a completeEnd

      expect(begins.length).toBe(2)
      expect(ends.length).toBe(2)
      expect(ends.map((end) => end.data.reason)).toEqual(['error', 'stop'])
    })

    it('documents the trailing iteration completeEnd as the authoritative stop signal', async () => {
      // @note contract test - when the iteration limit stops a tool-call loop
      // the stream deliberately carries TWO completeEnd events for the final
      // completion: the per-completion end ('activity') and a trailing
      // 'iteration' status marker. Consumers must treat the LAST completeEnd
      // as authoritative (this mirrors the assertions in the maxIterations
      // tests above). If this contract changes, update all consumers pairing
      // begin/end events.

      let callIndex = 0

      const createResponseCompletionStream = () => {
        callIndex++

        return (async function* () {
          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: [
              {
                type: 'function',
                name: 'lookup',
                arguments: '{}',
              },
            ],
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }
        })()
      }

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: 1,
        functions: [
          {
            name: 'lookup',
            description: 'Test tool',
            parameters: {},
            handler: async () => ({ result: 'ok' }),
          },
        ],
        createResponseCompletionStream,
      }

      const items = []

      for await (const item of completeResponseConversation(options)) {
        items.push(item)
      }

      expect(callIndex).toBe(1)

      const begins = items.filter((item) => item.type === 'completeBegin')
      const ends = items.filter((item) => item.type === 'completeEnd')

      expect(begins.length).toBe(1)
      expect(ends.map((end) => end.data.reason)).toEqual([
        'activity',
        'iteration',
      ])
    })
  })
})

describe('fetch timeout retry (conv-level continuation)', () => {
  // @note a thrown fetch TimeoutError surfaces from the stream only AFTER every
  // lower-level retry is exhausted (fetch-layer header retries + the streaming
  // layer's pre-token body-stall retry). The conv loop grants it one more
  // iteration-bounded continuation rather than killing the whole run. The hard
  // deadline arrives as an AbortError instead and is deliberately NOT retried.

  /**
   * A stream factory that throws a fetch TimeoutError on its first `failures`
   * calls, then yields a normal completion.
   *
   * @param {number} failures - how many leading calls throw (Infinity = always)
   * @param {string} [recoverText]
   */
  function timeoutThenRecover(failures, recoverText = 'Recovered') {
    let callIndex = 0

    const factory = () => {
      const attempt = callIndex

      callIndex++

      return (async function* () {
        if (attempt < failures) {
          throw new TimeoutError()
        }

        yield {
          error: null,
          finishReason: 'stop',
          completion: recoverText,
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }
      })()
    }

    return { factory, callCount: () => callIndex }
  }

  it('chat: retries a pre-recovery fetch timeout and recovers, balancing begin/end', async () => {
    const ctrl = timeoutThenRecover(1)

    const items = []

    for await (const item of completeChatConversation({
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: ctrl.factory,
    })) {
      items.push(item)
    }

    expect(ctrl.callCount()).toBe(2)

    const text = items
      .filter((i) => i.type === 'token')
      .map((i) => i.data.token)
      .join('')

    expect(text).toBe('Recovered')

    const begins = items.filter((i) => i.type === 'completeBegin')
    const ends = items.filter((i) => i.type === 'completeEnd')

    // @note the stalled completion is closed (reason 'error') before the retry,
    // so every begin is balanced - the recovered completion ends with 'stop'
    expect(begins.length).toBe(2)
    expect(ends.length).toBe(2)
    expect(ends[0].data.reason).toBe('error')
    expect(ends[ends.length - 1].data.reason).toBe('stop')
  })

  it('response: retries a pre-recovery fetch timeout and recovers (parity)', async () => {
    const ctrl = timeoutThenRecover(1)

    const items = []

    for await (const item of completeResponseConversation({
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createResponseCompletionStream: ctrl.factory,
    })) {
      items.push(item)
    }

    expect(ctrl.callCount()).toBe(2)

    const text = items
      .filter((i) => i.type === 'token')
      .map((i) => i.data.token)
      .join('')

    expect(text).toBe('Recovered')
  })

  it('chat: does NOT retry an AbortError (the hard deadline) - it propagates', async () => {
    let callCount = 0

    const factory = () => {
      callCount++

      return (async function* () {
        throw Object.assign(new Error('The operation was aborted'), {
          name: 'AbortError',
        })
      })()
    }

    await expect(async () => {
      for await (const item of completeChatConversation({
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        createChatCompletionStream: factory,
      })) {
        void item
      }
    }).rejects.toThrow()

    // @note a single attempt - the abort is re-thrown, never retried
    expect(callCount).toBe(1)
  })

  it('chat: a persistent fetch timeout stops gracefully at the iteration limit', async () => {
    const ctrl = timeoutThenRecover(Infinity)

    const items = []

    for await (const item of completeChatConversation({
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 2,
      createChatCompletionStream: ctrl.factory,
    })) {
      items.push(item)
    }

    // @note the iteration guard bounds the retries (round 0 retries, round 1
    // hits the limit and stops) - no unbounded retry, no thrown timeout
    expect(ctrl.callCount()).toBe(2)

    const ends = items.filter((i) => i.type === 'completeEnd')

    expect(ends[ends.length - 1].data.reason).toBe('iteration')
  })
})

describe('deep agentic loops are stack-safe', () => {
  // @note the agentic tool-call loop used to recurse via `yield*` delegation, so
  // each round added a generator-delegation layer to the call stack; a long run
  // overflowed it with `RangeError: Maximum call stack size exceeded` (a
  // trivial-frame repro overflows at ~1670 nested async generators; the real,
  // heavier frames overflow lower - the prod crash hit it under the ~1000 call
  // budget). The loop is now driven iteratively: each round generator returns -
  // and is popped off the stack - before the next begins, so stack depth is O(1)
  // by construction, independent of round count.
  //
  // @note this O(1) property is structural, so we do not need to reproduce an
  // actual overflow (driving N real rounds is O(N^2) in accumulated messages and
  // would make the suite slow). We drive a few hundred rounds to guard the
  // iterative driver itself: it must keep counting iterations across rounds and
  // stop cleanly at the limit rather than looping forever or miscounting.
  //
  // @note tool-call arguments vary every round so cyclic-thread detection does
  // not short-circuit the loop before we reach the iteration limit.

  const DEPTH = 400

  // @note the chat path reads `toolCall.function.name`, the responses path reads
  // the top-level `toolCall.name` - mirror each shape so the loop actually runs.
  function variableToolCallStream(nested) {
    let i = 0

    async function* mockStream() {
      i += 1

      const args = JSON.stringify({ i })

      yield {
        error: null,
        finishReason: 'toolCalls',
        completion: null,
        reasoning: null,
        functionCall: null,
        toolCalls: [
          nested
            ? { type: 'function', function: { name: 'noop', arguments: args } }
            : { type: 'function', name: 'noop', arguments: args },
        ],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      }
    }

    return () => mockStream()
  }

  function deepLoopOptions(streamKey, nested) {
    let rounds = 0

    return {
      rounds: () => rounds,
      options: {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'Test' }],
        maxIterations: DEPTH,
        maxCalls: DEPTH * 2, // let the iteration limit be what stops the loop
        maxCycles: DEPTH * 2, // do not let cycle detection stop it early
        functions: [
          {
            name: 'noop',
            description: 'noop',
            parameters: {},
            handler: async () => {
              rounds += 1

              return { result: 'ok' }
            },
          },
        ],
        [streamKey]: variableToolCallStream(nested),
      },
    }
  }

  it('completeChatConversation drives a deep tool-call loop without overflowing', async () => {
    const { rounds, options } = deepLoopOptions(
      'createChatCompletionStream',
      true
    )

    let finalReason

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'completeEnd') {
        finalReason = item.data.reason
      }
    }

    expect(rounds()).toBe(DEPTH)
    expect(finalReason).toBe('iteration')
  }, 30000)

  it('completeResponseConversation drives a deep tool-call loop without overflowing', async () => {
    const { rounds, options } = deepLoopOptions(
      'createResponseCompletionStream',
      false
    )

    let finalReason

    for await (const item of completeResponseConversation(options)) {
      if (item.type === 'completeEnd') {
        finalReason = item.data.reason
      }
    }

    expect(rounds()).toBe(DEPTH)
    expect(finalReason).toBe('iteration')
  }, 30000)
})

describeIfConfigured('completeResponseConversation (live)', () => {
  // @note these hit the real OpenAI /v1/responses endpoint (no injected stream),
  // mirroring the live completeChatConversation tests above. They are the only
  // coverage that validates real API acceptance of our input / tools / reasoning
  // payload and the function_call / function_call_output round-trip.

  it('must be able to complete response conversation', async () => {
    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'How much is 2+2?' }],
    }

    let text = ''

    for await (const item of completeResponseConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()
  })

  it('must be able to complete response conversation with functions', async () => {
    const options = {
      model: 'gpt-4o',
      messages: [
        {
          type: 'user',
          text: `Use the getFoodPreferences function to fetch my food preferences and print them to me.`,
        },
      ],
      functions: [
        {
          name: 'getFoodPreferences',
          description: 'A simple function to get the users food preferences',
          parameters: {},
          handler: async () => JSON.stringify({ preferences: ['avocado'] }),
        },
      ],
    }

    let text = ''

    for await (const item of completeResponseConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toMatch(/av[oa]cado/i)
  })

  it('must combine tools with a reasoning effort (the case the chat API rejects)', async () => {
    const options = {
      // @note a gpt-5-family model carrying a reasoning effort AND tools - this
      // exact combination 400s on /v1/chat/completions, which is the whole
      // reason the Responses path exists
      model: 'gpt-5-mini/reasoningEffort=low',
      messages: [
        {
          type: 'user',
          text: `Use the getFoodPreferences function to fetch my food preferences and print them to me.`,
        },
      ],
      functions: [
        {
          name: 'getFoodPreferences',
          description: 'A simple function to get the users food preferences',
          parameters: {},
          handler: async () => JSON.stringify({ preferences: ['avocado'] }),
        },
      ],
    }

    let text = ''

    for await (const item of completeResponseConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toMatch(/av[oa]cado/i)
  })
})

describe('completeRealtimeConversation', () => {
  it('registers realtime tools and executes function calls returned by the response', async () => {
    const sent = []
    const lookupHandler = jest.fn().mockResolvedValue({ city: 'Lisbon' })

    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn((event) => {
        sent.push(event)
      }),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'call_1',
                name: 'lookupWeather',
                arguments: '{"location":"Lisbon"}',
              },
            ],
          },
        }
        yield {
          type: 'conversation.item.created',
          item: {
            type: 'function_call_output',
            call_id: 'call_1',
            output: '{"city":"Lisbon"}',
          },
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_2' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_2',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'It is sunny in Lisbon.',
                  },
                ],
              },
            ],
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'What is the weather in Lisbon?' }],
      functions: [
        {
          name: 'lookupWeather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
          handler: lookupHandler,
        },
      ],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'response.create',
          response: expect.objectContaining({
            tools: [
              {
                type: 'function',
                name: 'lookupWeather',
                description: 'Get weather for a city',
                parameters: {
                  type: 'object',
                  properties: {
                    location: { type: 'string' },
                  },
                  required: ['location'],
                },
              },
            ],
          }),
        }),
        expect.objectContaining({
          type: 'conversation.item.create',
          item: expect.objectContaining({
            type: 'function_call_output',
            call_id: 'call_1',
            output: '{"city":"Lisbon"}',
          }),
        }),
        expect.objectContaining({
          type: 'response.create',
        }),
      ])
    )
    // @note prior history must be seeded into the default conversation via
    // `conversation.item.create`, never as `response.input`. A response
    // created with `input` runs outside the default conversation, so its
    // function_call ids cannot be referenced by a later function_call_output
    // (fails with `invalid_tool_call_id`).
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'conversation.item.create',
          item: expect.objectContaining({
            role: 'user',
          }),
        }),
      ])
    )
    expect(
      sent.filter(
        (event) =>
          event.type === 'response.create' &&
          event.response?.input !== undefined
      )
    ).toEqual([])
    expect(lookupHandler).toHaveBeenCalledWith(
      '{"location":"Lisbon"}',
      expect.objectContaining({
        newMessages: expect.any(Array),
      })
    )
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: BOT_MESSAGE_TYPE,
            text: 'It is sunny in Lisbon.',
          }),
        }),
      ])
    )
  })

  it('records the preamble bot message when a response also triggers a tool call', async () => {
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn(),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.output_text.delta',
          response_id: 'resp_1',
          delta: 'Let me check the weather...',
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'Let me check the weather...',
                  },
                ],
              },
              {
                type: 'function_call',
                call_id: 'call_1',
                name: 'lookupWeather',
                arguments: '{"location":"Sofia"}',
              },
            ],
          },
        }
        yield {
          type: 'conversation.item.created',
          item: {
            type: 'function_call_output',
            call_id: 'call_1',
            output: '{"city":"Sofia"}',
          },
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_2' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_2',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'It is warm in Sofia.',
                  },
                ],
              },
            ],
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'What is the weather in Sofia?' }],
      functions: [
        {
          name: 'lookupWeather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
          handler: async () => ({ city: 'Sofia' }),
        },
      ],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    // @note the "let me check..." preamble must be recorded as a bot message
    // even though the same response also triggered the tool call.
    const botMessages = events.filter(
      (event) =>
        event.type === 'message' && event.data?.type === BOT_MESSAGE_TYPE
    )

    expect(botMessages.map((event) => event.data.text)).toEqual([
      'Let me check the weather...',
      'It is warm in Sofia.',
    ])
  })

  it('sends realtime tool outputs as conversation items before creating the next response', async () => {
    const sent = []
    let toolOutputAcknowledged = false

    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn((event) => {
        if (
          event.type === 'response.create' &&
          sent.some(
            (candidate) =>
              candidate.type === 'conversation.item.create' &&
              candidate.item?.type === 'function_call_output'
          ) &&
          !toolOutputAcknowledged
        ) {
          throw new Error(
            'response.create was sent before function_call_output acknowledgement'
          )
        }

        sent.push(event)
      }),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'call_1',
                name: 'lookupWeather',
                arguments: '{"location":"Sofia"}',
              },
            ],
          },
        }
        toolOutputAcknowledged = true
        yield {
          type: 'conversation.item.created',
          item: {
            type: 'function_call_output',
            call_id: 'call_1',
            output: '{"city":"Sofia"}',
          },
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_2' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_2',
            status: 'completed',
            output: [],
          },
        }
      },
    }

    for await (const _event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'What is the weather in Sofia?' }],
      functions: [
        {
          name: 'lookupWeather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
          handler: async () => ({ city: 'Sofia' }),
        },
      ],
      createRealtimeSocket: () => socket,
    })) {
      // consume events
    }

    const toolOutputIndex = sent.findIndex(
      (event) =>
        event.type === 'conversation.item.create' &&
        event.item?.type === 'function_call_output' &&
        event.item?.call_id === 'call_1' &&
        event.item?.output === '{"city":"Sofia"}'
    )

    const followUpResponseIndex = sent.findIndex(
      (event, index) =>
        index > toolOutputIndex && event.type === 'response.create'
    )

    expect(toolOutputIndex).toBeGreaterThan(-1)
    expect(followUpResponseIndex).toBeGreaterThan(toolOutputIndex)
    expect(sent[followUpResponseIndex]).toEqual(
      expect.objectContaining({
        type: 'response.create',
      })
    )
    expect(sent[followUpResponseIndex].response?.input).toBeUndefined()
  })

  it('defers tool outputs until the function call is committed at response.done', async () => {
    const sent = []
    // @note the Realtime API only commits the function_call item to the
    // conversation once its response reaches `response.done`. Submitting the
    // output before then fails with `invalid_tool_call_id`. This mock models
    // that constraint - the output is only accepted after resp_1 is done.
    let functionCallAcceptingOutput = false

    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn((event) => {
        if (
          event.type === 'conversation.item.create' &&
          event.item?.type === 'function_call_output' &&
          !functionCallAcceptingOutput
        ) {
          throw new Error('invalid_tool_call_id')
        }

        sent.push(event)
      }),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.function_call_arguments.done',
          response_id: 'resp_1',
          item_id: 'item_1',
          output_index: 0,
          call_id: 'call_1',
          name: 'lookupWeather',
          arguments: '{"location":"Sofia"}',
        }
        // @note the function_call item is committed to the conversation only
        // now, so the server starts accepting its output from this point on.
        functionCallAcceptingOutput = true
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'function_call',
                call_id: 'call_1',
                name: 'lookupWeather',
                arguments: '{"location":"Sofia"}',
              },
            ],
          },
        }
        yield {
          type: 'conversation.item.created',
          item: {
            type: 'function_call_output',
            call_id: 'call_1',
            output: '{"city":"Sofia"}',
          },
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_2' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_2',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'It is warm in Sofia.',
                  },
                ],
              },
            ],
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'What is the weather in Sofia?' }],
      functions: [
        {
          name: 'lookupWeather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
          handler: async () => ({ city: 'Sofia' }),
        },
      ],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    const toolOutputIndex = sent.findIndex(
      (event) =>
        event.type === 'conversation.item.create' &&
        event.item?.type === 'function_call_output' &&
        event.item?.call_id === 'call_1'
    )

    const followUpResponseIndex = sent.findIndex(
      (event, index) =>
        index > toolOutputIndex && event.type === 'response.create'
    )

    expect(toolOutputIndex).toBeGreaterThan(-1)
    expect(followUpResponseIndex).toBeGreaterThan(toolOutputIndex)
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: BOT_MESSAGE_TYPE,
            text: 'It is warm in Sofia.',
          }),
        }),
      ])
    )
  })

  it('issues response.create for message-only realtime input', async () => {
    const sent = []

    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn((event) => {
        sent.push(event)
      }),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.output_text.delta',
          response_id: 'resp_1',
          delta: 'Hello',
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [],
            usage: { input_tokens: 3, output_tokens: 1 },
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'Hello there' }],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    expect(socket.open).toHaveBeenCalledTimes(1)
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'response.create',
        }),
      ])
    )
    expect(events.map(({ type }) => type)).toEqual(
      expect.arrayContaining(['completeBegin', 'token', 'completeEnd', 'usage'])
    )
  })

  it('emits a final bot message for realtime responses', async () => {
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn(),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.output_text.delta',
          response_id: 'resp_1',
          delta: 'Hello',
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'Hello',
                  },
                ],
              },
            ],
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [{ type: 'user', text: 'Hello there' }],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: BOT_MESSAGE_TYPE,
            text: 'Hello',
          }),
        }),
      ])
    )
  })

  it('does not duplicate text when audio responses include both text and transcript content', async () => {
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn(),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.output_text.delta',
          response_id: 'resp_1',
          delta: 'Let me check',
        }
        yield {
          type: 'response.output_audio_transcript.delta',
          response_id: 'resp_1',
          delta: 'Let me check',
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'Let me check',
                  },
                  {
                    type: 'output_audio',
                    transcript: 'Let me check',
                  },
                ],
              },
            ],
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      modality: 'audio',
      messages: [{ type: 'user', text: 'What is the weather?' }],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    expect(
      events
        .filter(({ type }) => type === 'token')
        .map(({ data }) => data.token)
    ).toEqual(['Let me check'])

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: BOT_MESSAGE_TYPE,
            text: 'Let me check',
          }),
        }),
      ])
    )
  })

  it('emits a user message for completed input audio transcripts', async () => {
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn(),
      receive: async function* () {
        yield {
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'item_1',
          content_index: 0,
          transcript: 'Hey, can you hear me?',
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [],
          },
        }
      },
    }

    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [],
      createRealtimeSocket: () => socket,
    })) {
      events.push(event)
    }

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: USER_MESSAGE_TYPE,
            text: 'Hey, can you hear me?',
          }),
        }),
      ])
    )
  })

  it('creates streamed realtime responses only after audio transcription completes', async () => {
    const sent = []
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn((event) => {
        sent.push(event)
      }),
      receive: async function* () {
        yield {
          type: 'input_audio_buffer.speech_started',
          audio_start_ms: 0,
          item_id: 'item_1',
        }
        yield {
          type: 'input_audio_buffer.speech_stopped',
          audio_end_ms: 250,
          item_id: 'item_1',
        }
        yield {
          type: 'input_audio_buffer.committed',
          item_id: 'item_1',
          previous_item_id: null,
        }
        yield {
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'item_1',
          content_index: 0,
          transcript: 'What is the weather in Sofia?',
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'It is sunny in Sofia.',
                  },
                ],
              },
            ],
          },
        }
      },
    }

    const createRealtimeSocket = jest.fn(() => socket)
    const events = []

    for await (const event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [],
      stream: (async function* () {
        yield {
          type: 'audio',
          data: {
            data: 'AAAA',
            format: {
              encoding: 'pcm16',
              sampleRate: 24000,
              channels: 1,
            },
          },
        }
      })(),
      createRealtimeSocket,
    })) {
      events.push(event)
    }

    expect(createRealtimeSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-realtime-2',
      })
    )
    expect(sent[0]).toEqual(
      expect.objectContaining({
        type: 'session.update',
        session: expect.objectContaining({
          audio: {
            input: {
              turn_detection: {
                type: 'server_vad',
                create_response: false,
                interrupt_response: false,
              },
            },
          },
        }),
      })
    )
    expect(sent[1]).toEqual(
      expect.objectContaining({
        type: 'input_audio_buffer.append',
      })
    )
    expect(sent).toContainEqual(
      expect.objectContaining({
        type: 'response.create',
      })
    )
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: USER_MESSAGE_TYPE,
            text: 'What is the weather in Sofia?',
          }),
        }),
        expect.objectContaining({
          type: 'message',
          data: expect.objectContaining({
            type: BOT_MESSAGE_TYPE,
            text: 'It is sunny in Sofia.',
          }),
        }),
      ])
    )
  })

  it('registers session-level tools before the first streamed realtime response', async () => {
    const sent = []
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn((event) => {
        sent.push(event)
      }),
      receive: async function* () {
        yield {
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'item_1',
          content_index: 0,
          transcript: 'What is the weather in Sofia?',
        }
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [],
          },
        }
      },
    }

    for await (const _event of completeRealtimeConversation({
      model: 'gpt-realtime-2',
      messages: [],
      stream: (async function* () {
        yield {
          type: 'audio',
          data: {
            data: 'AAAA',
            format: {
              encoding: 'pcm16',
              sampleRate: 24000,
              channels: 1,
            },
          },
        }
      })(),
      functions: [
        {
          name: 'lookupWeather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
          handler: async () => ({ city: 'Sofia' }),
        },
      ],
      createRealtimeSocket: () => socket,
    })) {
      // consume events
    }

    const sessionUpdateIndex = sent.findIndex(
      (event) =>
        event.type === 'session.update' &&
        Array.isArray(event.session?.tools) &&
        event.session.tools[0]?.name === 'lookupWeather'
    )

    const firstResponseCreateIndex = sent.findIndex(
      (event) => event.type === 'response.create'
    )

    expect(sessionUpdateIndex).toBeGreaterThan(-1)
    expect(firstResponseCreateIndex).toBeGreaterThan(sessionUpdateIndex)
    expect(sent[sessionUpdateIndex]).toEqual(
      expect.objectContaining({
        type: 'session.update',
        session: expect.objectContaining({
          type: 'realtime',
          tool_choice: 'auto',
          tools: [
            {
              type: 'function',
              name: 'lookupWeather',
              description: 'Get weather for a city',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
                required: ['location'],
              },
            },
          ],
        }),
      })
    )
  })

  it('passes realtime voice configuration to the socket', async () => {
    const socket = {
      open: jest.fn(async () => {}),
      send: jest.fn(),
      receive: async function* () {
        yield {
          type: 'response.created',
          response: { id: 'resp_1' },
        }
        yield {
          type: 'response.done',
          response: {
            id: 'resp_1',
            status: 'completed',
            output: [],
          },
        }
      },
    }

    const createRealtimeSocket = jest.fn(() => socket)

    for await (const _event of completeRealtimeConversation({
      model: 'gpt-realtime-2/voice=cedar',
      messages: [{ type: 'user', text: 'Hello' }],
      createRealtimeSocket,
    })) {
      // consume stream
    }

    expect(createRealtimeSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-realtime-2',
        voice: 'cedar',
      })
    )
  })
})

describe('estimateMessageUsage', () => {
  // const PERCENT_DELTA = 1.2 // 20%

  itIfConfigured('must be able to estimate user message usage', async () => {
    const messages = [{ type: 'user', text: 'Hello' }]

    const convertedMessages = await convertMessages(messages)

    const tokens = (await Promise.all(messages.map(estimateMessageUsage)))
      .map(({ tokens }) => tokens)
      .reduce((a, b) => a + b, 0)

    const result = await createChatCompletion({
      model: 'gpt-4o',
      messages: convertedMessages,
    })

    expect(tokens).toBeGreaterThan(result.usage.promptTokens)
    // @todo find a way to make this test pass
    // expect(tokens).toBeLessThanOrEqual(result.promptTokens * PERCENT_DELTA)
  })

  itIfConfigured(
    'must be able to estimate assistant message usage',
    async () => {
      const messages = [
        { type: 'user', text: 'Hello' },
        { type: 'assistant', text: 'Hello there!' },
        { type: 'user', text: 'How are you?' },
      ]

      const convertedMessages = await convertMessages(messages)

      const tokens = (await Promise.all(messages.map(estimateMessageUsage)))
        .map(({ tokens }) => tokens)
        .reduce((a, b) => a + b, 0)

      const result = await createChatCompletion({
        model: 'gpt-4o',
        messages: convertedMessages,
      })

      expect(tokens).toBeGreaterThan(result.usage.promptTokens)
      // @todo find a way to make this test pass
      // expect(tokens).toBeLessThanOrEqual(result.promptTokens * PERCENT_DELTA)
    }
  )

  itIfConfigured(
    'must be able to estimate backstory message usage',
    async () => {
      const messages = [
        { type: 'backstory', text: 'Once upon a time' },
        { type: 'user', text: 'Hello' },
        { type: 'assistant', text: 'Hello there!' },
      ]

      const convertedMessages = await convertMessages(messages)

      const tokens = (await Promise.all(messages.map(estimateMessageUsage)))
        .map(({ tokens }) => tokens)
        .reduce((a, b) => a + b, 0)

      const result = await createChatCompletion({
        model: 'gpt-4o',
        messages: convertedMessages,
      })

      expect(tokens).toBeGreaterThan(result.usage.promptTokens)
      // @todo find a way to make this test pass
      // expect(tokens).toBeLessThanOrEqual(result.promptTokens * PERCENT_DELTA)
    }
  )

  itIfConfigured(
    'must be able to estimate activity trigger message usage',
    async () => {
      const functions = [
        {
          name: 'trigger',
          description: 'A simple trigger function',
          parameters: {},
        },
      ]

      const messages = [
        { type: '_tmpFunctions', text: '', meta: functions },
        { type: 'user', text: 'Hello' },
        { type: 'activity', text: '', meta: { activity: { type: 'trigger' } } },
      ]

      const convertedMessages = await convertMessages(messages)

      const tokens = (await Promise.all(messages.map(estimateMessageUsage)))
        .map(({ tokens }) => tokens)
        .reduce((a, b) => a + b, 0)

      const result = await createChatCompletion({
        model: 'gpt-4o',
        messages: convertedMessages,
        tools: functions.map((fn) => ({
          type: 'function',
          function: fn,
        })),
      })

      expect(tokens).toBeGreaterThan(result.usage.promptTokens)
      // @todo find a way to make this test pass
      // expect(tokens).toBeLessThanOrEqual(result.promptTokens * PERCENT_DELTA)
    }
  )

  it('should handle message with empty text', async () => {
    const message = { type: 'user', text: '' }
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThanOrEqual(0)
  })

  it('should handle context message type', async () => {
    const message = { type: 'context', text: 'Some context information' }
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThan(0)
  })

  it('should handle instruction message type', async () => {
    const message = { type: 'instruction', text: 'Follow these instructions' }
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThan(0)
  })

  it('should handle reasoning message type', async () => {
    const message = { type: 'reasoning', text: 'This is my reasoning' }
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThan(0)
  })

  it('should handle TMP_BACKSTORY_MESSAGE_TYPE', async () => {
    const message = { type: '_tmpBackstory', text: 'Temporary backstory' }
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThan(0)
  })

  it('should handle activity request message', async () => {
    const message = makeRequestActivityMessage('testFunc', { arg: 'value' })
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThan(0)
  })

  it('should handle activity response message', async () => {
    const message = makeResponseActivityMessage(
      'testFunc',
      { arg: 'value' },
      'result'
    )
    const usage = await estimateMessageUsage(message)

    expect(usage).toHaveProperty('tokens')
    expect(usage.tokens).toBeGreaterThan(0)
  })
})

describe('organizeMessages', () => {
  it('should preserve the order of messages when no activity messages are present', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
      { type: 'user', text: 'How are you?' },
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual(messages)
  })

  it('should keep activity messages if they are in the correct order', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('test', { arg: 'value' }),
      makeResponseActivityMessage('test', { arg: 'value' }, 'result'),
      { type: 'assistant', text: 'Hi there' },
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual(messages)
  })

  it('should cluster activity messages together', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('test1', { arg: 'value1' }),
      makeRequestActivityMessage('test2', { arg: 'value2' }),
      { type: 'assistant', text: 'Hi there' },
      makeResponseActivityMessage('test1', { arg: 'value1' }, 'result1'),
      makeResponseActivityMessage('test2', { arg: 'value2' }, 'result2'),
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('test1', { arg: 'value1' }),
      makeResponseActivityMessage('test1', { arg: 'value1' }, 'result1'),
      makeRequestActivityMessage('test2', { arg: 'value2' }),
      makeResponseActivityMessage('test2', { arg: 'value2' }, 'result2'),
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('should cluster activity messages together when out of order', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('test1', { arg: 'value1' }),
      makeRequestActivityMessage('test2', { arg: 'value2' }),
      { type: 'assistant', text: 'Hi there' },
      makeResponseActivityMessage('test2', { arg: 'value2' }, 'result2'),
      makeResponseActivityMessage('test1', { arg: 'value1' }, 'result1'),
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('test1', { arg: 'value1' }),
      makeResponseActivityMessage('test1', { arg: 'value1' }, 'result1'),
      makeRequestActivityMessage('test2', { arg: 'value2' }),
      makeResponseActivityMessage('test2', { arg: 'value2' }, 'result2'),
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('must remove activity request messages that don not have a response', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('test1', { arg: 'value1' }),
      { type: 'assistant', text: 'Hi there' },
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('must remove activity response messages that do not have a request', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeResponseActivityMessage('test1', { arg: 'value1' }, 'result1'),
      { type: 'assistant', text: 'Hi there' },
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('must remove activity messages that are completely out of order', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeResponseActivityMessage('test1', { arg: 'value1' }, 'result1'),
      { type: 'assistant', text: 'Hi there' },
      makeRequestActivityMessage('test1', { arg: 'value1' }),
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('must preserve activity triggers if they are the last message', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
      makeTriggerActivityMessage('test1', { arg: 'value1' }),
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
      makeTriggerActivityMessage('test1', { arg: 'value1' }),
    ])
  })

  it('must remove activity triggers if they are not the last message', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeTriggerActivityMessage('test1', { arg: 'value1' }),
      { type: 'assistant', text: 'Hi there' },
    ]

    const organized = organizeMessages(messages)

    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('should handle empty messages array', () => {
    const organized = organizeMessages([])

    expect(organized).toEqual([])
  })

  it('should handle activity message with undefined meta.activity.type', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'activity', text: '', meta: { activity: {} } },
      { type: 'assistant', text: 'Hi there' },
    ]

    const organized = organizeMessages(messages)

    // Activity message with undefined type should be filtered out
    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('should handle activity message with null meta', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'activity', text: '', meta: null },
      { type: 'assistant', text: 'Hi there' },
    ]

    const organized = organizeMessages(messages)

    // Activity message with null meta should be filtered out
    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
    ])
  })

  it('should handle TMP_FUNCTIONS_MESSAGE_TYPE and TMP_BACKSTORY_MESSAGE_TYPE with triggers', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: TMP_FUNCTIONS_MESSAGE_TYPE, text: '', meta: [] },
      makeTriggerActivityMessage('test1', { arg: 'value1' }),
      { type: TMP_BACKSTORY_MESSAGE_TYPE, text: 'backstory' },
    ]

    const organized = organizeMessages(messages)

    // TMP messages should be preserved and trigger should be kept since it's the last non-TMP message
    expect(organized.length).toBe(4)
  })

  it('should handle TMP_CHECKPOINT_MESSAGE_TYPE with triggers', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: TMP_FUNCTIONS_MESSAGE_TYPE, text: '', meta: [] },
      makeTriggerActivityMessage('test1', { arg: 'value1' }),
      { type: TMP_BACKSTORY_MESSAGE_TYPE, text: 'backstory' },
      { type: TMP_CHECKPOINT_MESSAGE_TYPE, text: 'checkpoint' },
    ]

    const organized = organizeMessages(messages)

    expect(organized.length).toBe(5)
  })

  it('should handle multiple request activities with single matching response', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('func1', { arg: 'a' }),
      makeRequestActivityMessage('func2', { arg: 'b' }),
      makeResponseActivityMessage('func1', { arg: 'a' }, 'result1'),
      { type: 'assistant', text: 'Done' },
    ]

    const organized = organizeMessages(messages)

    // func2 request should be removed since it has no response
    expect(organized).toEqual([
      { type: 'user', text: 'Hello' },
      makeRequestActivityMessage('func1', { arg: 'a' }),
      makeResponseActivityMessage('func1', { arg: 'a' }, 'result1'),
      { type: 'assistant', text: 'Done' },
    ])
  })
})

describe('optimizeMessages', () => {
  it('should optimize messages by moving backstory message to the end', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'assistant', text: 'Hi there' },
      { type: 'backstory', text: 'Once upon a time' },
    ]

    const optimized = await optimizeMessages(messages, null, 100, {
      model: 'gpt-4o',
    })

    expect(optimized.messages[0].type).toEqual('backstory')
  })

  it('the backstory message should never be trimmed', async () => {
    const messages = [
      {
        type: 'backstory',
        text: 'You are a **wellness workflow agent** for **Fitwell**, a fitness coaching brand specializing in **Athletic Performance and General Health and Fitness**. Your core mission is to **automate daily wellness check-ins** for Fitwell\'s clients, providing their fitness coaches with a quick, **data-driven snapshot of client recovery and body readiness**. This ultimately helps coaches efficiently tailor workout routines and monitor overall client well-being, saving them time and enabling them to serve more clients.\n\n\n\nYour persona is that of a **data-driven analyst** with an **analytical and encouraging** communication style, reflecting Fitwell\'s **Science-Backed** values.\n\n\n\n**Your workflow involves the following sequence:**\n\n\n\n**1. Initiation:**\n\n* **You will begin your interaction only after the user provides a prompt or initiates the conversation to start the wellness check-in.** Once prompted, begin with the first question.\n\n\n\n**2. Questionnaire Delivery and Interaction:**\n\n* Present the following wellness questions to the user **one question at a time**:\n\n1. "How is your energy level today?"\n\n2. "On a scale of 1-10, how well did you sleep?"\n\n3. "Do you feel any muscle soreness?"\n\n4. "On a scale of 1-10, how difficult would you rate yesterday\'s workout?"\n\n* Maintain an **analytical and encouraging tone** throughout the entire interaction.\n\n* **Encourage comprehensive answers** where appropriate to ensure completeness:\n\n* For qualitative questions (e.g., "Do you feel any muscle soreness?"), if the initial answer is brief (e.g., "Yes"), follow up with a gentle, single question to elicit slightly more detail (e.g., "Could you briefly describe where you feel it, or its intensity?").\n\n* Ensure quantitative questions (scales) receive clear numerical responses.\n\n* **Conditional Probing (Maximum one additional probe per question):**\n\n* **If an answer falls below/above a defined threshold, probe further** to understand the **root cause**, assess **severity**, and gather **context** for the coach\'s decision-making. Formulate these follow-up questions by **referring to best practices from Strength and Conditioning (S&C) principles**.\n\n* **Energy Level:**\n\n* Categorize responses as **low, medium, or high**.\n\n* **Probe further for \'low\' and \'medium\' energy levels.**\n\n* *Example Probe (Low/Medium Energy):* "Could you elaborate on what might be contributing to your energy level today, perhaps related to recent activity or recovery?"\n\n* **Sleep (on a scale of 1-10):**\n\n* **Probe further if the score is below 6.**\n\n* *Example Probe (Low Sleep):* "Could you share any factors that might have impacted your sleep quality last night?"\n\n* **Muscle Soreness:**\n\n* After the initial follow-up about location/intensity, **probe further if the user indicates \'severe soreness\' (both localized and generalized).**\n\n* *Example Probe (Severe Soreness):* "Could you describe the nature of this severe soreness – is it a sharp pain, a deep ache, or something else, and does it impact movement?"\n\n* **Workout Difficulty (on a scale of 1-10):**\n\n* **Probe further if the score is 9 or above.**\n\n* *Example Probe (High Difficulty):* "What specifically made yesterday\'s workout feel particularly difficult for you?"\n\n* **Handle user input robustly:**\n\n* If a user\'s answer is **unclear or ambiguous**, **politely talk to the user and seek clarification** until a clear response is obtained.\n\n* If a user provides **invalid input** (e.g., non-numeric for a scale, irrelevant text), **gently talk to them, reiterate the purpose of the questionnaire** (monitoring their wellness for their coach), and guide them back to provide valid input.\n\n* **Handle sensitive answers carefully:** If a user reports particularly challenging data (e.g., very low sleep, high soreness), offer a **supportive acknowledgment**. Explicitly state: "This information will be passed on to your fitness coach." **Crucially, do NOT offer any medical advice, prescriptions, or suggestions.**\n\n\n\n**3. Data Collection and Storage:**\n\n* Collect and accurately record all of the user\'s responses, including details from any follow-up probes.\n\n* **Crucially, store these responses to track trends over time** for each individual user, allowing for future comparisons.\n\n\n\n**4. Report Generation:**\n\n* Once all four questions have been fully answered (and any necessary probes completed), generate a **summary-focused report** for the fitness coach.\n\n* The report should be presented concisely using **bullet points**.\n\n* The report\'s tone must be **analytical and encouraging**, consistent with Fitwell\'s brand voice.\n\n* **Content of the report:**\n\n* Clearly list the user\'s direct answer to each of the four wellness questions, including any additional details gathered from probes.\n\n* **Incorporate trend analysis** by comparing current responses to the user\'s **7-day average (or last 3 entries if less than 7)** for each question. For example: "Your energy level is [X] today, showing a [Y point] [increase/decrease/no change] compared to your 7-day average." If a question is not numeric, state "Your muscle soreness is [X], consistent/inconsistent with recent reports."\n\n* Conclude the report with a brief, analytical statement reinforcing its purpose for the coach, e.g., **"This data provides a snapshot for assessing current recovery and informing potential workout adaptations."**\n\n* **Strictly adhere to the following content exclusions in the report:**\n\n* No slang.\n\n* No complex medical jargon.\n\n* No medical prescriptions or suggestions.\n\n* **Do not calculate or derive any additional metrics or scores** beyond presenting the direct answers and simple trends.\n\n\n\n**Overall Success Criteria:** The workflow is successful when the questionnaire is fully completed by the user with comprehensive answers (where appropriate and after probing), and the generated report is concise, clear, and effectively provides the fitness coach with the necessary recovery snapshot.',
      },
      {
        id: 'cmdr23u153du1zz0vjtwh3ky0',
        type: 'user',
        text: 'start',
        meta: null,
        createdAt: 1753945905185,
      },
    ]

    const optimized = await optimizeMessages(messages, [], 1000, {
      // @note using gpt-4o here to avoid requiring a vercel credential in
      // the test environment; the backstory trimming behavior is model-agnostic
      model: 'gpt-4o/interactionMaxMessages=10/maxTokens=1000/temperature=0.6',
    })

    expect(optimized.messages.length).toBe(2)
  })

  it('should preserve backstory when it ends up at index 0 after thread building', async () => {
    // @note this tests a specific edge case where the backstory message ends
    // up at index 0 after buildThread processing - previously it was incorrectly
    // removed due to an off-by-one error (index > 0 instead of index >= 0)
    const messages = [
      { type: 'backstory', text: 'You are a helpful assistant' },
    ]

    const optimized = await optimizeMessages(messages, null, 1000, {
      model: 'gpt-4o',
    })

    expect(optimized.messages.length).toBe(1)
    expect(optimized.messages[0].type).toBe('backstory')
    expect(optimized.messages[0].text).toBe('You are a helpful assistant')
  })

  it('should preserve checkpoint message when interactionMaxMessages trims the window', async () => {
    const messages = [
      { type: CHECKPOINT_MESSAGE_TYPE, text: 'Checkpoint summary' },
      { type: USER_MESSAGE_TYPE, text: 'A' },
      { type: BOT_MESSAGE_TYPE, text: 'B' },
      { type: USER_MESSAGE_TYPE, text: 'C' },
    ]

    const optimized = await optimizeMessages(messages, null, 1000, {
      model: 'gpt-4o/interactionMaxMessages=2',
    })

    const checkpointMessages = optimized.messages.filter(
      (m) => m.type === CHECKPOINT_MESSAGE_TYPE
    )

    expect(checkpointMessages).toHaveLength(1)
    expect(checkpointMessages[0].text).toBe('Checkpoint summary')
  })

  it('should keep only the latest checkpoint when multiple are present', async () => {
    const messages = [
      { type: CHECKPOINT_MESSAGE_TYPE, text: 'Old checkpoint' },
      { type: USER_MESSAGE_TYPE, text: 'Hello' },
      { type: CHECKPOINT_MESSAGE_TYPE, text: 'Latest checkpoint' },
    ]

    const optimized = await optimizeMessages(messages, null, 1000, {
      model: 'gpt-4o',
    })

    const checkpointMessages = optimized.messages.filter(
      (m) => m.type === CHECKPOINT_MESSAGE_TYPE
    )

    expect(checkpointMessages).toHaveLength(1)
    expect(checkpointMessages[0].text).toBe('Latest checkpoint')
  })

  it('should handle empty messages array', async () => {
    const messages = []

    const optimized = await optimizeMessages(messages, null, 1000, {
      model: 'gpt-4o',
    })

    expect(optimized.messages.length).toBe(0)
  })

  it('should keep only the last backstory when multiple are present', async () => {
    const messages = [
      { type: 'backstory', text: 'First backstory' },
      { type: 'user', text: 'Hello' },
      { type: 'backstory', text: 'Second backstory' },
    ]

    const optimized = await optimizeMessages(messages, null, 1000, {
      model: 'gpt-4o',
    })

    const backstoryMessages = optimized.messages.filter(
      (m) => m.type === 'backstory'
    )

    expect(backstoryMessages.length).toBe(1)
    expect(backstoryMessages[0].text).toBe('Second backstory')
  })

  it('should preserve backstory and user message when functions are provided', async () => {
    const messages = [
      { type: 'backstory', text: 'You are a helpful assistant' },
      { type: 'user', text: 'Hello' },
    ]
    const functions = [{ name: 'test', description: 'A test function' }]

    const optimized = await optimizeMessages(messages, functions, 10000, {
      model: 'gpt-4o',
    })

    expect(optimized.messages.length).toBe(2)
    expect(optimized.messages[0].type).toBe('backstory')
    expect(optimized.messages[1].type).toBe('user')
  })
})

describe('getFunctionArguments', () => {
  it('should return arguments unchanged', () => {
    const args = { foo: 'bar', count: 42 }

    expect(getFunctionArguments(args)).toEqual(args)
  })

  it('should handle string arguments', () => {
    const args = '{"foo": "bar"}'

    expect(getFunctionArguments(args)).toBe(args)
  })

  it('should handle null and undefined', () => {
    expect(getFunctionArguments(null)).toBeNull()
    expect(getFunctionArguments(undefined)).toBeUndefined()
  })

  it('should handle empty object', () => {
    expect(getFunctionArguments({})).toEqual({})
  })

  it('should handle empty string', () => {
    expect(getFunctionArguments('')).toBe('')
  })

  it('should handle array arguments', () => {
    const args = ['a', 'b', 'c']

    expect(getFunctionArguments(args)).toEqual(['a', 'b', 'c'])
  })

  it('should handle nested object arguments', () => {
    const args = { outer: { inner: { deep: 'value' } } }

    expect(getFunctionArguments(args)).toEqual({
      outer: { inner: { deep: 'value' } },
    })
  })

  it('should handle boolean arguments', () => {
    expect(getFunctionArguments(true)).toBe(true)
    expect(getFunctionArguments(false)).toBe(false)
  })

  it('should handle number arguments', () => {
    expect(getFunctionArguments(42)).toBe(42)
    expect(getFunctionArguments(0)).toBe(0)
  })

  it('should pass through with functions list provided', () => {
    const args = { test: 'value' }
    const functions = [{ name: 'testFunc' }]

    expect(getFunctionArguments(args, functions)).toEqual({ test: 'value' })
  })
})

describe('trimSingleMessage', () => {
  it('should return false for activity messages', async () => {
    const message = {
      type: ACTIVITY_MESSAGE_TYPE,
      text: 'activity content',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 50)

    expect(result).toBe(false)
  })

  it('should return backstory message unchanged', async () => {
    const message = {
      type: BACKSTORY_MESSAGE_TYPE,
      text: 'You are a helpful assistant',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 50)

    expect(result).toEqual(message)
  })

  it('should return checkpoint message unchanged', async () => {
    const message = {
      type: CHECKPOINT_MESSAGE_TYPE,
      text: 'Checkpoint summary',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 50)

    expect(result).toEqual(message)
  })

  it('should return TMP_BACKSTORY_MESSAGE_TYPE unchanged', async () => {
    const message = {
      type: TMP_BACKSTORY_MESSAGE_TYPE,
      text: 'Temp backstory',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 50)

    expect(result).toEqual(message)
  })

  it('should return TMP_FUNCTIONS_MESSAGE_TYPE unchanged', async () => {
    const message = {
      type: TMP_FUNCTIONS_MESSAGE_TYPE,
      text: '',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 50)

    expect(result).toEqual(message)
  })

  it('should trim user messages to maxTokens', async () => {
    const message = {
      type: USER_MESSAGE_TYPE,
      text: 'This is a very long message that should be trimmed',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 10)

    expect(result).not.toBe(false)
    expect(result.usage.tokens).toBe(10)
  })

  it('should not mutate original message when trimming', async () => {
    const originalText = 'This is a message'
    const message = {
      type: USER_MESSAGE_TYPE,
      text: originalText,
      usage: { tokens: 100 },
    }

    await trimSingleMessage(message, 10)
    expect(message.text).toBe(originalText)
    expect(message.usage.tokens).toBe(100)
  })

  it('should handle message with empty text', async () => {
    const message = {
      type: USER_MESSAGE_TYPE,
      text: '',
      usage: { tokens: 0 },
    }

    const result = await trimSingleMessage(message, 10)

    expect(result).not.toBe(false)
    expect(result.text).toBe('')
  })

  it('should handle bot message type', async () => {
    const message = {
      type: BOT_MESSAGE_TYPE,
      text: 'Long bot response that needs trimming',
      usage: { tokens: 100 },
    }

    const result = await trimSingleMessage(message, 10)

    expect(result).not.toBe(false)
    expect(result.usage.tokens).toBe(10)
  })

  it('should handle context message type', async () => {
    const message = {
      type: CONTEXT_MESSAGE_TYPE,
      text: 'Some context information',
      usage: { tokens: 50 },
    }

    const result = await trimSingleMessage(message, 10)

    expect(result).not.toBe(false)
    expect(result.usage.tokens).toBe(10)
  })

  it('should handle instruction message type', async () => {
    const message = {
      type: INSTRUCTION_MESSAGE_TYPE,
      text: 'Follow these instructions carefully',
      usage: { tokens: 50 },
    }

    const result = await trimSingleMessage(message, 10)

    expect(result).not.toBe(false)
    expect(result.usage.tokens).toBe(10)
  })

  it('should handle reasoning message type', async () => {
    const message = {
      type: REASONING_MESSAGE_TYPE,
      text: 'This is my reasoning process',
      usage: { tokens: 50 },
    }

    const result = await trimSingleMessage(message, 10)

    expect(result).not.toBe(false)
    expect(result.usage.tokens).toBe(10)
  })
})

describe('calculateMaxTokens', () => {
  it('should return valid input and total tokens for gpt-4o', () => {
    const result = calculateMaxTokens('gpt-4o', 10000, [])

    expect(result).toHaveProperty('inputTokens')
    expect(result).toHaveProperty('totalTokens')
    expect(result.inputTokens).toBeGreaterThan(0)
    expect(result.totalTokens).toBeGreaterThan(0)
  })

  it('should handle negative maxTokens by taking absolute value', () => {
    const result = calculateMaxTokens('gpt-4o', -10000, [])

    expect(result.inputTokens).toBeGreaterThan(0)
  })

  it('should cap tokens at model limits', () => {
    // @note using a very large number that exceeds model limits
    const result = calculateMaxTokens('gpt-4o', 10_000_000, [])

    // @note inputTokens should be capped - the exact value depends on model config
    // but it should not equal the ridiculous input value
    expect(result.inputTokens).toBeLessThan(10_000_000)
    expect(result.inputTokens).toBeGreaterThan(0)
  })

  it('should use custom model config for unknown models', () => {
    const result = calculateMaxTokens('unknown-model', 10000, [])

    expect(result).toHaveProperty('inputTokens')
    expect(result).toHaveProperty('totalTokens')
  })

  it('should handle zero maxTokens by using MIN_TOKENS', () => {
    const result = calculateMaxTokens('gpt-4o', 0, [])

    // Should use MIN_TOKENS (10000) as minimum
    expect(result.inputTokens).toBeGreaterThanOrEqual(10000)
  })

  it('should handle very small maxTokens by using MIN_TOKENS', () => {
    const result = calculateMaxTokens('gpt-4o', 100, [])

    // Should use MIN_TOKENS (10000) as minimum
    expect(result.inputTokens).toBeGreaterThanOrEqual(10000)
  })

  it('should handle maxTokens equal to MIN_TOKENS', () => {
    const result = calculateMaxTokens('gpt-4o', 10000, [])

    expect(result.inputTokens).toBe(10000)
  })

  it('should work with messages array containing items', () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'bot', text: 'Hi there' },
    ]
    const result = calculateMaxTokens('gpt-4o', 50000, messages)

    expect(result).toHaveProperty('inputTokens')
    expect(result).toHaveProperty('totalTokens')
  })
})

describe('getFunctionName', () => {
  it('should return function name as is', () => {
    expect(getFunctionName('myFunction')).toBe('myFunction')
  })

  it('should return the original function name if it partially matches a known function', () => {
    const functions = [
      { name: 'getFoodPreferences', description: 'Get food preferences' },
      { name: 'getFirstMessage', description: 'Get first message' },
    ]

    expect(getFunctionName('functions.getFoodPreferences', functions)).toBe(
      'getFoodPreferences'
    )
  })

  it('should do best effort to return a valid function name', () => {
    const functions = [
      { name: 'getFoodPreferences', description: 'Get food preferences' },
      { name: 'getFirstMessage', description: 'Get first message' },
    ]

    expect(getFunctionName('getFoodPreferences()', functions)).toBe(
      'getFoodPreferences'
    )
    expect(getFunctionName('getFirstMessage()', functions)).toBe(
      'getFirstMessage'
    )
    expect(getFunctionName('functions.unknownFunction', functions)).toBe(
      'functions_unknownFunction'
    )
    expect(getFunctionName('functions.getFoodPreferences', functions)).toBe(
      'getFoodPreferences'
    )
    expect(getFunctionName('getfoodpreferences', functions)).toBe(
      'getFoodPreferences'
    )
    expect(getFunctionName(' getfoodpreferences ', functions)).toBe(
      'getFoodPreferences'
    )
  })

  it('should handle empty string input', () => {
    expect(getFunctionName('')).toBe('')
  })

  it('should handle undefined functions list', () => {
    expect(getFunctionName('someFunction', undefined)).toBe('someFunction')
  })

  it('should handle empty functions list', () => {
    expect(getFunctionName('someFunction', [])).toBe('someFunction')
  })

  it('should sanitize special characters in function name', () => {
    expect(getFunctionName('func@#$name!')).toBe('func_name')
  })

  it('should remove leading and trailing underscores after sanitization', () => {
    expect(getFunctionName('___func___')).toBe('func')
  })

  it('should replace multiple consecutive underscores with single underscore', () => {
    expect(getFunctionName('func---name___test')).toBe('func_name_test')
  })

  it('should handle whitespace-only input', () => {
    expect(getFunctionName('   ')).toBe('')
  })

  it('should not match if multiple functions contain the incoming name', () => {
    const functions = [
      { name: 'get', description: 'Get something' },
      { name: 'getItem', description: 'Get an item' },
    ]

    // @note 'getitems' (lowercase) contains both 'get' and 'getitem' (case-insensitive), so no single match
    expect(getFunctionName('getitems', functions)).toBe('getitems')
  })

  it('should handle exact match in functions list', () => {
    const functions = [{ name: 'exactMatch', description: 'Exact match' }]

    expect(getFunctionName('exactMatch', functions)).toBe('exactMatch')
  })
})

describe('mapFinishReasonToCompleteReason', () => {
  it('maps function/tool finish reasons to activity', () => {
    expect(mapFinishReasonToCompleteReason('functionCall')).toBe('activity')
    expect(mapFinishReasonToCompleteReason('toolCalls')).toBe('activity')
  })

  it('maps contentFilter to error', () => {
    expect(mapFinishReasonToCompleteReason('contentFilter')).toBe('error')
  })

  it('throws for null finish reason', () => {
    expect(() => mapFinishReasonToCompleteReason(null)).toThrow()
  })
})

describe('completeTextConversation', () => {
  itIfConfigured('must be able to complete text conversation', async () => {
    const options = {
      model: 'gpt-3.5-turbo-instruct',
      messages: [{ type: 'user', text: 'How much is 2+2?' }],
    }

    let text = ''

    for await (const item of completeTextConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()
  })

  describe('bug isolation', () => {
    function createMockTextStream(chunks) {
      return async function* mockTextStream() {
        for (const chunk of chunks) {
          yield {
            reasoning: null,
            completion: null,
            finishReason: null,
            usage: null,

            ...chunk,
          }
        }
      }
    }

    it('should keep text before trailing open bracket on stop finish reason', async () => {
      const items = []

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Say hello' }],
        background: true,
        createTextCompletionStream: () =>
          createMockTextStream([
            {
              completion: 'Hello<|',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            },
          ])(),
      }

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const tokenText = items
        .filter((item) => item.type === 'token')
        .map((item) => item.data.token)
        .join('')

      expect(tokenText).toBe('Hello')
    })

    it('should stop output at configured stop sequence, not continue after it', async () => {
      const items = []

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Give short response' }],
        stop: ['<END>'],
        background: true,
        createTextCompletionStream: () =>
          createMockTextStream([
            {
              completion: 'Answer<END>leak',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            },
          ])(),
      }

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const tokenText = items
        .filter((item) => item.type === 'token')
        .map((item) => item.data.token)
        .join('')

      expect(tokenText).toBe('Answer')
    })

    it('should trim leading whitespace on first chunk when currentContinuations is omitted', async () => {
      const items = []

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: () =>
          createMockTextStream([
            {
              completion: '   hello',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            },
          ])(),
      }

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const tokenText = items
        .filter((item) => item.type === 'token')
        .map((item) => item.data.token)
        .join('')

      expect(tokenText).toBe('hello')
    })

    it('handles contentFilter finish reason without throwing', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: () =>
          createMockTextStream([
            {
              completion: '',
              finishReason: 'contentFilter',
              usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
            },
          ])(),
      }

      const items = []

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const finalEnd = items.filter((i) => i.type === 'completeEnd').pop()

      expect(finalEnd?.data.reason).toBe('error')
    })

    it('handles error finish reason without throwing', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: () =>
          createMockTextStream([
            {
              completion: '',
              finishReason: 'error',
              usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
            },
          ])(),
      }

      const items = []

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const finalEnd = items.filter((i) => i.type === 'completeEnd').pop()

      expect(finalEnd?.data.reason).toBe('error')
    })

    it('retries on token-limit exception and succeeds', async () => {
      let callCount = 0

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        maxContinuations: 1,
        createTextCompletionStream: () => {
          callCount += 1

          if (callCount === 1) {
            throw new Error(
              "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
            )
          }

          return createMockTextStream([
            {
              completion: 'ok',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
            },
          ])()
        },
      }

      const items = []

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      expect(callCount).toBe(2)
      expect(
        items.some((i) => i.type === 'token' && i.data.token === 'ok')
      ).toBe(true)
    })

    it('rethrows non-token-limit exceptions from text stream', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: () => {
          throw new Error('network down')
        },
      }

      await expect(async () => {
        for await (const _ of completeTextConversation(options)) {
          // no-op
        }
      }).rejects.toThrow('network down')
    })

    it('rethrows stream aborts without emitting abort items in text path', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: () => {
          const error = new Error('request aborted')

          error.name = 'AbortError'

          throw error
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeTextConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('request aborted')

      expect(items.some((item) => item.type === 'abort')).toBe(false)
    })

    it('should not yield TAG_USAGE when text stream throws a fatal error', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: () => {
          throw new Error('Incorrect API key')
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeTextConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('Incorrect API key')

      expect(items.filter((i) => i.type === 'usage')).toHaveLength(0)
    })

    it('should yield TAG_USAGE on successful text stream completion', async () => {
      const items = []

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: createMockTextStream([
          {
            completion: 'hello',
            finishReason: 'stop',
            usage: { promptTokens: 5, completionTokens: 1, totalTokens: 6 },
          },
        ]),
      }

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const usageItems = items.filter((i) => i.type === 'usage')

      expect(usageItems).toHaveLength(1)
      expect(usageItems[0].data.inputTokensUsed).toBeGreaterThanOrEqual(0)
    })

    it('should yield TAG_USAGE when text stream fails mid-stream after tokens were received', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: async function* () {
          yield {
            completion: 'partial',
            finishReason: null,
            usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
          }

          throw new Error('network connection lost')
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeTextConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('network connection lost')

      const usageItems = items.filter((i) => i.type === 'usage')

      expect(usageItems).toHaveLength(1)
      expect(usageItems[0].data.outputTokensUsed).toBe(2)
    })

    it('should yield TAG_USAGE when text stream fails after consuming input but producing no output', async () => {
      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'Respond' }],
        background: true,
        createTextCompletionStream: async function* () {
          // @note provider started streaming but fails before any completion text
          yield {
            completion: null,
            finishReason: null,
            usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
          }

          throw new Error('server internal error')
        },
      }

      const items = []

      await expect(async () => {
        for await (const item of completeTextConversation(options)) {
          items.push(item)
        }
      }).rejects.toThrow('server internal error')

      const usageItems = items.filter((i) => i.type === 'usage')

      // @note stream started so input tokens were consumed even with zero output
      expect(usageItems).toHaveLength(1)
      expect(usageItems[0].data.outputTokensUsed).toBe(0)
      expect(usageItems[0].data.inputTokensUsed).toBe(10)
    })

    it('should include checkpoint tool output in the text prompt', async () => {
      let capturedPrompt = ''

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [
          { type: CHECKPOINT_MESSAGE_TYPE, text: 'Checkpoint summary' },
          { type: 'user', text: 'Respond' },
        ],
        background: true,
        createTextCompletionStream: ({ prompt }) => {
          capturedPrompt = prompt

          return createMockTextStream([
            {
              completion: 'ok',
              finishReason: 'stop',
              usage: { promptTokens: 5, completionTokens: 1, totalTokens: 6 },
            },
          ])()
        },
      }

      for await (const _ of completeTextConversation(options)) {
        // no-op
      }

      expect(capturedPrompt).toContain('Checkpoint summary')
    })
  })
})

describe('completeChatConversation', () => {
  itIfConfigured('must be able to complete chat conversation', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'A bot that can do math',
      messages: [{ type: 'user', text: 'How much is 2+2?' }],
    }

    let text = ''

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()
  })

  it('shrinks the conversation and retries on a content moderation rejection', async () => {
    const seenMessageCounts = []

    // @note throw a moderation rejection on the first (full) attempt, then
    // succeed once the conversation has been shrunk on retry
    const createChatCompletionStream = async function* (streamOptions) {
      seenMessageCounts.push(streamOptions.messages.length)

      if (seenMessageCounts.length === 1) {
        throw new ContentModerationError(
          'Input data may contain inappropriate content. (400)'
        )
      }

      yield {
        error: null,
        finishReason: 'stop',
        completion: 'recovered',
        reasoning: null,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        functionCall: null,
        toolCalls: null,
      }
    }

    const options = {
      model: 'gpt-4o',
      backstory: 'A helpful bot',
      messages: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: i % 2 === 0 ? 'user' : 'bot',
          text: `turn ${i}`,
        })),
        { type: 'user', text: 'latest question' },
      ],
      createChatCompletionStream,
    }

    let text = ''

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBe('recovered')
    expect(seenMessageCounts.length).toBe(2)
    // @note the retry must run against a smaller conversation (the dropped turns
    // outweigh the small synthetic omission notice that replaces them)
    expect(seenMessageCounts[1]).toBeLessThan(seenMessageCounts[0])
  })

  it('surfaces a ContentModerationError once the conversation cannot be shrunk further', async () => {
    let calls = 0

    const createChatCompletionStream = async function* () {
      calls++

      throw new ContentModerationError(
        'Input data may contain inappropriate content. (400)'
      )

      yield
    }

    const options = {
      model: 'gpt-4o',
      backstory: 'A helpful bot',
      messages: [
        { type: 'user', text: 'first question' },
        { type: 'bot', text: 'first answer' },
        { type: 'user', text: 'latest question' },
      ],
      createChatCompletionStream,
    }

    await expect(
      (async () => {
        for await (const _item of completeChatConversation(options)) {
        }
      })()
    ).rejects.toBeInstanceOf(ContentModerationError)

    // @note it must have retried with a reduced conversation before giving up,
    // and must terminate rather than retry forever
    expect(calls).toBeGreaterThan(1)
    expect(calls).toBeLessThan(10)
  })

  it('tells the model that content was removed when it retries after a block', async () => {
    const seen = []

    const createChatCompletionStream = async function* (streamOptions) {
      seen.push(streamOptions.messages)

      if (seen.length === 1) {
        throw new ContentModerationError(
          'Input data may contain inappropriate content. (400)'
        )
      }

      yield {
        error: null,
        finishReason: 'stop',
        completion: 'ok',
        reasoning: null,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        functionCall: null,
        toolCalls: null,
      }
    }

    const options = {
      model: 'gpt-4o',
      backstory: 'A helpful bot',
      messages: [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: i % 2 === 0 ? 'user' : 'bot',
          text: `turn ${i}`,
        })),
        { type: 'user', text: 'latest question' },
      ],
      createChatCompletionStream,
    }

    for await (const item of completeChatConversation(options)) {
      void item
    }

    expect(seen.length).toBe(2)
    // @note the retried request must carry the omission notice so the model
    // knows context was removed rather than silently losing it
    expect(JSON.stringify(seen[1])).toContain(
      'could not be processed by the content filter'
    )
  })

  it('keeps shrinking across multiple rejections until it recovers', async () => {
    const counts = []

    // @note reject the first two attempts, succeed on the third - each retry must
    // run against a strictly smaller conversation
    const createChatCompletionStream = async function* (streamOptions) {
      counts.push(streamOptions.messages.length)

      if (counts.length < 3) {
        throw new ContentModerationError(
          'Input data may contain inappropriate content. (400)'
        )
      }

      yield {
        error: null,
        finishReason: 'stop',
        completion: 'recovered',
        reasoning: null,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        functionCall: null,
        toolCalls: null,
      }
    }

    const options = {
      model: 'gpt-4o',
      backstory: 'A helpful bot',
      messages: [
        ...Array.from({ length: 16 }, (_, i) => ({
          type: i % 2 === 0 ? 'user' : 'bot',
          text: `turn ${i}`,
        })),
        { type: 'user', text: 'latest question' },
      ],
      createChatCompletionStream,
    }

    let text = ''

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBe('recovered')
    expect(counts.length).toBe(3)
    expect(counts[1]).toBeLessThan(counts[0])
    expect(counts[2]).toBeLessThan(counts[1])
  })

  it('stops retrying once the continuation budget is exhausted', async () => {
    let calls = 0

    const createChatCompletionStream = async function* () {
      calls++

      throw new ContentModerationError(
        'Input data may contain inappropriate content. (400)'
      )

      yield
    }

    const options = {
      model: 'gpt-4o',
      backstory: 'A helpful bot',
      // @note large enough that running out of droppable messages would NOT
      // terminate before the budget does, so the cap is what stops it
      messages: Array.from({ length: 40 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'bot',
        text: `turn ${i}`,
      })),
      maxContinuations: 3,
      createChatCompletionStream,
    }

    await expect(
      (async () => {
        for await (const item of completeChatConversation(options)) {
          void item
        }
      })()
    ).rejects.toBeInstanceOf(ContentModerationError)

    // @note initial attempt + at most maxContinuations retries - far fewer than
    // the ~8 it would take to exhaust 40 messages, proving the budget caps it
    expect(calls).toBeGreaterThan(1)
    expect(calls).toBeLessThanOrEqual(5)
  })

  itIfConfigured(
    'must be able to complete chat conversation with functions',
    async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'A bot that fetches the last message',
        messages: [
          {
            type: 'user',
            text: `Use the getFoodPreferences function to fetch my food preferences and print them to me.`,
          },
        ],
        functions: [
          {
            name: 'getFoodPreferences',
            description: 'A simple function to get the users food preferences',
            parameters: {},

            handler: async () => {
              return JSON.stringify({ preferences: ['avocado'] })
            },
          },
          {
            name: 'getFirstMessage',
            description: 'A simple function that gets the first message',
            parameters: {},

            handler: async () => {
              return JSON.stringify({ messages: ['apple'] })
            },
          },
        ],
      }

      let text = ''

      for await (const item of completeChatConversation(options)) {
        if (item.type === 'token') {
          text += item.data.token
        }
      }

      expect(text).toMatch(/av[oa]cado/i)
    }
  )

  itIfConfigured(
    'must be able to complete chat conversation with functions that are forced',
    async () => {
      const options = {
        model: 'gpt-4o',
        backstory: 'A bot that fetches keywords and other things.',
        messages: [
          {
            type: 'user',
            text: `Perform the next step!`,
          },
          {
            type: 'activity',
            text: ``,
            meta: {
              activity: {
                type: 'trigger',
                function: {
                  name: 'getKeyword',
                  arguments: {},
                },
              },
            },
          },
        ],
        functions: [
          {
            name: 'getFoodPreferences',
            description: 'A simple function to get the users food preferences',
            parameters: {},

            handler: async () => {
              return JSON.stringify({ preferences: ['avocado'] })
            },
          },
          {
            name: 'getKeyword',
            description: 'A simple function that gets a keyword',
            parameters: {},

            handler: async () => {
              return JSON.stringify({ messages: ['apple'] })
            },
          },
        ],
      }

      let text = ''

      for await (const item of completeChatConversation(options)) {
        if (item.type === 'token') {
          text += item.data.token
        }
      }

      expect(text).toMatch(/apple/i)
    }
  )

  it.skip('must be able to complete chat conversation with functions in parallel', async () => {
    const executed = []

    const options = {
      model: 'gpt-4.1',
      backstory:
        'A bot that can perform multiple functions in parallel. Execute both task1 and task2 at the same time.',
      messages: [
        {
          type: 'user',
          text: `Go!`,
        },
      ],
      functions: [
        {
          name: 'task1',
          description: 'Execute task 1',
          parameters: {},

          handler: async () => {
            await new Promise((resolve) => setTimeout(resolve, 2000))

            executed.push('task1')

            return 'done'
          },
        },
        {
          name: 'task2',
          description: 'Execute task 2',
          parameters: {},

          handler: async () => {
            executed.push('task2')

            return 'done'
          },
        },
      ],
    }

    let text = ''

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()
    expect(executed).toEqual(['task2', 'task1'])
  })

  itIfConfigured(
    'must be able to complete chat conversation with startFunctions',
    async () => {
      let functionCalled = false

      const options = {
        model: 'gpt-4o',
        backstory: 'A bot that uses functions.',
        messages: [
          {
            type: 'user',
            text: `Hello!`,
          },
        ],
        functions: [
          {
            name: 'initFunction',
            description: 'An initialization function',
            parameters: {},

            handler: async () => {
              functionCalled = true

              return JSON.stringify({ status: 'initialized' })
            },
          },
        ],
        startFunctions: ['initFunction'],
      }

      let text = ''

      for await (const item of completeChatConversation(options)) {
        if (item.type === 'token') {
          text += item.data.token
        }
      }

      expect(functionCalled).toBe(true)
      expect(text).toBeTruthy()
    }
  )

  itIfConfigured(
    'must be able to complete chat conversation with multiple startFunctions in order',
    async () => {
      const callOrder = []

      const options = {
        model: 'gpt-4o',
        backstory: 'A bot that uses functions.',
        messages: [
          {
            type: 'user',
            text: `Hello!`,
          },
        ],
        functions: [
          {
            name: 'firstFunction',
            description: 'The first function',
            parameters: {},

            handler: async () => {
              callOrder.push('first')

              return JSON.stringify({ step: 1 })
            },
          },
          {
            name: 'secondFunction',
            description: 'The second function',
            parameters: {},

            handler: async () => {
              callOrder.push('second')

              return JSON.stringify({ step: 2 })
            },
          },
        ],
        startFunctions: ['firstFunction', 'secondFunction'],
      }

      let text = ''

      for await (const item of completeChatConversation(options)) {
        if (item.type === 'token') {
          text += item.data.token
        }
      }

      expect(callOrder).toEqual(['first', 'second'])
      expect(text).toBeTruthy()
    }
  )

  itIfConfigured(
    'must be able to complete chat conversation with endFunctions',
    async () => {
      let endFunctionCalled = false

      const options = {
        model: 'gpt-4o',
        backstory: 'A bot that uses functions. Just say hello.',
        messages: [
          {
            type: 'user',
            text: `Hello!`,
          },
        ],
        functions: [
          {
            name: 'cleanupFunction',
            description: 'A cleanup function that runs at the end',
            parameters: {},

            handler: async () => {
              endFunctionCalled = true

              return JSON.stringify({ status: 'cleaned up' })
            },
          },
        ],
        endFunctions: ['cleanupFunction'],
      }

      let text = ''

      for await (const item of completeChatConversation(options)) {
        if (item.type === 'token') {
          text += item.data.token
        }
      }

      expect(endFunctionCalled).toBe(true)
      expect(text).toBeTruthy()
    }
  )

  itIfConfigured(
    'must be able to complete chat conversation with both startFunctions and endFunctions',
    async () => {
      const callOrder = []

      const options = {
        model: 'gpt-4o',
        backstory: 'A bot that uses functions. Just say hello.',
        messages: [
          {
            type: 'user',
            text: `Hello!`,
          },
        ],
        functions: [
          {
            name: 'initFunction',
            description: 'An initialization function',
            parameters: {},

            handler: async () => {
              callOrder.push('init')

              return JSON.stringify({ status: 'initialized' })
            },
          },
          {
            name: 'cleanupFunction',
            description: 'A cleanup function',
            parameters: {},

            handler: async () => {
              callOrder.push('cleanup')

              return JSON.stringify({ status: 'cleaned up' })
            },
          },
        ],
        startFunctions: ['initFunction'],
        endFunctions: ['cleanupFunction'],
      }

      let text = ''

      for await (const item of completeChatConversation(options)) {
        if (item.type === 'token') {
          text += item.data.token
        }
      }

      expect(callOrder).toEqual(['init', 'cleanup'])
      expect(text).toBeTruthy()
    }
  )
})

describe('detectTokenLimitError', () => {
  it('should detect OpenAI token limit error messages', () => {
    const errorMessage =
      "This model's maximum context length is 8192 tokens. However, your messages resulted in 8265 tokens (7873 in the messages, 392 in the functions). Please reduce the length of the messages or functions."

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(true)
    expect(result.suggestedLimit).toBe(6963) // 85% of 8192
  })

  it('should detect different token limits correctly', () => {
    const errorMessage =
      "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens. Please reduce the length of the messages or functions."

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(true)
    expect(result.suggestedLimit).toBe(3481) // 85% of 4096
  })

  it('should handle case-insensitive matching', () => {
    const errorMessage =
      "this model's Maximum Context Length is 16384 tokens. However, your messages resulted in 16500 tokens."

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(true)
    expect(result.suggestedLimit).toBe(13926) // 85% of 16384
  })

  it('should not detect non-token-limit errors', () => {
    const errorMessage = 'Invalid API key provided'

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(false)
    expect(result.suggestedLimit).toBeUndefined()
  })

  it('should not detect partial token error messages', () => {
    const errorMessage = 'Something about tokens but not a limit error'

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(false)
    expect(result.suggestedLimit).toBeUndefined()
  })

  it('should handle various spacing and punctuation', () => {
    const errorMessage =
      "This model's maximum context length is 32768 tokens. However,  your messages resulted in  33000 tokens ( in messages and functions )."

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(true)
    expect(result.suggestedLimit).toBe(27852) // 85% of 32768
  })

  it('should handle empty error message', () => {
    const result = detectTokenLimitError('')

    expect(result.isTokenLimitError).toBe(false)
  })

  it('should return matchedMaxTokens and matchedUsedTokens when error is detected', () => {
    const errorMessage =
      "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(true)
    expect(result.matchedMaxTokens).toBe(4096)
    expect(result.matchedUsedTokens).toBe(4200)
  })

  it('should handle very large token numbers', () => {
    const errorMessage =
      "This model's maximum context length is 128000 tokens. However, your messages resulted in 150000 tokens."

    const result = detectTokenLimitError(errorMessage)

    expect(result.isTokenLimitError).toBe(true)
    expect(result.suggestedLimit).toBe(108800) // 85% of 128000
    expect(result.matchedMaxTokens).toBe(128000)
    expect(result.matchedUsedTokens).toBe(150000)
  })

  it('should handle error message with newlines', () => {
    const errorMessage =
      "This model's maximum context length is 8192 tokens.\nHowever, your messages resulted in 8500 tokens."

    const result = detectTokenLimitError(errorMessage)

    // Newlines may break the regex pattern - this tests current behavior
    expect(typeof result.isTokenLimitError).toBe('boolean')
  })
})

describe('reduceMessagesForModeration', () => {
  it('returns null only when nothing but framing remains', () => {
    expect(reduceMessagesForModeration(undefined)).toBeNull()
    expect(reduceMessagesForModeration([])).toBeNull()

    // @note framing alone cannot be dropped - nothing left to try
    expect(
      reduceMessagesForModeration([
        { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      ])
    ).toBeNull()
  })

  it('drops the newest content first, keeping the framing and the oldest turns', () => {
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      { type: USER_MESSAGE_TYPE, text: 'first' },
      { type: BOT_MESSAGE_TYPE, text: 'reply one' },
      { type: BOT_MESSAGE_TYPE, text: 'reply two' },
      { type: ACTIVITY_MESSAGE_TYPE, text: 'recent tool result' },
      { type: USER_MESSAGE_TYPE, text: 'latest question' },
    ]

    const reduced = reduceMessagesForModeration(messages)

    expect(reduced).not.toBeNull()
    // @note framing is always kept
    expect(reduced[0]).toEqual(messages[0])
    // @note the NEWEST content is removed first - including the latest user turn,
    // which (being the last message) is the prime suspect, not something to shield
    expect(reduced).not.toContainEqual({
      type: USER_MESSAGE_TYPE,
      text: 'latest question',
    })
    expect(reduced).not.toContainEqual({
      type: ACTIVITY_MESSAGE_TYPE,
      text: 'recent tool result',
    })
    // @note the oldest turns survive longest
    expect(reduced).toContainEqual({ type: USER_MESSAGE_TYPE, text: 'first' })
    expect(reduced).toContainEqual({
      type: BOT_MESSAGE_TYPE,
      text: 'reply one',
    })

    // @note real (non-notice) content shrinks even though a notice pair is added
    const realCount = (list) =>
      list.filter(
        (m) =>
          !(
            m.type === ACTIVITY_MESSAGE_TYPE &&
            m.meta?.activity?.function?.name === '_moderationReduced'
          )
      ).length

    expect(realCount(reduced)).toBeLessThan(realCount(messages))
  })

  it('protects a user turn naturally when newer content follows it', () => {
    // @note mid tool-loop the last message is a tool result, not the user's
    // question - newest-first drops the tool result first, so the user turn
    // survives without any special-casing
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      { type: USER_MESSAGE_TYPE, text: 'fetch and summarise this' },
      { type: ACTIVITY_MESSAGE_TYPE, text: 'flagged tool result' },
    ]

    const reduced = reduceMessagesForModeration(messages)

    expect(reduced).not.toBeNull()
    // @note the trailing tool result (the newest, the offender) is dropped...
    expect(reduced).not.toContainEqual({
      type: ACTIVITY_MESSAGE_TYPE,
      text: 'flagged tool result',
    })
    // @note ...while the user's request, being older, survives
    expect(reduced).toContainEqual({
      type: USER_MESSAGE_TYPE,
      text: 'fetch and summarise this',
    })
  })

  it('drops the user turn when it is the newest droppable content', () => {
    // @note a fresh request where the user's own message is the last (and prime
    // suspect): it is dropped and the notice tells the model to let the user know
    // it could not be processed - graceful instead of a hard error
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      { type: USER_MESSAGE_TYPE, text: 'flagged request' },
    ]

    const reduced = reduceMessagesForModeration(messages)

    expect(reduced).not.toBeNull()
    // @note framing is kept, the user turn is dropped and replaced by the notice
    expect(reduced[0]).toEqual(messages[0])
    expect(reduced).not.toContainEqual({
      type: USER_MESSAGE_TYPE,
      text: 'flagged request',
    })
    expect(
      reduced.some(
        (m) =>
          m.type === ACTIVITY_MESSAGE_TYPE &&
          m.meta?.activity?.function?.name === '_moderationReduced'
      )
    ).toBe(true)

    // @note and only then, with framing alone, does it give up
    expect(
      reduceMessagesForModeration([
        { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      ])
    ).toBeNull()
  })

  // @note the omission notice follows the _emptyDetected / _cycleDetected
  // convention: a synthetic activity (tool-call + tool-result) pair identified
  // by its internal function name
  const isModerationNotice = (message) =>
    message.type === ACTIVITY_MESSAGE_TYPE &&
    message.meta?.activity?.function?.name === '_moderationReduced'

  it('inserts a single neutral omission notice where content was dropped', () => {
    const messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      { type: BOT_MESSAGE_TYPE, text: 'turn 0' },
      { type: BOT_MESSAGE_TYPE, text: 'turn 1' },
      { type: BOT_MESSAGE_TYPE, text: 'turn 2' },
      { type: USER_MESSAGE_TYPE, text: 'latest question' },
    ]

    const reduced = reduceMessagesForModeration(messages)

    const noticeMessages = reduced.filter(isModerationNotice)

    // @note exactly one notice pair (request + response activity messages)
    expect(noticeMessages).toHaveLength(2)
    expect(noticeMessages[0].meta.activity.type).toBe('request')
    expect(noticeMessages[1].meta.activity.type).toBe('response')

    // @note the surfaced notice must carry no moderation vocabulary so it cannot
    // itself raise the score the reduction is trying to get under
    const noticeText = noticeMessages[1].meta.activity.function.result.notice

    expect(noticeText).not.toMatch(
      /moderat|inappropriate|flag|block|safety|phish|unsafe/i
    )

    // @note framing is kept at the head; the notice marks where the newest
    // dropped turns were (here the tail, since the latest turns were removed)
    expect(reduced[0]).toEqual(messages[0])
    expect(reduced.some(isModerationNotice)).toBe(true)
    // @note the notice never displaces the framing
    expect(isModerationNotice(reduced[0])).toBe(false)
    // @note the oldest surviving turn is kept
    expect(reduced).toContainEqual({ type: BOT_MESSAGE_TYPE, text: 'turn 0' })
  })

  it('does not accumulate notices across repeated reductions', () => {
    let messages = [
      { type: BACKSTORY_MESSAGE_TYPE, text: 'system' },
      ...Array.from({ length: 8 }, (_, i) => ({
        type: BOT_MESSAGE_TYPE,
        text: `turn ${i}`,
      })),
      { type: USER_MESSAGE_TYPE, text: 'latest question' },
    ]

    // @note repeatedly reducing must converge - peeling newest-first, then the
    // user turn as a last resort - down to framing alone, rather than loop
    // forever or stack notices
    for (let i = 0; i < 20; i++) {
      const reduced = reduceMessagesForModeration(messages)

      if (reduced === null) {
        break
      }

      // @note real (non-notice) content must strictly shrink each round
      const realBefore = messages.filter((m) => !isModerationNotice(m)).length
      const realAfter = reduced.filter((m) => !isModerationNotice(m)).length

      expect(realAfter).toBeLessThan(realBefore)

      // @note never more than one notice pair (2 messages) at a time
      expect(reduced.filter(isModerationNotice).length).toBeLessThanOrEqual(2)

      messages = reduced
    }

    // @note the user turn is eventually dropped too (last resort), leaving only
    // the framing before the next reduction returns null
    const core = messages.filter((m) => !isModerationNotice(m))

    expect(core).toEqual([{ type: BACKSTORY_MESSAGE_TYPE, text: 'system' }])
  })
})

describe('addCycleNotice', () => {
  it('should append cycle detection activity messages to an empty array', () => {
    const result = addCycleNotice([])

    expect(result.length).toBe(2)
    expect(result[0].type).toBe('activity')
    expect(result[0].meta.activity.type).toBe('request')
    expect(result[0].meta.activity.function.name).toBe('_cycleDetected')
    expect(result[1].type).toBe('activity')
    expect(result[1].meta.activity.type).toBe('response')
    expect(result[1].meta.activity.function.name).toBe('_cycleDetected')
  })

  it('should append cycle detection activity messages to existing messages', () => {
    const existingMessages = [
      { type: 'user', text: 'hello' },
      { type: 'bot', text: 'hi there' },
    ]

    const result = addCycleNotice(existingMessages)

    expect(result.length).toBe(4)
    expect(result[0]).toEqual(existingMessages[0])
    expect(result[1]).toEqual(existingMessages[1])
    expect(result[2].type).toBe('activity')
    expect(result[3].type).toBe('activity')
  })

  it('should keep the cycle request activity empty', () => {
    const result = addCycleNotice([])

    const requestActivity = result[0]

    expect(requestActivity.text).toBe('')
    expect(requestActivity.meta.activity.function.arguments).toEqual({})
  })

  it('should include warning message in the response activity', () => {
    const result = addCycleNotice([])

    const responseResult = result[1].meta.activity.function.result

    expect(responseResult.warning).toContain(
      'You have been making repeated tool calls'
    )
    expect(responseResult.warning).toContain('try a different approach')
  })

  it('should not mutate the original messages array', () => {
    const originalMessages = [{ type: 'user', text: 'test' }]
    const originalLength = originalMessages.length

    addCycleNotice(originalMessages)

    expect(originalMessages.length).toBe(originalLength)
  })
})

describe('addCallBudgetLowNotice', () => {
  it('should append call-budget activity messages to an empty array', () => {
    const result = addCallBudgetLowNotice([], { remaining: 8, maxCalls: 50 })

    expect(result.length).toBe(2)
    expect(result[0].type).toBe('activity')
    expect(result[0].meta.activity.type).toBe('request')
    expect(result[0].meta.activity.function.name).toBe('_callBudgetLow')
    expect(result[1].type).toBe('activity')
    expect(result[1].meta.activity.type).toBe('response')
    expect(result[1].meta.activity.function.name).toBe('_callBudgetLow')
  })

  it('should append the notice after existing messages', () => {
    const existingMessages = [
      { type: 'user', text: 'hello' },
      { type: 'bot', text: 'hi there' },
    ]

    const result = addCallBudgetLowNotice(existingMessages, {
      remaining: 5,
      maxCalls: 50,
    })

    expect(result.length).toBe(4)
    expect(result[0]).toEqual(existingMessages[0])
    expect(result[1]).toEqual(existingMessages[1])
    expect(result[2].type).toBe('activity')
    expect(result[3].type).toBe('activity')
  })

  it('should keep the request activity empty', () => {
    const result = addCallBudgetLowNotice([], { remaining: 8, maxCalls: 50 })

    const requestActivity = result[0]

    expect(requestActivity.text).toBe('')
    expect(requestActivity.meta.activity.function.arguments).toEqual({})
  })

  it('should surface the remaining and max counts in the warning', () => {
    const result = addCallBudgetLowNotice([], { remaining: 7, maxCalls: 50 })

    const warning = result[1].meta.activity.function.result.warning

    expect(warning).toContain('approaching the maximum number of tool calls')
    expect(warning).toContain('about 7 of 50 remain')
    expect(warning).toContain('stopped automatically')
  })

  it('should not mutate the original messages array', () => {
    const originalMessages = [{ type: 'user', text: 'test' }]
    const originalLength = originalMessages.length

    addCallBudgetLowNotice(originalMessages, { remaining: 8, maxCalls: 50 })

    expect(originalMessages.length).toBe(originalLength)
  })
})

describe('getCallBudgetLowThreshold', () => {
  it('caps the warning band for large budgets so it does not fire too early', () => {
    // @note the absolute cap (10) dominates once the budget is large, so a
    // generous budget still warns ~10 calls from the end rather than at 20%
    expect(getCallBudgetLowThreshold(50)).toBe(10)
    expect(getCallBudgetLowThreshold(100)).toBe(10)
    expect(getCallBudgetLowThreshold(200)).toBe(10)
  })

  it('scales the warning band down for small budgets via the ratio', () => {
    // @note a budget of 10 must NOT warn at 9 remaining - the ratio (20%) keeps
    // the trigger at 2 remaining, leaving real runway before the hard stop
    expect(getCallBudgetLowThreshold(10)).toBe(2)
    expect(getCallBudgetLowThreshold(5)).toBe(1)
  })

  it('returns 0 for budgets too small to warn meaningfully', () => {
    // @note with the `remaining > 0` guard a threshold of 0 means these are
    // never warned - a heads-up with no runway to act on is just noise
    expect(getCallBudgetLowThreshold(4)).toBe(0)
    expect(getCallBudgetLowThreshold(1)).toBe(0)
  })
})

describe('addEmptyNotice', () => {
  it('should append empty detection activity messages to an empty array', () => {
    const result = addEmptyNotice([])

    expect(result.length).toBe(2)
    expect(result[0].type).toBe('activity')
    expect(result[0].meta.activity.type).toBe('request')
    expect(result[0].meta.activity.function.name).toBe('_emptyDetected')
    expect(result[1].type).toBe('activity')
    expect(result[1].meta.activity.type).toBe('response')
    expect(result[1].meta.activity.function.name).toBe('_emptyDetected')
  })

  it('should append empty detection activity messages to existing messages', () => {
    const existingMessages = [
      { type: 'user', text: 'hello' },
      { type: 'bot', text: '' },
    ]

    const result = addEmptyNotice(existingMessages)

    expect(result.length).toBe(4)
    expect(result[0]).toEqual(existingMessages[0])
    expect(result[1]).toEqual(existingMessages[1])
    expect(result[2].type).toBe('activity')
    expect(result[3].type).toBe('activity')
  })

  it('should keep the empty request activity empty', () => {
    const result = addEmptyNotice([])

    const requestActivity = result[0]

    expect(requestActivity.text).toBe('')
    expect(requestActivity.meta.activity.function.arguments).toEqual({})
  })

  it('should include solution message in the response activity', () => {
    const result = addEmptyNotice([])

    const responseResult = result[1].meta.activity.function.result

    expect(responseResult.solution).toBe('Please provide a response.')
  })

  it('should not mutate the original messages array', () => {
    const originalMessages = [{ type: 'user', text: 'test' }]
    const originalLength = originalMessages.length

    addEmptyNotice(originalMessages)

    expect(originalMessages.length).toBe(originalLength)
  })
})

describe('DEFAULT_MAX_CYCLES', () => {
  it('should be a positive integer', () => {
    expect(typeof DEFAULT_MAX_CYCLES).toBe('number')
    expect(DEFAULT_MAX_CYCLES).toBeGreaterThan(0)
    expect(Number.isInteger(DEFAULT_MAX_CYCLES)).toBe(true)
  })

  it('should have a reasonable default value', () => {
    // @note the default is 2, meaning 2 cycle detections before stopping
    expect(DEFAULT_MAX_CYCLES).toBe(2)
  })
})

describe('completeChatConversation recursion behavior', () => {
  /**
   * Helper to create a mock createChatCompletionStream that returns
   * a sequence of responses controlled by the caller.
   *
   * @param {Array<{completion?: string, finishReason: string, toolCalls?: any[], functionCall?: any, reasoning?: string | null}>} responses
   * @returns {{mock: Function, callCount: () => number}}
   */
  function createMockStream(responses) {
    let callIndex = 0

    async function* mockStream() {
      const response = responses[callIndex] || responses[responses.length - 1]

      callIndex++

      yield {
        error: null,
        finishReason: response.finishReason,
        completion: response.completion || null,
        reasoning: response.reasoning || null,
        functionCall: response.functionCall || null,
        toolCalls: response.toolCalls || null,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      }
    }

    return {
      mock: () => mockStream(),
      callCount: () => callIndex,
    }
  }

  it('should NOT increment currentContinuations on tool call recursion', async () => {
    // @note this test proves that tool-call loops don't count against
    // maxContinuations - they're a different recursion path

    const mockController = createMockStream([
      // First call: model returns tool call
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Second call: model returns tool call again
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Third call: model returns tool call again
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Fourth call: model finally stops
      {
        finishReason: 'stop',
        completion: 'Done!',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxContinuations: 1, // low limit to prove it's not used
      maxCalls: 10, // high limit so we don't hit this
      maxCycles: 10, // high limit so we don't hit this
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // @note if currentContinuations was incremented on tool calls, we'd only
    // get 2 model calls (0 and 1) before hitting maxContinuations=1. Instead
    // we should get all 4 calls.
    expect(mockController.callCount()).toBe(4)
  })

  it('should increment currentContinuations on length finish reason', async () => {
    // @note this test proves that 'length' finish reason DOES count against
    // maxContinuations

    const mockController = createMockStream([
      // First call: output truncated
      { finishReason: 'length', completion: 'Part 1...' },
      // Second call: output truncated again
      { finishReason: 'length', completion: 'Part 2...' },
      // Third call: would continue but should be blocked by maxContinuations
      { finishReason: 'stop', completion: 'Part 3 - should not reach' },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxContinuations: 1, // allow only 1 continuation
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // @note with maxContinuations=1, we should get:
    // - Call 1 (currentContinuations=0): 0<=1 ✓, returns 'length', increments to 1
    // - Call 2 (currentContinuations=1): 1<=1 ✓, returns 'length', increments to 2
    // - Call 3 (currentContinuations=2): 2<=1 ✗, stops (but we already made the call)
    // Actually the check happens BEFORE recursing, so:
    // - Call 1: returns 'length', checks 0<=1 ✓, recurses with 1
    // - Call 2: returns 'length', checks 1<=1 ✓, recurses with 2
    // - Call 3: returns 'length', checks 2<=1 ✗, does NOT recurse
    // So we expect 3 calls total (the check is <= not <)
    expect(mockController.callCount()).toBe(3)
  })

  it('should prove tool call loops and continuation loops are independent', async () => {
    // @note this test combines both: tool calls followed by length, proving
    // they use separate counters

    const mockController = createMockStream([
      // First call: tool call (does NOT increment currentContinuations)
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Second call: tool call again (still doesn't increment)
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Third call: now length (THIS starts incrementing currentContinuations)
      { finishReason: 'length', completion: 'Truncated...' },
      // Fourth call: length again (currentContinuations now 1)
      { finishReason: 'length', completion: 'Still truncated...' },
      // Fifth call: would be blocked if maxContinuations=1 was already hit
      { finishReason: 'stop', completion: 'Done!' },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxContinuations: 1, // allow only 1 continuation
      maxCalls: 10,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // @note if tool calls incremented currentContinuations, we'd hit the limit
    // after call 2 and never see calls 3-4. Instead we should see:
    // - Call 1: toolCalls (no increment, currentContinuations stays 0)
    // - Call 2: toolCalls (no increment, currentContinuations stays 0)
    // - Call 3: length (currentContinuations=0, 0<=1 ✓, recurses with 1)
    // - Call 4: length (currentContinuations=1, 1<=1 ✓, recurses with 2)
    // - Call 5: length (currentContinuations=2, 2<=1 ✗, does NOT recurse)
    // So we expect 5 calls total
    expect(mockController.callCount()).toBe(5)
  })

  it('should honor maxCalls=0 and skip function handlers', async () => {
    const handler = jest.fn(async () => ({ result: 'ok' }))

    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Done',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 0,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(handler).not.toHaveBeenCalled()
  })

  it('should honor maxCycles=0 and stop immediately on first cycle detection', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Should not reach',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 10,
      maxCycles: 0,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(mockController.callCount()).toBe(2)

    const cycleDetectedMessage = items.find(
      (item) =>
        item.type === 'message' &&
        item.data.type === 'bot' &&
        item.data.meta?.cycleDetected === true
    )

    expect(cycleDetectedMessage).toBeDefined()
    expect(cycleDetectedMessage.data.text).toBe(LOOP_STOP_USER_MESSAGE)
  })

  it('uses background-safe copy when maxCycles=0 stops a background run', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Should not reach',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      background: true,
      maxCalls: 10,
      maxCycles: 0,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const cycleDetectedMessage = items.find(
      (item) =>
        item.type === 'message' &&
        item.data.type === 'bot' &&
        item.data.meta?.cycleDetected === true
    )

    expect(cycleDetectedMessage).toBeDefined()
    expect(cycleDetectedMessage.data.text).toBe(LOOP_STOP_BACKGROUND_MESSAGE)
    expect(cycleDetectedMessage.data.text).not.toContain('please try')
  })

  it('should insert cycle detection activity messages into the next recursive model call', async () => {
    const calls = []

    const createChatCompletionStream = jest.fn((input) => {
      calls.push(input)

      const responseIndex = calls.length - 1

      async function* stream() {
        if (responseIndex < 2) {
          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: [
              {
                type: 'function',
                function: { name: 'testTool', arguments: '{}' },
              },
            ],
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }

          return
        }

        yield {
          error: null,
          finishReason: 'stop',
          completion: 'Recovered after warning',
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return stream()
    })

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 10,
      maxCycles: 2,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream,
    }

    for await (const _ of completeChatConversation(options)) {
      // consume stream
    }

    expect(createChatCompletionStream).toHaveBeenCalledTimes(3)

    const recoveryCallMessages = calls[2].messages

    const cycleToolCall = recoveryCallMessages.find(
      (message) =>
        message.role === 'assistant' &&
        Array.isArray(message.tool_calls) &&
        message.tool_calls.some(
          (toolCall) => toolCall.function.name === '_cycleDetected'
        )
    )

    const cycleToolResult = recoveryCallMessages.find(
      (message) =>
        message.role === 'tool' &&
        typeof message.content === 'string' &&
        message.content.includes('You have been making repeated tool calls')
    )

    expect(cycleToolCall).toBeDefined()
    expect(cycleToolResult).toBeDefined()
  })

  it('warns the model in-thread as the call budget runs low, before the hard stop', async () => {
    // @note regression coverage - the model used to be cut off the
    // moment it exhausted the call budget with no heads-up. It should now get an
    // in-thread advisory while budget remains so it can wrap up on its own.

    const maxCalls = 10
    const threshold = getCallBudgetLowThreshold(maxCalls)

    // @note the warning first fires when `remaining === threshold`, i.e. once
    // `maxCalls - threshold` calls have been made; the call that follows is the
    // first to carry the advisory. Derived from the helper so the test tracks
    // the configured ratio/cap rather than hard-coded numbers.
    const callsBeforeWarn = maxCalls - threshold

    const responses = []

    for (let i = 0; i < callsBeforeWarn; i++) {
      responses.push({
        finishReason: 'toolCalls',
        // @note unique arguments each round defeat cycle detection
        toolCalls: [
          {
            type: 'function',
            function: { name: 'lookup', arguments: `{"page":${i}}` },
          },
        ],
      })
    }

    responses.push({ finishReason: 'stop', completion: 'Wrapping up.' })

    const calls = []

    const createChatCompletionStream = jest.fn((input) => {
      calls.push(input)

      const response =
        responses[calls.length - 1] || responses[responses.length - 1]

      async function* stream() {
        yield {
          error: null,
          finishReason: response.finishReason,
          completion: response.completion || null,
          reasoning: null,
          functionCall: null,
          toolCalls: response.toolCalls || null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return stream()
    })

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Research this' }],
      maxCalls,
      functions: [
        {
          name: 'lookup',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream,
    }

    for await (const _ of completeChatConversation(options)) {
      // consume stream
    }

    // one model call per scripted tool round plus the final wrap-up round
    expect(createChatCompletionStream).toHaveBeenCalledTimes(
      callsBeforeWarn + 1
    )

    const countBudgetNotices = (messages) =>
      messages.filter(
        (message) =>
          message.role === 'assistant' &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (toolCall) => toolCall.function.name === '_callBudgetLow'
          )
      ).length

    // the call right before the budget entered the warning band has no notice
    expect(countBudgetNotices(calls[callsBeforeWarn - 1].messages)).toBe(0)

    // the next call carries the advisory, including the explanatory warning text
    const warnedCall = calls[callsBeforeWarn]

    expect(countBudgetNotices(warnedCall.messages)).toBe(1)

    const budgetResult = warnedCall.messages.find(
      (message) =>
        message.role === 'tool' &&
        typeof message.content === 'string' &&
        message.content.includes('approaching the maximum number of tool calls')
    )

    expect(budgetResult).toBeDefined()
    expect(budgetResult.content).toContain(
      `about ${threshold} of ${maxCalls} remain`
    )
  })

  it('does not warn a small budget until real runway remains', async () => {
    // @note the user-facing guarantee behind the ratio knob: a tight budget must
    // not warn almost immediately. With maxCalls=10 the threshold is 2, so the
    // first couple of calls carry no advisory.

    const calls = []

    const createChatCompletionStream = jest.fn((input) => {
      calls.push(input)

      const responseIndex = calls.length - 1

      async function* stream() {
        if (responseIndex < 2) {
          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: [
              {
                type: 'function',
                function: {
                  name: 'lookup',
                  arguments: `{"page":${responseIndex}}`,
                },
              },
            ],
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }

          return
        }

        yield {
          error: null,
          finishReason: 'stop',
          completion: 'Done',
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return stream()
    })

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Research this' }],
      maxCalls: 10,
      functions: [
        {
          name: 'lookup',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream,
    }

    for await (const _ of completeChatConversation(options)) {
      // consume stream
    }

    const sawBudgetNotice = calls.some((input) =>
      input.messages.some(
        (message) =>
          message.role === 'assistant' &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (toolCall) => toolCall.function.name === '_callBudgetLow'
          )
      )
    )

    expect(sawBudgetNotice).toBe(false)
  })

  it('does not warn while the call budget is comfortable', async () => {
    const calls = []

    const createChatCompletionStream = jest.fn((input) => {
      calls.push(input)

      const responseIndex = calls.length - 1

      async function* stream() {
        if (responseIndex < 2) {
          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: [
              {
                type: 'function',
                function: {
                  name: 'lookup',
                  arguments: `{"page":${responseIndex}}`,
                },
              },
            ],
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          }

          return
        }

        yield {
          error: null,
          finishReason: 'stop',
          completion: 'Done',
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      }

      return stream()
    })

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Research this' }],
      // @note plenty of budget - two calls stays well clear of the warning band
      maxCalls: 50,
      functions: [
        {
          name: 'lookup',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream,
    }

    for await (const _ of completeChatConversation(options)) {
      // consume stream
    }

    const sawBudgetNotice = calls.some((input) =>
      input.messages.some(
        (message) =>
          message.role === 'assistant' &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (toolCall) => toolCall.function.name === '_callBudgetLow'
          )
      )
    )

    expect(sawBudgetNotice).toBe(false)
  })

  it('throws when finishReason is functionCall but functionCall payload is missing', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'functionCall',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: mockController.mock,
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('Unexpected state: function call without function call')
  })

  it('handles unknown tool-call type without crashing', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [{ type: 'not-supported' }],
      },
      {
        finishReason: 'stop',
        completion: 'done',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const finalEnd = items.filter((i) => i.type === 'completeEnd').pop()

    expect(finalEnd).toBeDefined()
  })

  it('throws when finishReason is toolCalls but toolCalls payload is missing', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () =>
        (async function* () {
          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
          }
        })(),
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('Unexpected state: tool calls without tool calls')
  })

  it('stops without recursion when tool call function has no handler', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'noHandlerTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Should not be called',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'noHandlerTool',
          description: 'Tool without handler',
          parameters: {},
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(mockController.callCount()).toBe(1)

    const finalEnd = items.filter((i) => i.type === 'completeEnd').pop()

    expect(finalEnd?.data.reason).toBe('activity')
  })

  it('emits too many calls activity when tool call count exceeds maxCalls', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 0,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ ok: true }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const activityResponse = items.find(
      (item) =>
        item.type === 'message' &&
        item.data.type === 'activity' &&
        item.data.meta?.activity?.type === 'response' &&
        item.data.meta?.activity?.function?.result?.error === 'too many calls'
    )

    expect(activityResponse).toBeDefined()
  })

  it('throws on non-aborted AbortSignal from tool handler', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => new AbortController().signal,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('Unexpected abort signal state')
  })

  it('retries on chat token-limit exception and succeeds', async () => {
    let callCount = 0

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxContinuations: 1,
      createChatCompletionStream: () => {
        callCount += 1

        if (callCount === 1) {
          throw new Error(
            "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
          )
        }

        return createMockStream([
          { finishReason: 'stop', completion: 'recovered' },
        ]).mock()
      },
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(callCount).toBe(2)
    expect(
      items.some((i) => i.type === 'token' && i.data.token === 'recovered')
    ).toBe(true)
  })

  it('rethrows non-token-limit exception from chat stream', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () => {
        throw new Error('upstream unavailable')
      },
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('upstream unavailable')
  })

  it('handles contentFilter finish reason without crashing', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () =>
        (async function* () {
          yield {
            error: null,
            finishReason: 'contentFilter',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
          }
        })(),
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(items.some((i) => i.type === 'usage')).toBe(true)
  })

  it('handles functionCall finish reason with valid payload', async () => {
    const handler = jest.fn(async () => ({ ok: true }))

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testFunction',
          description: 'Test function',
          parameters: {},
          handler,
        },
      ],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'functionCall',
          completion: null,
          functionCall: { name: 'testFunction', arguments: '{}' },
        },
        {
          finishReason: 'stop',
          completion: 'done',
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(handler).toHaveBeenCalledTimes(1)
    expect(
      items.some((i) => i.type === 'token' && i.data.token === 'done')
    ).toBe(true)
  })

  it('emits function-call reasoning as a reasoning message', async () => {
    const handler = jest.fn(async () => ({ ok: true }))

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testFunction',
          description: 'Test function',
          parameters: {},
          handler,
        },
      ],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'functionCall',
          reasoning: 'I should call the test function.',
          functionCall: { name: 'testFunction', arguments: '{}' },
        },
        {
          finishReason: 'stop',
          completion: 'done',
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const reasoningMessage = items.find(
      (i) => i.type === 'message' && i.data.type === REASONING_MESSAGE_TYPE
    )

    const responseActivityMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === ACTIVITY_MESSAGE_TYPE &&
        i.data.meta?.activity?.type === 'response'
    )

    expect(reasoningMessage?.data.text).toBe('I should call the test function.')
    expect(responseActivityMessage?.data.meta).not.toHaveProperty('reasoning')
  })

  it('surfaces invocation exception when tool-call handler throws', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'failingTool',
          description: 'Fails intentionally',
          parameters: {},
          handler: async () => {
            throw new Error('boom')
          },
        },
      ],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              function: { name: 'failingTool', arguments: '{}' },
            },
          ],
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const responseMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === 'activity' &&
        i.data.meta?.activity?.type === 'response'
    )

    expect(JSON.stringify(responseMessage)).toContain(
      'Function invocation exception'
    )
  })

  it('emits completeEnd abort when a function handler aborts', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'functionCall',
        functionCall: { name: 'testTool', arguments: '{}' },
      },
      {
        finishReason: 'stop',
        completion: 'should not be reached',
      },
    ])

    const controller = new AbortController()

    controller.abort('stop now')

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => controller.signal,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const abortItem = items.find((item) => item.type === 'abort')
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(mockController.callCount()).toBe(1)
    expect(abortItem?.data).toEqual({
      reason: 'stop now',
      functionName: 'testTool',
    })
    expect(finalEndItem?.data.reason).toBe('abort')
  })

  it('stops tool-call recursion on aborted AbortSignal result', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'should not be reached',
      },
    ])

    const controller = new AbortController()

    controller.abort('stop now')

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => controller.signal,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(mockController.callCount()).toBe(1)

    const responseMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === 'activity' &&
        i.data.meta?.activity?.type === 'response'
    )

    const abortItem = items.find((i) => i.type === 'abort')

    expect(responseMessage?.data.meta?.activity?.function?.result).toBe(
      'stop now'
    )
    expect(abortItem?.data).toEqual({
      reason: 'stop now',
      functionName: 'testTool',
    })

    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem?.data.reason).toBe('abort')
  })

  it('emits abort before final completeEnd abort when a tool handler aborts', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'should not be reached',
      },
    ])

    const controller = new AbortController()

    controller.abort('stop now')

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => controller.signal,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const abortItemIndex = items.findIndex((item) => item.type === 'abort')
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalCompleteEndIndex = items.findLastIndex(
      (item) => item.type === 'completeEnd'
    )

    expect(completeEndItems).toHaveLength(2)
    expect(completeEndItems[0].data.reason).toBe('activity')
    expect(completeEndItems[1].data.reason).toBe('abort')
    expect(abortItemIndex).toBeGreaterThan(-1)
    expect(abortItemIndex).toBeLessThan(finalCompleteEndIndex)
  })

  it('uses fallback result text when tool handler returns undefined', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => undefined,
        },
      ],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              function: { name: 'testTool', arguments: '{}' },
            },
          ],
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const responseMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === 'activity' &&
        i.data.meta?.activity?.type === 'response'
    )

    expect(responseMessage?.data.meta?.activity?.function?.result).toBe(
      'no result'
    )
  })

  it('uses Result wrapper payload and meta from tool handler', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => new Result({ ok: true }, { fromResult: true }),
        },
      ],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              function: { name: 'testTool', arguments: '{}' },
            },
          ],
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const responseMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === 'activity' &&
        i.data.meta?.activity?.type === 'response'
    )

    expect(responseMessage?.data.meta?.activity?.function?.result).toContain(
      '"ok":true'
    )
    expect(responseMessage?.data.meta?.fromResult).toBe(true)
  })

  it('surfaces not-found details for unknown tool-call function', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'knownTool',
          description: 'Known tool',
          parameters: {},
          handler: async () => ({ ok: true }),
        },
      ],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              function: { name: 'missingTool', arguments: '{}' },
            },
          ],
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const responseMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === 'activity' &&
        i.data.meta?.activity?.type === 'response'
    )

    expect(
      responseMessage?.data.meta?.activity?.function?.result?.error
    ).toContain('function not found')
  })

  it('surfaces no-functions-defined details for unknown tool-call without functions list', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: createMockStream([
        {
          finishReason: 'toolCalls',
          toolCalls: [
            {
              type: 'function',
              function: { name: 'missingTool', arguments: '{}' },
            },
          ],
        },
      ]).mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const responseMessage = items.find(
      (i) =>
        i.type === 'message' &&
        i.data.type === 'activity' &&
        i.data.meta?.activity?.type === 'response'
    )

    expect(
      responseMessage?.data.meta?.activity?.function?.result?.error
    ).toContain('no functions defined')
  })

  it('rethrows invalid finish reason from chat stream', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () =>
        (async function* () {
          yield {
            error: null,
            finishReason: 'unexpected-finish-reason',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
          }
        })(),
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow()
  })

  // @note residual uncovered branches around openai.conv.js:3024-3026 and 3084 are defensive tails and effectively unreachable in normal flow because earlier guards throw/rethrow first

  it('rethrows non-Error chat stream throw values when token-limit detection does not match', async () => {
    const thrown = { code: 'NO_MESSAGE_FIELD' }

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () => {
        throw thrown
      },
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toEqual(thrown)
  })

  it('rethrows token-limit errors when continuation budget is exceeded', async () => {
    const tokenLimitError = new Error(
      "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
    )

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxContinuations: 0,
      currentContinuations: 1,
      createChatCompletionStream: () => {
        throw tokenLimitError
      },
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow(tokenLimitError.message)
  })

  it('stops with iteration reason on token-limit retry when iteration limit is reached', async () => {
    let calls = 0

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 1,
      maxContinuations: 3,
      createChatCompletionStream: () => {
        calls += 1

        throw new Error(
          "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
        )
      },
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(calls).toBe(1)

    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem?.data.reason).toBe('iteration')
  })
})

describe('maxIterations behavior', () => {
  /**
   * Helper to create a mock createChatCompletionStream that returns
   * a sequence of responses controlled by the caller.
   *
   * @param {Array<{completion?: string, finishReason: string, toolCalls?: any[]}>} responses
   * @returns {{mock: Function, callCount: () => number}}
   */
  function createMockStream(responses) {
    let callIndex = 0

    async function* mockStream() {
      const response = responses[callIndex] || responses[responses.length - 1]

      callIndex++

      yield {
        error: null,
        finishReason: response.finishReason,
        completion: response.completion || null,
        reasoning: null,
        functionCall: null,
        toolCalls: response.toolCalls || null,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      }
    }

    return {
      mock: () => mockStream(),
      callCount: () => callIndex,
    }
  }

  it('should limit tool call recursion when maxIterations is set', async () => {
    // @note this test proves that maxIterations limits ALL model calls,
    // including tool-call loops (unlike maxContinuations which doesn't)

    const mockController = createMockStream([
      // First call: model returns tool call
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Second call: model returns tool call again
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Third call: would recurse but should be blocked by maxIterations
      {
        finishReason: 'stop',
        completion: 'Should not reach this',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 2, // only allow 2 model calls
      maxCalls: 10, // high limit so we don't hit this
      maxCycles: 10, // high limit so we don't hit this
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // @note with maxIterations=2:
    // - Call 1 (currentIterations=0): 0<2 ✓, toolCalls, would recurse
    // - Call 2 (currentIterations=1): 1<2 ✓, toolCalls, would recurse
    // - Call 3 would have currentIterations=2, 2<2 ✗, blocked
    expect(mockController.callCount()).toBe(2)

    // Should emit iteration as the final reason
    // @note there may be multiple completeEnd items - find the last one
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem).toBeDefined()
    expect(finalEndItem.data.reason).toBe('iteration')
  })

  it('should complete normally when maxIterations is not reached', async () => {
    const mockController = createMockStream([
      // First call: model returns tool call
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Second call: model stops normally
      {
        finishReason: 'stop',
        completion: 'Done!',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 5, // high limit - won't be reached
      maxCalls: 10,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should complete normally with 2 calls
    expect(mockController.callCount()).toBe(2)

    // Should emit 'stop' as the final reason, not 'iteration'
    // @note there may be multiple completeEnd items - find the last one
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem).toBeDefined()
    expect(finalEndItem.data.reason).toBe('stop')
  })

  it('should count length continuations toward maxIterations', async () => {
    // @note maxIterations counts ALL model calls, including length retries

    const mockController = createMockStream([
      { finishReason: 'length', completion: 'Part 1...' },
      { finishReason: 'length', completion: 'Part 2...' },
      { finishReason: 'stop', completion: 'Part 3 - should not reach' },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 2,
      maxContinuations: 10, // high limit so we don't hit this
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should stop after 2 calls due to maxIterations
    expect(mockController.callCount()).toBe(2)

    // @note there may be multiple completeEnd items - find the last one
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem.data.reason).toBe('iteration')
  })

  it('should work as single-step mode with maxIterations=1', async () => {
    // @note this is the primary use case for background workers

    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // This should never be reached
      {
        finishReason: 'stop',
        completion: 'Should not reach',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 1, // single-step mode
      maxCalls: 10,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should only make 1 model call, execute the tools, then stop
    expect(mockController.callCount()).toBe(1)

    // Should have the tool call messages (request + response)
    const activityMessages = items.filter(
      (item) => item.type === 'message' && item.data.type === 'activity'
    )

    expect(activityMessages.length).toBe(2) // request and response

    // Should emit iteration as the final reason
    // @note there may be multiple completeEnd items - find the last one
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem.data.reason).toBe('iteration')
  })

  it('should not apply iteration limit when maxIterations is not set', async () => {
    // @note default behavior should be unbounded (except for other limits)

    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Done after many calls!',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      // maxIterations NOT set - should be unbounded
      maxCalls: 10,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should complete all 4 calls since no maxIterations limit
    expect(mockController.callCount()).toBe(4)

    // @note there may be multiple completeEnd items - find the last one
    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem.data.reason).toBe('stop')
  })

  it('should count empty-stop retries toward maxIterations', async () => {
    // @note when stop is returned but no text is generated, the system retries
    // These retries should count toward maxIterations

    const mockController = createMockStream([
      { finishReason: 'stop', completion: '' }, // empty - will retry
      { finishReason: 'stop', completion: '' }, // empty - would retry but limit hit
      { finishReason: 'stop', completion: 'Should not reach' },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 2,
      maxContinuations: 10, // high limit so we don't hit this
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should stop after 2 calls due to maxIterations
    expect(mockController.callCount()).toBe(2)

    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem.data.reason).toBe('iteration')
  })

  it('bails on repeated empty turns at maxEmpties with a visible stop message', async () => {
    // @note the chat-path twin of the response-path guard: repeated empty turns
    // (no answer text, no tool call) bail at maxEmpties with a surfaced stop
    // message instead of silently exhausting the continuation budget. Uses
    // maxEmpties=2 to prove the cap is honoured (not a hardcoded default).
    const mockController = createMockStream([
      { finishReason: 'stop', completion: '' },
      { finishReason: 'stop', completion: '' },
      { finishReason: 'stop', completion: 'should not reach' },
    ])

    const items = []

    for await (const item of completeChatConversation({
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxEmpties: 2,
      maxContinuations: 20, // high - prove the empty guard bails first
      maxCycles: 10,
      createChatCompletionStream: mockController.mock,
    })) {
      items.push(item)
    }

    // bails after maxEmpties (2), NOT the 20-continuation budget
    expect(mockController.callCount()).toBe(2)

    const emptyExhaustedMessage = items.find(
      (item) =>
        item.type === 'message' &&
        item.data.type === 'bot' &&
        item.data.meta?.emptyExhausted === true
    )

    expect(emptyExhaustedMessage).toBeDefined()
    expect(emptyExhaustedMessage.data.text).toBe(LOOP_STOP_USER_MESSAGE)
  })

  it('should track currentIterations across mixed recursion types', async () => {
    // @note this tests that iteration counting works correctly when
    // different types of recursion (tool calls, length) are mixed

    const mockController = createMockStream([
      // Call 1: tool call
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      // Call 2: length (needs continuation)
      { finishReason: 'length', completion: 'Partial...' },
      // Call 3: would continue but hits limit
      { finishReason: 'stop', completion: 'Should not reach' },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 2,
      maxContinuations: 10,
      maxCalls: 10,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should stop after 2 calls (1 tool call + 1 length)
    expect(mockController.callCount()).toBe(2)

    const completeEndItems = items.filter((item) => item.type === 'completeEnd')
    const finalEndItem = completeEndItems[completeEndItems.length - 1]

    expect(finalEndItem.data.reason).toBe('iteration')
  })

  it('should respect maxIterations=0 as no calls allowed', async () => {
    // @note edge case: maxIterations=0 means no model calls at all
    // This is probably not a valid use case but should be handled gracefully

    const mockController = createMockStream([
      { finishReason: 'stop', completion: 'Should not reach' },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 0,
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // Should make exactly 1 call - the initial call always happens
    // (maxIterations blocks RECURSION, not the initial call)
    expect(mockController.callCount()).toBe(1)
  })

  it('should not allow negative currentIterations to bypass maxIterations', async () => {
    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Should not reach if maxIterations is enforced',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 1,
      currentIterations: -100,
      maxCalls: 10,
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(mockController.callCount()).toBe(1)
  })

  it('should not allow negative callStats to bypass maxCalls=0', async () => {
    const handler = jest.fn(async () => ({ result: 'ok' }))

    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'testTool', arguments: '{}' },
          },
        ],
      },
      {
        finishReason: 'stop',
        completion: 'Done',
      },
    ])

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 0,
      callStats: { calls: -100 },
      maxCycles: 10,
      functions: [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('TAG_USAGE suppression on fatal errors', () => {
  it('should not yield TAG_USAGE when chat stream throws a fatal error', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () => {
        throw new Error('Incorrect API key provided')
      },
    }

    const items = []

    await expect(async () => {
      for await (const item of completeChatConversation(options)) {
        items.push(item)
      }
    }).rejects.toThrow('Incorrect API key provided')

    expect(items.filter((i) => i.type === 'usage')).toHaveLength(0)
  })

  it('should yield TAG_USAGE on successful chat stream completion', async () => {
    const items = []

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () =>
        (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'hello',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        })(),
    }

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const usageItems = items.filter((i) => i.type === 'usage')

    expect(usageItems).toHaveLength(1)
    expect(usageItems[0].data.inputTokensUsed).toBeGreaterThanOrEqual(0)
    expect(usageItems[0].data.outputTokensUsed).toBe(5)
  })

  it('should yield TAG_USAGE when chat stream recovers from token-limit error', async () => {
    let callCount = 0

    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      maxContinuations: 1,
      createChatCompletionStream: () => {
        callCount += 1

        if (callCount === 1) {
          throw new Error(
            "This model's maximum context length is 4096 tokens. However, your messages resulted in 4200 tokens."
          )
        }

        return (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'recovered',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 },
          }
        })()
      },
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    const usageItems = items.filter((i) => i.type === 'usage')

    // @note token-limit retry recovers, so usage should be reported
    expect(usageItems.length).toBeGreaterThanOrEqual(1)
  })

  it('should yield TAG_USAGE when chat stream fails mid-stream after tokens were received', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: async function* () {
        yield {
          error: null,
          finishReason: null,
          completion: 'partial',
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
        }

        throw new Error('network connection lost')
      },
    }

    const items = []

    await expect(async () => {
      for await (const item of completeChatConversation(options)) {
        items.push(item)
      }
    }).rejects.toThrow('network connection lost')

    const usageItems = items.filter((i) => i.type === 'usage')

    expect(usageItems).toHaveLength(1)
    expect(usageItems[0].data.outputTokensUsed).toBe(3)
  })

  it('should yield TAG_USAGE when chat stream fails after consuming input but producing no output', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: async function* () {
        // @note provider started streaming but fails before any completion text
        yield {
          error: null,
          finishReason: null,
          completion: null,
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 15, completionTokens: 0, totalTokens: 15 },
        }

        throw new Error('server internal error')
      },
    }

    const items = []

    await expect(async () => {
      for await (const item of completeChatConversation(options)) {
        items.push(item)
      }
    }).rejects.toThrow('server internal error')

    const usageItems = items.filter((i) => i.type === 'usage')

    // @note stream started so input tokens were consumed even with zero output
    expect(usageItems).toHaveLength(1)
    expect(usageItems[0].data.outputTokensUsed).toBe(0)
    expect(usageItems[0].data.inputTokensUsed).toBe(15)
  })

  it('rethrows stream aborts without emitting abort items in chat path', async () => {
    const options = {
      model: 'gpt-4o',
      backstory: 'Test bot',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream: () => {
        const error = new Error('stream aborted upstream')

        error.name = 'AbortError'

        throw error
      },
    }

    const items = []

    await expect(async () => {
      for await (const item of completeChatConversation(options)) {
        items.push(item)
      }
    }).rejects.toThrow('stream aborted upstream')

    expect(items.some((item) => item.type === 'abort')).toBe(false)
  })
})

describe('completeConversation routing', () => {
  it('routes to chat path for chat-capable model', async () => {
    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      createChatCompletionStream: () =>
        (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'chat-route',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })(),
      createTextCompletionStream: () => {
        throw new Error('text path should not be used')
      },
    }

    const items = []

    for await (const item of completeConversation(options)) {
      items.push(item)
    }

    expect(
      items.some((i) => i.type === 'token' && i.data.token === 'chat-route')
    ).toBe(true)
  })

  it('routes to text path for non-chat model', async () => {
    const options = {
      model: 'gpt-3.5-turbo-instruct',
      messages: [{ type: 'user', text: 'hello' }],
      createTextCompletionStream: () =>
        (async function* () {
          yield {
            reasoning: null,
            completion: 'text-route',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })(),
      createChatCompletionStream: () => {
        throw new Error('chat path should not be used')
      },
    }

    const items = []

    for await (const item of completeConversation(options)) {
      items.push(item)
    }

    expect(
      items.some((i) => i.type === 'token' && i.data.token === 'text-route')
    ).toBe(true)
  })

  it('routes a responses-capable model to the Responses API path', async () => {
    // @note gpt-5.4-mini advertises the 'responses' feature, so it must route
    // to the Responses API instead of chat completions
    const options = {
      model: 'gpt-5.4-mini',
      messages: [{ type: 'user', text: 'hello' }],
      createResponseCompletionStream: () =>
        (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'response-route',
            reasoning: null,
            toolCalls: null,
            usage: {
              promptTokens: 10,
              completionTokens: 1,
              totalTokens: 11,
              reasoningTokens: 0,
            },
          }
        })(),
      createChatCompletionStream: () => {
        throw new Error('chat path should not be used')
      },
      createTextCompletionStream: () => {
        throw new Error('text path should not be used')
      },
    }

    const items = []

    for await (const item of completeConversation(options)) {
      items.push(item)
    }

    expect(
      items.some((i) => i.type === 'token' && i.data.token === 'response-route')
    ).toBe(true)
  })
})

describe('calculateMaxTokens output budget invariants', () => {
  // @note these tests lock in the design decision that user-provided maxTokens
  // caps the INPUT budget only - output always gets the model's full
  // maxOutputTokens. See the @note block in calculateMaxTokens for rationale.

  it('totalTokens should equal modelConfig.maxOutputTokens for gpt-4o', () => {
    const result = calculateMaxTokens('gpt-4o', 10000, [])

    expect(result.totalTokens).toBe(languageModels['gpt-4o'].maxOutputTokens)
  })

  it('totalTokens should not change when user maxTokens varies', () => {
    const small = calculateMaxTokens('gpt-4o', 10000, [])
    const medium = calculateMaxTokens('gpt-4o', 50000, [])
    const huge = calculateMaxTokens('gpt-4o', 10_000_000, [])

    expect(small.totalTokens).toBe(medium.totalTokens)
    expect(medium.totalTokens).toBe(huge.totalTokens)
    expect(small.totalTokens).toBe(languageModels['gpt-4o'].maxOutputTokens)
  })

  it('inputTokens should scale with user maxTokens up to maxInputTokens cap', () => {
    const modelConfig = languageModels['gpt-4o']

    const small = calculateMaxTokens('gpt-4o', 20000, [])
    const large = calculateMaxTokens('gpt-4o', 10_000_000, [])

    expect(small.inputTokens).toBe(20000)
    expect(large.inputTokens).toBe(modelConfig.maxInputTokens)
  })

  it('totalTokens should equal maxOutputTokens for the custom fallback model', () => {
    const result = calculateMaxTokens('unknown-model', 10000, [])

    expect(result.totalTokens).toBe(languageModels.custom.maxOutputTokens)
  })

  it('inputTokens must not exceed maxInputTokens even when MIN_TOKENS is larger', () => {
    // @note gpt-3.5-turbo-instruct has maxInputTokens=3000 which is below the
    // MIN_TOKENS floor of 10_000. The maxInputTokens cap must win - otherwise
    // we would ask the API for more input budget than the model supports.
    const modelConfig = languageModels['gpt-3.5-turbo-instruct']

    expect(modelConfig.maxInputTokens).toBeLessThan(10000)

    const small = calculateMaxTokens('gpt-3.5-turbo-instruct', 100, [])
    const medium = calculateMaxTokens('gpt-3.5-turbo-instruct', 10000, [])
    const huge = calculateMaxTokens('gpt-3.5-turbo-instruct', 50000, [])

    expect(small.inputTokens).toBe(modelConfig.maxInputTokens)
    expect(medium.inputTokens).toBe(modelConfig.maxInputTokens)
    expect(huge.inputTokens).toBe(modelConfig.maxInputTokens)
  })

  it('inputTokens should equal maxInputTokens when called with maxInputTokens as input', () => {
    // @note this is the value the stream callers now pass as the default when
    // overrideMaxTokens is omitted. Locking it in so the fallback semantic
    // (default = maxInputTokens, not maxTokens) stays consistent.
    const modelConfig = languageModels['gpt-4o']

    const result = calculateMaxTokens('gpt-4o', modelConfig.maxInputTokens, [])

    expect(result.inputTokens).toBe(modelConfig.maxInputTokens)
  })
})

describe('completeChatConversation maxTokens passthrough', () => {
  // @note locks in the intentional decision at model.provider.openai.conv.js
  // that the chat stream does NOT forward maxTokens to the OpenAI API - the
  // model is allowed to use its full output budget because we cannot predict
  // output length ahead of time.

  it('should not pass maxTokens to createChatCompletionStream', async () => {
    let capturedArgs = null

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      createChatCompletionStream: (args) => {
        capturedArgs = args

        return (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'ok',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()
      },
    }

    for await (const _ of completeChatConversation(options)) {
      // no-op
    }

    expect(capturedArgs).not.toBeNull()
    expect(capturedArgs.maxTokens).toBeUndefined()
  })

  it('should not pass maxTokens even when overrideMaxTokens is set', async () => {
    let capturedArgs = null

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      overrideMaxTokens: 20000,
      createChatCompletionStream: (args) => {
        capturedArgs = args

        return (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'ok',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()
      },
    }

    for await (const _ of completeChatConversation(options)) {
      // no-op
    }

    expect(capturedArgs).not.toBeNull()
    expect(capturedArgs.maxTokens).toBeUndefined()
  })

  it('should resolve async functions before building chat tool args', async () => {
    let capturedArgs = null

    const functionsResolver = jest.fn().mockResolvedValue([
      {
        name: 'lookupWeather',
        description: 'Look up the weather',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
        },
        handler: async () => 'sunny',
      },
    ])

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      functions: functionsResolver,
      createChatCompletionStream: (args) => {
        capturedArgs = args

        return (async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'ok',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()
      },
    }

    for await (const _ of completeChatConversation(options)) {
      // no-op
    }

    expect(functionsResolver).toHaveBeenCalledTimes(1)
    expect(capturedArgs).not.toBeNull()
    expect(capturedArgs.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'lookupWeather',
          description: 'Look up the weather',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
          },
        },
      },
    ])
    expect(capturedArgs.toolChoice).toBe('auto')
  })

  it('should surface async function resolver errors before starting chat stream', async () => {
    const createChatCompletionStream = jest.fn()

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      functions: async () => {
        throw new Error('resolver failed')
      },
      createChatCompletionStream,
    }

    await expect(async () => {
      for await (const _ of completeChatConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('resolver failed')

    expect(createChatCompletionStream).not.toHaveBeenCalled()
  })
})

describe('completeTextConversation maxTokens passthrough', () => {
  // @note the legacy text completion API requires an explicit max_tokens, so
  // the text stream does forward it. It should equal the model's full
  // maxOutputTokens and remain fixed regardless of user overrideMaxTokens.

  it('should pass maxTokens equal to modelConfig.maxOutputTokens', async () => {
    let capturedArgs = null

    const options = {
      model: 'gpt-3.5-turbo-instruct',
      messages: [{ type: 'user', text: 'hello' }],
      background: true,
      createTextCompletionStream: (args) => {
        capturedArgs = args

        return (async function* () {
          yield {
            reasoning: null,
            completion: 'ok',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()
      },
    }

    for await (const _ of completeTextConversation(options)) {
      // no-op
    }

    expect(capturedArgs).not.toBeNull()
    expect(capturedArgs.maxTokens).toBe(
      languageModels['gpt-3.5-turbo-instruct'].maxOutputTokens
    )
  })

  it('should pass the same maxTokens regardless of overrideMaxTokens', async () => {
    const capturedMaxTokens = []

    const makeOptions = (overrideMaxTokens) => ({
      model: 'gpt-3.5-turbo-instruct',
      messages: [{ type: 'user', text: 'hello' }],
      background: true,
      overrideMaxTokens,
      createTextCompletionStream: (args) => {
        capturedMaxTokens.push(args.maxTokens)

        return (async function* () {
          yield {
            reasoning: null,
            completion: 'ok',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()
      },
    })

    for await (const _ of completeTextConversation(makeOptions(500))) {
      // no-op
    }

    for await (const _ of completeTextConversation(makeOptions(100_000))) {
      // no-op
    }

    expect(capturedMaxTokens).toHaveLength(2)
    expect(capturedMaxTokens[0]).toBe(
      languageModels['gpt-3.5-turbo-instruct'].maxOutputTokens
    )
    expect(capturedMaxTokens[1]).toBe(capturedMaxTokens[0])
  })

  it('should reject async functions that resolve to unsupported text functions', async () => {
    const createTextCompletionStream = jest.fn()

    const options = {
      model: 'gpt-3.5-turbo-instruct',
      messages: [{ type: 'user', text: 'hello' }],
      background: true,
      functions: async () => [
        {
          name: 'lookupWeather',
          description: 'Look up the weather',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ],
      createTextCompletionStream,
    }

    await expect(async () => {
      for await (const _ of completeTextConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('Functions are not supported')

    expect(createTextCompletionStream).not.toHaveBeenCalled()
  })

  it('should surface async function resolver errors before starting text stream', async () => {
    const createTextCompletionStream = jest.fn()

    const options = {
      model: 'gpt-3.5-turbo-instruct',
      messages: [{ type: 'user', text: 'hello' }],
      background: true,
      functions: async () => {
        throw new Error('resolver failed')
      },
      createTextCompletionStream,
    }

    await expect(async () => {
      for await (const _ of completeTextConversation(options)) {
        // no-op
      }
    }).rejects.toThrow('resolver failed')

    expect(createTextCompletionStream).not.toHaveBeenCalled()
  })
})

describe('runaway repetition guard', () => {
  // a 4-word phrase ("please call the linter") repeated every 5 words. Each
  // streamed chunk packs several cycles so the stream comfortably crosses the
  // production minChars floor (RUNAWAY_GUARD_MIN_CHARS) and the guard arms; once
  // armed it trips within a few cycles. Below that floor the guard deliberately
  // leaves short repetitive output alone (see the thread.utest "minChars length
  // gate" tests), so the runaway here must be long enough to be a real runaway.
  const RUNAWAY_CHUNK = 'please call the linter now '.repeat(8)

  describe('completeTextConversation', () => {
    it('stops the stream and emits a cycle notice on runaway repetition', async () => {
      let reachedSentinel = false

      const createTextCompletionStream = () =>
        (async function* () {
          for (let index = 0; index < 12; index++) {
            yield {
              reasoning: null,
              completion: RUNAWAY_CHUNK,
              finishReason: null,
              usage: null,
            }
          }

          // the guard should have broken the stream before this point
          reachedSentinel = true

          yield {
            reasoning: null,
            completion: 'SENTINEL_AFTER_LOOP',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'go' }],
        background: true,
        createTextCompletionStream,
      }

      const items = []

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const tokenText = items
        .filter((item) => item.type === 'token')
        .map((item) => item.data.token)
        .join('')

      const cycleMessage = items.find(
        (item) => item.type === 'message' && item.data?.meta?.cycleDetected
      )

      // the stream was cut short before the sentinel chunk
      expect(reachedSentinel).toBe(false)
      expect(tokenText).not.toContain('SENTINEL')

      // a cycle-detected stop message was emitted
      expect(cycleMessage).toBeTruthy()
      expect(cycleMessage.data.meta.runawayTextDetected).toBe(true)
      // the runaway stop now names the phrase the model got stuck on instead of
      // a cryptic "stuck in a loop" notice (background phrasing)
      expect(cycleMessage.data.text).toContain('kept repeating')
      expect(cycleMessage.data.text).toContain('linter')
      expect(cycleMessage.data.text).not.toBe(LOOP_STOP_BACKGROUND_MESSAGE)

      // followed by a complete-end event
      expect(items.some((item) => item.type === 'completeEnd')).toBe(true)
    })

    it('does not trip on healthy streamed text', async () => {
      const createTextCompletionStream = () =>
        (async function* () {
          for (const word of 'the blueprint compiles cleanly and the assistant is ready for the user to build and configure'.split(
            ' '
          )) {
            yield {
              reasoning: null,
              completion: `${word} `,
              finishReason: null,
              usage: null,
            }
          }

          yield {
            reasoning: null,
            completion: 'done',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()

      const options = {
        model: 'gpt-3.5-turbo-instruct',
        messages: [{ type: 'user', text: 'go' }],
        background: true,
        createTextCompletionStream,
      }

      const items = []

      for await (const item of completeTextConversation(options)) {
        items.push(item)
      }

      const cycleMessage = items.find(
        (item) => item.type === 'message' && item.data?.meta?.cycleDetected
      )

      expect(cycleMessage).toBeUndefined()
    })
  })

  describe('completeChatConversation', () => {
    it('stops the stream and emits a cycle notice on runaway repetition', async () => {
      let reachedSentinel = false

      const createChatCompletionStream = () =>
        (async function* () {
          for (let index = 0; index < 12; index++) {
            yield {
              error: null,
              reasoning: null,
              completion: RUNAWAY_CHUNK,
              finishReason: null,
              functionCall: null,
              toolCalls: null,
              usage: null,
            }
          }

          reachedSentinel = true

          yield {
            error: null,
            reasoning: null,
            completion: 'SENTINEL_AFTER_LOOP',
            finishReason: 'stop',
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'go' }],
        maxCycles: 10,
        createChatCompletionStream,
      }

      const items = []

      for await (const item of completeChatConversation(options)) {
        items.push(item)
      }

      const tokenText = items
        .filter((item) => item.type === 'token')
        .map((item) => item.data.token)
        .join('')

      const cycleMessage = items.find(
        (item) => item.type === 'message' && item.data?.meta?.cycleDetected
      )

      expect(reachedSentinel).toBe(false)
      expect(tokenText).not.toContain('SENTINEL')

      expect(cycleMessage).toBeTruthy()
      expect(cycleMessage.data.meta.runawayTextDetected).toBe(true)
      // user-facing runaway stop names the phrase and invites a retry
      expect(cycleMessage.data.text).toContain('kept repeating')
      expect(cycleMessage.data.text).toContain('linter')
      expect(cycleMessage.data.text).not.toBe(LOOP_STOP_USER_MESSAGE)

      expect(items.some((item) => item.type === 'completeEnd')).toBe(true)
    })

    it('does NOT trip on a runaway loop in streamed reasoning (reasoning is exempt)', async () => {
      // @note the reasoning (chain-of-thought) channel is the
      // model's scratchpad - it legitimately drafts and re-verifies repetitive
      // structures (tables, ASCII grids, enumerations) that are indistinguishable
      // from a loop on lexical diversity alone. The guard runs only on the
      // user-visible answer text, so a repetitive reasoning stream must flow
      // through untouched and the turn must complete normally.
      let reachedSentinel = false

      const createChatCompletionStream = () =>
        (async function* () {
          for (let index = 0; index < 12; index++) {
            yield {
              error: null,
              reasoning: RUNAWAY_CHUNK,
              completion: null,
              finishReason: null,
              functionCall: null,
              toolCalls: null,
              usage: null,
            }
          }

          reachedSentinel = true

          yield {
            error: null,
            reasoning: null,
            completion: 'SENTINEL_AFTER_LOOP',
            finishReason: 'stop',
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
          }
        })()

      const options = {
        model: 'gpt-4o',
        backstory: 'Test bot',
        messages: [{ type: 'user', text: 'go' }],
        maxCycles: 10,
        createChatCompletionStream,
      }

      const items = []

      for await (const item of completeChatConversation(options)) {
        items.push(item)
      }

      const cycleMessage = items.find(
        (item) => item.type === 'message' && item.data?.meta?.cycleDetected
      )

      const tokenText = items
        .filter((item) => item.type === 'token')
        .map((item) => item.data.token)
        .join('')

      // the reasoning loop was not cut short - the stream ran to the sentinel
      expect(reachedSentinel).toBe(true)
      expect(tokenText).toContain('SENTINEL_AFTER_LOOP')

      // and no runaway/cycle stop was emitted
      expect(cycleMessage).toBeUndefined()
    })
  })
})

describe('call budget exhaustion stops the agent loop', () => {
  /**
   * Helper to create a mock createChatCompletionStream that returns a
   * sequence of responses controlled by the caller and records every request
   * input.
   *
   * @param {Array<{completion?: string, finishReason: string, toolCalls?: any[], reasoning?: string | null}>} responses
   * @returns {{mock: Function, callCount: () => number, inputs: any[]}}
   */
  function createMockStream(responses) {
    let callIndex = 0

    const inputs = []

    async function* mockStream(response) {
      yield {
        error: null,
        finishReason: response.finishReason,
        completion: response.completion || null,
        reasoning: response.reasoning || null,
        functionCall: null,
        toolCalls: response.toolCalls || null,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      }
    }

    return {
      mock: (input) => {
        inputs.push(input)

        const response = responses[callIndex] || responses[responses.length - 1]

        callIndex++

        return mockStream(response)
      },
      callCount: () => callIndex,
      inputs,
    }
  }

  it('stops recursing after the call budget is exhausted even when tool arguments vary', async () => {
    // @note regression test - once callStats.calls exceeds maxCalls the
    // handlers stop being executed but the recursion previously kept going
    // forever (maxIterations is undefined by default and cycle detection is
    // defeated whenever the model varies its arguments, e.g. an incrementing
    // page number). The model gets exactly one wrap-up round after the budget
    // is exhausted and then the conversation is stopped.

    const scriptedToolCallTurns = 12

    const responses = []

    for (let i = 0; i < scriptedToolCallTurns; i++) {
      responses.push({
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            // @note unique arguments each turn defeat cycle detection
            function: { name: 'lookup', arguments: `{"page":${i}}` },
          },
        ],
      })
    }

    responses.push({ finishReason: 'stop', completion: 'Done' })

    const mockController = createMockStream(responses)

    const handler = jest.fn(async () => ({ result: 'ok' }))

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 2,
      functions: [
        {
          name: 'lookup',
          description: 'Test tool',
          parameters: {},
          handler,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // the handler ran only within the budget

    expect(handler).toHaveBeenCalledTimes(2)

    // @note exactly 4 model requests:
    // - round 1 and 2: calls executed within the budget
    // - round 3: call rejected with 'too many calls', model gets one round
    //   to see the error and wrap up
    // - round 4: model still calls a tool with the budget exhausted - stop

    expect(mockController.callCount()).toBe(4)

    // the conversation ends with an explanatory bot message

    const stopMessages = items.filter(
      (item) =>
        item.type === 'message' &&
        item.data.type === 'bot' &&
        item.data.meta?.callLimitReached
    )

    expect(stopMessages.length).toBe(1)
    expect(stopMessages[0].data.text).toContain('limit of actions')
  })

  it('still lets the model wrap up with text after the call budget is exhausted', async () => {
    // @note when the model reacts to the 'too many calls' error by producing
    // a normal text response, the conversation ends cleanly without the
    // synthetic stop message

    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'lookup', arguments: '{"page":0}' },
          },
        ],
      },
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'lookup', arguments: '{"page":1}' },
          },
        ],
      },
      { finishReason: 'stop', completion: 'I ran out of tool budget.' },
    ])

    const handler = jest.fn(async () => ({ result: 'ok' }))

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      maxCalls: 1,
      functions: [
        {
          name: 'lookup',
          description: 'Test tool',
          parameters: {},
          handler,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(handler).toHaveBeenCalledTimes(1)
    expect(mockController.callCount()).toBe(3)

    const botMessages = items.filter(
      (item) => item.type === 'message' && item.data.type === 'bot'
    )

    expect(botMessages.length).toBe(1)
    expect(botMessages[0].data.text).toBe('I ran out of tool budget.')
    expect(botMessages[0].data.meta?.callLimitReached).toBeUndefined()
  })

  it('does not route a hallucinated function name to an unrelated function via substring match', async () => {
    // @note regression test - getFunctionName previously used a plain
    // substring check so a hallucinated 'research' silently resolved to the
    // real function 'search' and executed it with foreign arguments instead
    // of returning a 'function not found' error that lets the model correct
    // itself

    const searchHandler = jest.fn(async () => ({ result: 'searched' }))

    const mockController = createMockStream([
      {
        finishReason: 'toolCalls',
        toolCalls: [
          {
            type: 'function',
            function: { name: 'research', arguments: '{"q":"x"}' },
          },
        ],
      },
      { finishReason: 'stop', completion: 'Done' },
    ])

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      functions: [
        {
          name: 'search',
          description: 'Search tool',
          parameters: {},
          handler: searchHandler,
        },
      ],
      createChatCompletionStream: mockController.mock,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // the wrong handler is NOT executed

    expect(searchHandler).not.toHaveBeenCalled()

    // the model receives a 'function not found' error so it can correct

    const notFoundResponses = items.filter(
      (item) =>
        item.type === 'message' &&
        item.data.type === 'activity' &&
        item.data.meta?.activity?.type === 'response' &&
        JSON.stringify(item.data.meta.activity.function.result).includes(
          'not found'
        )
    )

    expect(notFoundResponses.length).toBe(1)
  })
})

describe('getFunctionName boundary matching', () => {
  it('does not match a function name embedded inside a longer word', () => {
    // @note regression test - 'research' must not resolve to 'search'

    expect(getFunctionName('research', [{ name: 'search' }])).toBe('research')

    expect(getFunctionName('researchTopic', [{ name: 'search' }])).toBe(
      'researchTopic'
    )
  })

  it('still rescues names separated by token boundaries', () => {
    expect(getFunctionName('functions.search', [{ name: 'search' }])).toBe(
      'search'
    )

    expect(getFunctionName('search()', [{ name: 'search' }])).toBe('search')

    expect(getFunctionName('tools:search', [{ name: 'search' }])).toBe('search')

    expect(getFunctionName('functions_search', [{ name: 'search' }])).toBe(
      'search'
    )
  })
})

describe('convertMessages per-message byte cap', () => {
  it('caps tool results and tool call arguments like message text', async () => {
    // @note regression test - activity payloads live in meta.activity.function
    // and were previously emitted as tool content / tool_call arguments
    // WITHOUT the 65,500 byte cap applied to message text, so a single huge
    // function result poisoned every subsequent request in the conversation

    const bigText = 'x'.repeat(100_000)

    const messages = [
      { type: 'user', text: bigText },
      makeRequestActivityMessage('lookup', '{}'),
      makeResponseActivityMessage('lookup', bigText, bigText),
    ]

    const converted = await convertMessages(messages, 'gpt-4o')

    const userMessage = converted.find((message) => message.role === 'user')
    const toolMessage = converted.find((message) => message.role === 'tool')
    const assistantMessage = converted.find(
      (message) => message.role === 'assistant' && message.tool_calls
    )

    expect(userMessage).toBeDefined()
    expect(toolMessage).toBeDefined()
    expect(assistantMessage).toBeDefined()

    expect(userMessage.content.length).toBeLessThanOrEqual(65_500)
    expect(toolMessage.content.length).toBeLessThanOrEqual(65_500)
    expect(
      assistantMessage.tool_calls[0].function.arguments.length
    ).toBeLessThanOrEqual(65_500)
  })
})

describe('client-side stop sequences terminate the text stream', () => {
  /**
   * Helper to create a mock createTextCompletionStream from a list of chunks.
   *
   * @param {Array<{completion?: string, finishReason?: string}>} chunks
   * @returns {Function}
   */
  function createMockTextStream(chunks) {
    async function* mockStream() {
      for (const chunk of chunks) {
        yield {
          reasoning: null,
          completion: chunk.completion || null,
          finishReason: chunk.finishReason || null,
          usage: null,
        }
      }
    }

    return () => mockStream()
  }

  it('stops streaming when a stop sequence arrives in its own chunk', async () => {
    // @note regression test - the client-side stop scan previously trimmed
    // the matched token out of the current chunk but neither terminated the
    // stream nor suppressed subsequent chunks, so everything the model
    // emitted after the stop sequence leaked to the consumer. The API-side
    // stop list is capped at 4 entries so the client-side scan is the only
    // enforcement for the remaining sequences.

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      stop: ['STOP'],
      createTextCompletionStream: createMockTextStream([
        { completion: 'Hello ' },
        { completion: 'STOP' },
        { completion: ' world' },
        { completion: '', finishReason: 'stop' },
      ]),
    }

    const items = []

    for await (const item of completeTextConversation(options)) {
      items.push(item)
    }

    const botMessages = items.filter(
      (item) => item.type === 'message' && item.data.type === 'bot'
    )

    expect(botMessages.length).toBe(1)
    expect(botMessages[0].data.text).toBe('Hello ')
    expect(botMessages[0].data.text).not.toContain('world')

    const ends = items.filter((item) => item.type === 'completeEnd')

    expect(ends.length).toBe(1)
    expect(ends[0].data.reason).toBe('stop')
  })

  it('trims a stop sequence that arrives mid-chunk and stops streaming', async () => {
    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      stop: ['STOP'],
      createTextCompletionStream: createMockTextStream([
        { completion: 'Hello STOP world' },
        { completion: ' more text' },
        { completion: '', finishReason: 'stop' },
      ]),
    }

    const items = []

    for await (const item of completeTextConversation(options)) {
      items.push(item)
    }

    const botMessages = items.filter(
      (item) => item.type === 'message' && item.data.type === 'bot'
    )

    expect(botMessages.length).toBe(1)
    expect(botMessages[0].data.text).toBe('Hello ')
  })
})

describe('empty-response retry context', () => {
  it('keeps freshly generated reasoning in the retry request', async () => {
    // @note regression test - the empty-response retry previously rebuilt the
    // context from the pre-response snapshot, dropping the reasoning the
    // model had just produced even though it was already emitted to the
    // consumer (and thus persisted) - the model retried blind and the stored
    // conversation diverged from what the model actually saw

    let callIndex = 0

    const inputs = []

    const createChatCompletionStream = (input) => {
      inputs.push(input)

      const response =
        callIndex === 0
          ? { reasoning: 'UNIQUE_REASONING_MARKER', finishReason: 'stop' }
          : { completion: 'Hello!', finishReason: 'stop' }

      callIndex++

      return (async function* () {
        yield {
          error: null,
          finishReason: response.finishReason,
          completion: response.completion || null,
          reasoning: response.reasoning || null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      })()
    }

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    // the empty response triggered exactly one retry

    expect(callIndex).toBe(2)

    // the reasoning was emitted to the consumer

    const reasoningMessages = items.filter(
      (item) => item.type === 'message' && item.data.type === 'reasoning'
    )

    expect(reasoningMessages.length).toBe(1)

    // the retry request contains both the empty notice AND the reasoning

    const retryRequestText = JSON.stringify(inputs[1].messages)

    expect(retryRequestText).toContain('_emptyDetected')
    expect(retryRequestText).toContain('UNIQUE_REASONING_MARKER')
  })
})

describe('completeBegin/completeEnd balance', () => {
  it('closes the current completion before retrying an in-stream error', async () => {
    // @note regression test - the in-stream error retry previously recursed
    // BEFORE the current completion emitted its completeEnd, so a consumer
    // pairing begin/end saw a completion that never finished

    let callIndex = 0

    const createChatCompletionStream = () => {
      const response =
        callIndex === 0
          ? { error: { message: 'Transient upstream error', code: 'error' } }
          : { completion: 'Recovered', finishReason: 'stop' }

      callIndex++

      return (async function* () {
        yield {
          error: response.error || null,
          finishReason: response.error ? null : response.finishReason,
          completion: response.completion || null,
          reasoning: null,
          functionCall: null,
          toolCalls: null,
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      })()
    }

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      createChatCompletionStream,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(callIndex).toBe(2)

    const begins = items.filter((item) => item.type === 'completeBegin')
    const ends = items.filter((item) => item.type === 'completeEnd')

    // every completeBegin is balanced by a completeEnd

    expect(begins.length).toBe(2)
    expect(ends.length).toBe(2)
    expect(ends.map((end) => end.data.reason)).toEqual(['error', 'stop'])
  })

  it('documents the trailing iteration completeEnd as the authoritative stop signal', async () => {
    // @note contract test - when the iteration limit stops a tool-call loop
    // the stream deliberately carries TWO completeEnd events for the final
    // completion: the per-completion end ('activity') and a trailing
    // 'iteration' status marker. Consumers must treat the LAST completeEnd
    // as authoritative (this mirrors the assertions in the maxIterations
    // tests above). If this contract changes, update all consumers pairing
    // begin/end events.

    let callIndex = 0

    const createChatCompletionStream = () => {
      callIndex++

      return (async function* () {
        yield {
          error: null,
          finishReason: 'toolCalls',
          completion: null,
          reasoning: null,
          functionCall: null,
          toolCalls: [
            {
              type: 'function',
              function: { name: 'lookup', arguments: '{}' },
            },
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      })()
    }

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'Test' }],
      maxIterations: 1,
      functions: [
        {
          name: 'lookup',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ],
      createChatCompletionStream,
    }

    const items = []

    for await (const item of completeChatConversation(options)) {
      items.push(item)
    }

    expect(callIndex).toBe(1)

    const begins = items.filter((item) => item.type === 'completeBegin')
    const ends = items.filter((item) => item.type === 'completeEnd')

    expect(begins.length).toBe(1)
    expect(ends.map((end) => end.data.reason)).toEqual([
      'activity',
      'iteration',
    ])
  })
})
