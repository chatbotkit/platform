/**
 * @jest-environment node
 */

/* eslint-disable custom-eslint-rules/require-dispose-for-factory-result -- tests create short-lived engines and clean database state explicitly */
import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import { makeActivityMessagePair } from '@/lib/activity'
import {
  CoreEngine,
  getStatefulConversationEngine,
} from '@/lib/conversation.engine'
import {
  TAG_COMPLETE_END,
  TAG_MESSAGE,
  TAG_TOKEN,
  TAG_USAGE,
} from '@/lib/conversation.tag'

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const itIfConfigured = hasLanguageModelsByProvider('openai') ? it : it.skip

const testLanguageModel = 'custom/name=test/provider=openai/credentials=sk-test'

jest.retryTimes(3)

async function cleanupConversation(conversationId) {
  if (!conversationId) {
    return
  }

  // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
  await prisma.conversation.delete({
    where: { id: conversationId },
  })
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('getStatefulConversationEngine', () => {
  itIfConfigured(
    'must be able to complete a conversation with multiple activity messages',
    async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,

            backstory: `You are a simple bot.`,

            model: 'gpt-4o',
          },
        })

        await prisma.message.createMany({
          data: [
            {
              conversationId: id,
              type: MessageType.user,
              text: 'Hello',
            },
            {
              conversationId: id,
              type: MessageType.bot,
              text: 'Hi there! How can I assist you today?',
            },
            {
              conversationId: id,
              type: MessageType.user,
              text: 'how many massages do I have and read the last message',
            },
            // an activity has been requested
            {
              conversationId: id,
              type: MessageType.activity,
              text: '',
              meta: {
                activity: {
                  type: 'request',
                  function: { name: 'countMessages', arguments: {} },
                },
              },
            },
            // an activity has been responded
            {
              conversationId: id,
              type: MessageType.activity,
              text: '',
              meta: {
                activity: {
                  type: 'response',
                  function: {
                    name: 'countMessages',
                    arguments: {},
                    result: 999,
                  },
                },
              },
            },
            // an activity has been requested
            {
              conversationId: id,
              type: MessageType.activity,
              text: '',
              meta: {
                activity: {
                  type: 'request',
                  function: { name: 'readLastMessage', arguments: {} },
                },
              },
            },
            // an activity has been responded
            {
              conversationId: id,
              type: MessageType.activity,
              text: '',
              meta: {
                activity: {
                  type: 'response',
                  function: {
                    name: 'readLastMessage',
                    arguments: {},
                    result: 'The last message is "abc123".',
                  },
                },
              },
            },
          ],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,

          options: {
            userId,
          },
        })

        expect(engine).toBeInstanceOf(CoreEngine)

        await engine.process()
        await engine.complete()

        expect(engine.messages.length).toBe(8)
        expect(engine.messages.at(-1).type).toBe('bot')
        expect(engine.messages.at(-1).text).toContain('999')
        expect(engine.messages.at(-1).text).toContain('abc123')
      } finally {
        await cleanupConversation(conversationId)
      }
    }
  )

  it('persists the cycle-detected bot message for stateful engines', async () => {
    let conversationId

    try {
      const userId = '-'

      const { id } = await prisma.conversation.create({
        data: {
          userId,
          backstory: 'You are a simple bot.',
          model: testLanguageModel,
        },
      })

      await prisma.message.createMany({
        data: [
          {
            conversationId: id,
            type: MessageType.user,
            text: 'Hello',
          },
        ],
      })

      conversationId = id

      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId,
        },
      })

      engine.getConvFunction = () => {
        return () =>
          (async function* () {
            yield {
              type: TAG_USAGE,
              data: {
                inputTokensUsed: 10,
                outputTokensUsed: 10,
                model: testLanguageModel,
              },
            }

            yield {
              type: TAG_MESSAGE,
              data: {
                type: MessageType.bot,
                text: 'I seem to be stuck in a loop. Let me stop here - please try rephrasing your request or providing more details.',
                meta: {
                  cycleDetected: true,
                },
              },
            }

            yield {
              type: TAG_COMPLETE_END,
              data: { reason: 'stop' },
            }
          })()
      }

      const result = await engine.complete()

      const persistedMessages = await prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      const persistedCycleMessage = persistedMessages.at(-1)

      expect(result.messages.at(-1).type).toBe(MessageType.bot)
      expect(result.messages.at(-1).meta?.cycleDetected).toBe(true)
      expect(persistedCycleMessage.type).toBe(MessageType.bot)
      expect(persistedCycleMessage.text).toBe(
        'I seem to be stuck in a loop. Let me stop here - please try rephrasing your request or providing more details.'
      )
      expect(persistedCycleMessage.meta?.cycleDetected).toBe(true)
    } finally {
      await cleanupConversation(conversationId)
    }
  })

  it('persists the partial bot message when the stream is aborted mid-completion', async () => {
    let conversationId

    try {
      const userId = '-'

      const { id } = await prisma.conversation.create({
        data: {
          userId,
          backstory: 'You are a simple bot.',
          model: testLanguageModel,
        },
      })

      await prisma.message.createMany({
        data: [
          {
            conversationId: id,
            type: MessageType.user,
            text: 'Hello',
          },
        ],
      })

      conversationId = id

      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId,
        },
      })

      // @note emulate the real timeout path: the provider streams a few tokens
      // and then the underlying fetch is aborted, surfacing as an AbortError.
      // The engine should flush the accumulated tokens into a partial bot
      // message and still persist it rather than losing the turn.
      engine.getConvFunction = () => {
        return () =>
          (async function* () {
            yield {
              type: TAG_USAGE,
              data: {
                inputTokensUsed: 10,
                outputTokensUsed: 10,
                model: testLanguageModel,
              },
            }

            yield { type: TAG_TOKEN, data: { token: 'partial ' } }
            yield { type: TAG_TOKEN, data: { token: 'reply' } }

            const error = new Error('request aborted upstream')

            error.name = 'AbortError'

            throw error
          })()
      }

      const result = await engine.complete()

      expect(result.reason).toBe('abort')

      const persistedMessages = await prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      const persistedBotMessage = persistedMessages.at(-1)

      expect(persistedBotMessage.type).toBe(MessageType.bot)
      expect(persistedBotMessage.text).toBe('partial reply')
    } finally {
      await cleanupConversation(conversationId)
    }
  })

  // @note a trigger/batch run that times out while a tool ignores the abort
  // signal must not save NOTHING. Driving the REAL conv
  // loop, the deadline fires while a hung tool runs; after the handler grace the
  // loop bypasses the tool, records a PAIRED timeout response for the tool call,
  // and stops with reason 'abort'. complete() then persists the turn - the tool
  // call is left with a paired result (no dangling tool call) rather than the
  // whole turn being discarded by the hard kill.
  it('persists a paired timeout result and stops the run when a tool is bypassed at the deadline', async () => {
    let conversationId
    let completePromise

    try {
      const userId = '-'

      const { id } = await prisma.conversation.create({
        data: {
          userId,
          backstory: 'You are a simple bot.',
          model: testLanguageModel,
        },
      })

      await prisma.message.createMany({
        data: [
          {
            conversationId: id,
            type: MessageType.user,
            text: 'go',
          },
        ],
      })

      conversationId = id

      // the 750s hard-timeout monitor signal, wired in exactly as the trigger
      // queue handler does (options.signal)
      const abortController = new AbortController()

      let markToolEntered

      const toolEntered = new Promise((resolve) => {
        markToolEntered = resolve
      })

      // round 1: the model asks for a tool. A second round must never start -
      // once the deadline has fired the loop stops instead.
      const createChatCompletionStream = jest.fn(async function* () {
        yield {
          error: null,
          finishReason: 'toolCalls',
          completion: null,
          reasoning: null,
          functionCall: null,
          toolCalls: [
            {
              id: 't1',
              type: 'function',
              function: { name: 'slowTool', arguments: '{}' },
            },
          ],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        }
      })

      // a tool that never returns and never observes the signal - the incident
      // shape (a hung network/shell/MCP call)
      const slowTool = {
        name: 'slowTool',
        description: 'A tool that never returns on its own',
        parameters: { type: 'object', properties: {} },
        handler: async () => {
          markToolEntered()

          await new Promise(() => {})

          return { ok: true }
        },
      }

      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId,
          signal: abortController.signal,
          features: [{ name: 'batch', options: { settle: true } }],
          functions: [slowTool],
        },
      })

      engine.getFunctions = async () => [slowTool]

      const originalGetConvFunction = engine.getConvFunction.bind(engine)

      engine.getConvFunction = (model) => {
        const convFunction = originalGetConvFunction(model)

        return (input) => convFunction({ ...input, createChatCompletionStream })
      }

      completePromise = engine.complete()

      // the deadline fires while the loop is parked inside the hung tool
      await toolEntered

      abortController.abort()

      // the run resolves once the handler grace elapses and the tool is bypassed
      const result = await completePromise

      expect(result.reason).toBe('abort')

      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      })

      const activities = messages.filter(
        (message) => message.type === MessageType.activity
      )

      const request = activities.find(
        (message) =>
          message.meta?.activity?.type === 'request' &&
          message.meta?.activity?.function?.name === 'slowTool'
      )

      const response = activities.find(
        (message) =>
          message.meta?.activity?.type === 'response' &&
          message.meta?.activity?.function?.name === 'slowTool'
      )

      // the bypassed tool call is persisted as a PAIRED request + response - no
      // dangling, unanswered tool call is left for the next turn
      expect(request).toBeDefined()
      expect(response).toBeDefined()
      expect(JSON.stringify(response.meta.activity.function.result)).toContain(
        'deadline'
      )
    } finally {
      try {
        await completePromise
      } catch {
        // @note ignore - we only await here to avoid deleting the conversation
        // while a write is still in flight
      }

      await cleanupConversation(conversationId)
    }
  }, 20000)

  it('emits the cycle-detected bot message from the real provider path for stateful engines', async () => {
    let conversationId

    try {
      const userId = '-'
      const createChatCompletionStream = jest
        .fn()
        .mockImplementationOnce(async function* () {
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
                  name: 'testTool',
                  arguments: '{}',
                },
              },
            ],
            usage: {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
          }
        })
        .mockImplementationOnce(async function* () {
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
                  name: 'testTool',
                  arguments: '{}',
                },
              },
            ],
            usage: {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
          }
        })

      const sink = {
        push: jest.fn().mockResolvedValue(undefined),
        error: jest.fn().mockResolvedValue(undefined),
      }

      const { id } = await prisma.conversation.create({
        data: {
          userId,
          backstory: 'You are a simple bot.',
          model: testLanguageModel,
        },
      })

      await prisma.message.createMany({
        data: [
          {
            conversationId: id,
            type: MessageType.user,
            text: 'Test',
          },
        ],
      })

      conversationId = id

      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId,
          sink,
          functions: [
            {
              name: 'testTool',
              description: 'Test tool',
              parameters: {},
              handler: async () => ({ result: 'ok' }),
            },
          ],
        },
      })

      engine.getFunctions = async () => [
        {
          name: 'testTool',
          description: 'Test tool',
          parameters: {},
          handler: async () => ({ result: 'ok' }),
        },
      ]

      const originalGetConvFunction = engine.getConvFunction.bind(engine)

      engine.getConvFunction = (model) => {
        const convFunction = originalGetConvFunction(model)

        return (input) =>
          convFunction({
            ...input,
            createChatCompletionStream,
            maxCycles: 0,
          })
      }

      const result = await engine.complete()

      const emittedCycleMessage = result.messages.find(
        (message) =>
          message.type === MessageType.bot &&
          message.meta?.cycleDetected === true
      )

      const sinkCycleCall = sink.push.mock.calls.find(
        ([type, data]) =>
          type === TAG_MESSAGE &&
          data?.type === MessageType.bot &&
          data?.meta?.cycleDetected === true
      )

      const persistedMessages = await prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      const persistedCycleMessage = persistedMessages.find(
        (message) =>
          message.type === MessageType.bot &&
          message.meta?.cycleDetected === true
      )

      expect(createChatCompletionStream).toHaveBeenCalledTimes(2)
      expect(emittedCycleMessage).toBeDefined()
      expect(emittedCycleMessage?.text).toBe(
        'I seem to be stuck in a loop. Let me stop here - please try rephrasing your request or providing more details.'
      )
      expect(sinkCycleCall).toBeDefined()
      expect(persistedCycleMessage).toBeDefined()
      expect(persistedCycleMessage?.text).toBe(
        'I seem to be stuck in a loop. Let me stop here - please try rephrasing your request or providing more details.'
      )
    } finally {
      await cleanupConversation(conversationId)
    }
  })

  it('surfaces a timeBudgetCheckpoint activity pair to the model on the next turn', async () => {
    let conversationId

    try {
      const userId = '-'

      const createChatCompletionStream = jest
        .fn()
        .mockImplementation(async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'done',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
          }
        })

      const { id } = await prisma.conversation.create({
        data: {
          userId,
          backstory: 'You are a simple bot.',
          model: testLanguageModel,
        },
      })

      // @note simulate a checkpoint dropped during a previous turn: a
      // request/response activity pair recorded mid-flight by the onProgress
      // listener. The next turn must be able to convert it into the prompt.
      const [checkpointRequest, checkpointResponse] = makeActivityMessagePair(
        '_timeBudgetCheckpoint',
        { mark: 0.5 },
        { elapsedMs: 1000 }
      )

      await prisma.message.createMany({
        data: [
          {
            conversationId: id,
            type: MessageType.user,
            text: 'Test',
          },
          {
            conversationId: id,
            type: MessageType.activity,
            text: checkpointRequest.text,
            meta: checkpointRequest.meta,
          },
          {
            conversationId: id,
            type: MessageType.activity,
            text: checkpointResponse.text,
            meta: checkpointResponse.meta,
          },
        ],
      })

      conversationId = id

      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId,
        },
      })

      const originalGetConvFunction = engine.getConvFunction.bind(engine)

      engine.getConvFunction = (model) => {
        const convFunction = originalGetConvFunction(model)

        return (input) =>
          convFunction({
            ...input,
            createChatCompletionStream,
            maxCycles: 0,
          })
      }

      await engine.complete()

      expect(createChatCompletionStream).toHaveBeenCalled()

      // @note the checkpoint must reach the provider input - i.e. it is visible
      // to the model on this (the next) turn, not silently stripped
      const providerInput = JSON.stringify(
        createChatCompletionStream.mock.calls[0]
      )

      expect(providerInput).toContain('_timeBudgetCheckpoint')
    } finally {
      await cleanupConversation(conversationId)
    }
  })

  it('surfaces a live timeout checkpoint to the model in-flight on a later round, never persisting it', async () => {
    let conversationId

    try {
      const userId = '-'

      const { id } = await prisma.conversation.create({
        data: {
          userId,
          backstory: 'You are a simple bot.',
          model: testLanguageModel,
        },
      })

      await prisma.message.createMany({
        data: [{ conversationId: id, type: MessageType.user, text: 'go' }],
      })

      conversationId = id

      const markController = new AbortController()

      // round 1 asks for a tool and fires the mark mid-stream; round 2 stops. The
      // checkpoint recorded in round 1 must reach the model's prompt on round 2 -
      // surfaced in-flight, not on a later turn.
      const createChatCompletionStream = jest
        .fn()
        .mockImplementationOnce(async function* () {
          markController.abort({ mark: 0.8, elapsedMs: 600000, final: true })

          await delay(20)

          yield {
            error: null,
            finishReason: 'toolCalls',
            completion: null,
            reasoning: null,
            functionCall: null,
            toolCalls: [
              {
                id: 't1',
                type: 'function',
                function: { name: 'noop', arguments: '{}' },
              },
            ],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        })
        .mockImplementationOnce(async function* () {
          yield {
            error: null,
            finishReason: 'stop',
            completion: 'done',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        })

      const noop = {
        name: 'noop',
        description: 'noop',
        parameters: { type: 'object', properties: {} },
        handler: async () => ({ ok: true }),
      }

      const engine = await getStatefulConversationEngine({
        conversationId,
        options: {
          userId,
          features: [{ name: 'timeoutMarks' }],
          markSignals: [markController.signal],
          functions: [noop],
        },
      })

      engine.getFunctions = async () => [noop]

      const originalGetConvFunction = engine.getConvFunction.bind(engine)

      engine.getConvFunction = (model) => {
        const convFunction = originalGetConvFunction(model)

        return (input) => convFunction({ ...input, createChatCompletionStream })
      }

      await engine.complete()

      expect(createChatCompletionStream).toHaveBeenCalledTimes(2)

      // round 1's prompt does NOT carry the checkpoint (it fired after that
      // round's prompt was built)...
      expect(
        JSON.stringify(createChatCompletionStream.mock.calls[0])
      ).not.toContain('_timeBudgetCheckpoint')

      // ...but round 2's prompt does, including the final wrap-up warning
      const round2Input = JSON.stringify(
        createChatCompletionStream.mock.calls[1]
      )

      expect(round2Input).toContain('_timeBudgetCheckpoint')
      expect(round2Input).toContain('dangerously approaching')

      // and it is never written to the conversation log
      const persisted = await prisma.message.findMany({
        where: { conversationId },
      })

      expect(
        persisted.some(
          (message) =>
            message.meta?.activity?.function?.name === '_timeBudgetCheckpoint'
        )
      ).toBe(false)
    } finally {
      await cleanupConversation(conversationId)
    }
  })

  describe('message createdAt ordering', () => {
    it('assigns strictly increasing createdAt to messages written in the same tick', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Hello' }],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        // @note a single addMessages call shares one Date.now() base across all
        // five messages, so this exercises the +1ms tie-break that has to keep
        // them in array order when the wall clock cannot distinguish them.
        await engine.addMessages([
          { type: MessageType.context, text: 'c0' },
          { type: MessageType.context, text: 'c1' },
          { type: MessageType.context, text: 'c2' },
          { type: MessageType.context, text: 'c3' },
          { type: MessageType.context, text: 'c4' },
        ])

        const persisted = await prisma.message.findMany({
          where: { conversationId, type: MessageType.context },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        // ordering by createdAt must reproduce the insertion order
        expect(persisted.map((message) => message.text)).toEqual([
          'c0',
          'c1',
          'c2',
          'c3',
          'c4',
        ])

        const times = persisted.map((message) => message.createdAt.getTime())

        // strictly increasing -> no two messages collide on the same millisecond
        for (let i = 1; i < times.length; i++) {
          expect(times[i]).toBeGreaterThan(times[i - 1])
        }

        // and therefore all distinct
        expect(new Set(times).size).toBe(times.length)
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    it('reflects real elapsed wall-clock time between writes (not a synthetic counter)', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Hello' }],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        await engine.addMessages([{ type: MessageType.context, text: 'early' }])

        await delay(120)

        await engine.addMessages([{ type: MessageType.context, text: 'late' }])

        const [early, late] = await prisma.message.findMany({
          where: { conversationId, type: MessageType.context },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        const gap = late.createdAt.getTime() - early.createdAt.getTime()

        // @note the old counter-based scheme produced a fixed ~1ms gap no matter
        // how much real time passed; with real timestamps the gap must track the
        // ~120ms we actually waited.
        expect(gap).toBeGreaterThanOrEqual(100)
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    it('orders a late _timeBudgetCheckpoint by when it fired, not at the start of the turn', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Hello' }],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        // initial work at the top of the turn
        await engine.addMessages([
          { type: MessageType.reasoning, text: 'step-1' },
          {
            type: MessageType.activity,
            text: '',
            meta: {
              activity: {
                type: 'request',
                function: { name: 'doWork', arguments: {} },
              },
            },
          },
          {
            type: MessageType.activity,
            text: '',
            meta: {
              activity: {
                type: 'response',
                function: { name: 'doWork', arguments: {}, result: 'ok' },
              },
            },
          },
        ])

        // @note the checkpoint is recorded asynchronously much later in the turn
        // (here, after a real delay). It must land where it fired - after the
        // initial work - rather than being wedged at the front as it was when
        // createdAt was a synthetic counter.
        await delay(120)

        const [checkpointRequest, checkpointResponse] = makeActivityMessagePair(
          '_timeBudgetCheckpoint',
          { mark: 0.2 },
          { elapsedMs: 150000 }
        )

        await engine.addMessages([
          {
            type: MessageType.activity,
            text: checkpointRequest.text,
            meta: checkpointRequest.meta,
          },
          {
            type: MessageType.activity,
            text: checkpointResponse.text,
            meta: checkpointResponse.meta,
          },
        ])

        const persisted = await prisma.message.findMany({
          where: { conversationId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        const firstWork = persisted.find(
          (message) =>
            message.type === MessageType.reasoning && message.text === 'step-1'
        )

        const checkpointReqIndex = persisted.findIndex(
          (message) =>
            message.meta?.activity?.function?.name ===
              '_timeBudgetCheckpoint' &&
            message.meta?.activity?.type === 'request'
        )

        const checkpointResIndex = persisted.findIndex(
          (message) =>
            message.meta?.activity?.function?.name ===
              '_timeBudgetCheckpoint' &&
            message.meta?.activity?.type === 'response'
        )

        expect(firstWork).toBeDefined()
        expect(checkpointReqIndex).toBeGreaterThanOrEqual(0)

        // the checkpoint sorts AFTER the initial work, not at the front
        expect(
          persisted.findIndex((message) => message.text === 'step-1')
        ).toBeLessThan(checkpointReqIndex)

        // request immediately precedes its response
        expect(checkpointResIndex).toBe(checkpointReqIndex + 1)

        // and its createdAt reflects the real delay since the initial work
        const checkpointReq = persisted[checkpointReqIndex]

        expect(
          checkpointReq.createdAt.getTime() - firstWork.createdAt.getTime()
        ).toBeGreaterThanOrEqual(100)
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    // negative: the invariants must hold even under adversarial conditions

    it('never produces duplicate or decreasing createdAt even when the wall clock does not advance', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Hello' }],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        // @note freeze the clock so every write observes the same millisecond,
        // across multiple addMessages calls. The watermark must still hand out
        // strictly increasing, distinct timestamps and never reorder.
        const frozen = Date.now()

        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(frozen)

        try {
          await engine.addMessages([
            { type: MessageType.context, text: 'a' },
            { type: MessageType.context, text: 'b' },
          ])
          await engine.addMessages([{ type: MessageType.context, text: 'c' }])
          await engine.addMessages([
            { type: MessageType.context, text: 'd' },
            { type: MessageType.context, text: 'e' },
          ])
        } finally {
          nowSpy.mockRestore()
        }

        const persisted = await prisma.message.findMany({
          where: { conversationId, type: MessageType.context },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        expect(persisted.map((message) => message.text)).toEqual([
          'a',
          'b',
          'c',
          'd',
          'e',
        ])

        const times = persisted.map((message) => message.createdAt.getTime())

        // no ties (negative: a collision must never happen)...
        expect(new Set(times).size).toBe(times.length)

        // ...and never goes backwards; with a frozen clock the tie-break makes
        // each exactly 1ms after the previous one.
        for (let i = 1; i < times.length; i++) {
          expect(times[i]).toBe(times[i - 1] + 1)
        }
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    it('does not cluster a long-running turn into a single millisecond window', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Hello' }],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        // three writes spread across real time, as a turn would be
        await engine.addMessages([{ type: MessageType.context, text: 't0' }])
        await delay(60)
        await engine.addMessages([{ type: MessageType.context, text: 't1' }])
        await delay(60)
        await engine.addMessages([{ type: MessageType.context, text: 't2' }])

        const persisted = await prisma.message.findMany({
          where: { conversationId, type: MessageType.context },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        const span =
          persisted.at(-1).createdAt.getTime() -
          persisted.at(0).createdAt.getTime()

        // negative: the old counter would compress this whole turn into ~2ms;
        // the real span must be at least the ~120ms we spent waiting.
        expect(span).toBeGreaterThanOrEqual(100)
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    it('records a fired timeout mark as an ephemeral live message and never persists it', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Hello' }],
        })

        conversationId = id

        // @note wire up the real timeout-mark mechanism: the engine registers an
        // abort listener on this signal and, when it fires, records the
        // checkpoint through its #recordTimeoutMark -> liveMessages chain. We do
        // NOT add the checkpoint by hand here - the signal does.
        const markController = new AbortController()

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: {
            userId,
            features: [{ name: 'timeoutMarks' }],
            markSignals: [markController.signal],
          },
        })

        const activityCount = () =>
          prisma.message.count({
            where: { conversationId, type: MessageType.activity },
          })

        expect(await activityCount()).toBe(0)
        expect(engine.liveMessages).toHaveLength(0)

        // fire the real mark
        markController.abort({ mark: 0.2, elapsedMs: 150000 })

        await Promise.resolve()

        // CORRECT: the checkpoint is ephemeral - it is NOT written to the
        // conversation log...
        expect(await activityCount()).toBe(0)

        // ...it lives only in the in-memory live-message buffer as a
        // request/response pair carrying the mark that fired
        expect(engine.liveMessages).toHaveLength(2)

        const [request, response] = engine.liveMessages

        expect(request.meta.activity.function.name).toBe(
          '_timeBudgetCheckpoint'
        )
        expect(request.meta.activity.function.arguments).toEqual({ mark: 0.2 })
        expect(response.meta.activity.function.result).toEqual({
          elapsedMs: 150000,
        })
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    it('does not persist a timeout mark fired during a real complete() run', async () => {
      let conversationId

      try {
        const userId = '-'

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [{ conversationId: id, type: MessageType.user, text: 'Test' }],
        })

        conversationId = id

        const markController = new AbortController()

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: {
            userId,
            features: [{ name: 'timeoutMarks' }],
            markSignals: [markController.signal],
          },
        })

        // @note a real streaming completion that fires the mark mid-stream. The
        // mark must NOT pollute the conversation log - it is ephemeral. The
        // completion still finishes normally (a mark is not a cancellation).
        const createChatCompletionStream = jest
          .fn()
          .mockImplementation(async function* () {
            yield {
              error: null,
              finishReason: null,
              completion: 'Hello',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: {
                promptTokens: 10,
                completionTokens: 5,
                totalTokens: 15,
              },
            }

            // fire the real mark signal mid-stream
            markController.abort({ mark: 0.2, elapsedMs: 150000 })

            await delay(20)

            yield {
              error: null,
              finishReason: 'stop',
              completion: ' world',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: {
                promptTokens: 10,
                completionTokens: 10,
                totalTokens: 20,
              },
            }
          })

        const originalGetConvFunction = engine.getConvFunction.bind(engine)

        engine.getConvFunction = (model) => {
          const convFunction = originalGetConvFunction(model)

          return (input) =>
            convFunction({
              ...input,
              createChatCompletionStream,
              maxCycles: 0,
            })
        }

        await engine.complete()

        expect(createChatCompletionStream).toHaveBeenCalled()

        const persisted = await prisma.message.findMany({
          where: { conversationId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        // the mark did not pollute the conversation log
        expect(
          persisted.some(
            (message) =>
              message.meta?.activity?.function?.name === '_timeBudgetCheckpoint'
          )
        ).toBe(false)

        // the completion still finished normally - the mark does not abort it
        const bot = persisted.find(
          (message) => message.type === MessageType.bot
        )

        expect(bot.text).toBe('Hello world')

        // the checkpoint lived only in the ephemeral buffer - no later round
        // consumed and drained it in this single-round run
        expect(
          engine.liveMessages.some(
            (message) =>
              message.meta?.activity?.function?.name === '_timeBudgetCheckpoint'
          )
        ).toBe(true)
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    it('preserves real per-message createdAt within a single bulk insert', async () => {
      let conversationId

      try {
        const userId = '-'
        const T = Date.now()

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        // @note seed the conversation in the past so the batch's real creation
        // times are all after it (and therefore honored, not clamped forward).
        await prisma.message.createMany({
          data: [
            {
              conversationId: id,
              type: MessageType.user,
              text: 'Hello',
              createdAt: new Date(T - 60000),
            },
          ],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        const t1 = new Date(T - 50000)
        const t2 = new Date(T - 40000)
        const t3 = new Date(T - 30000)

        // a single bulk insert carrying distinct, spread-apart real times
        await engine.addMessages([
          { type: MessageType.reasoning, text: 'm1', createdAt: t1 },
          { type: MessageType.reasoning, text: 'm2', createdAt: t2 },
          { type: MessageType.reasoning, text: 'm3', createdAt: t3 },
        ])

        const persisted = await prisma.message.findMany({
          where: { conversationId, type: MessageType.reasoning },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        expect(persisted.map((message) => message.text)).toEqual([
          'm1',
          'm2',
          'm3',
        ])

        // the true times survive the bulk insert - not collapsed to the flush
        // instant the way a write-time-only scheme would
        expect(persisted[0].createdAt.getTime()).toBe(t1.getTime())
        expect(persisted[1].createdAt.getTime()).toBe(t2.getTime())
        expect(persisted[2].createdAt.getTime()).toBe(t3.getTime())

        // ~20s apart, proving they were not bunched into one millisecond window
        expect(
          persisted[2].createdAt.getTime() - persisted[0].createdAt.getTime()
        ).toBeGreaterThanOrEqual(19000)
      } finally {
        await cleanupConversation(conversationId)
      }
    })

    // negative: missing / out-of-order / invalid createdAt must not break order

    it('falls back to write-time and clamps an out-of-order or invalid createdAt', async () => {
      let conversationId

      try {
        const userId = '-'
        const T = Date.now()

        const { id } = await prisma.conversation.create({
          data: {
            userId,
            backstory: 'You are a simple bot.',
            model: testLanguageModel,
          },
        })

        await prisma.message.createMany({
          data: [
            {
              conversationId: id,
              type: MessageType.user,
              text: 'Hello',
              createdAt: new Date(T - 60000),
            },
          ],
        })

        conversationId = id

        const engine = await getStatefulConversationEngine({
          conversationId,
          options: { userId },
        })

        const honored = new Date(T - 50000)

        await engine.addMessages([
          // in-order real time -> honored exactly
          { type: MessageType.reasoning, text: 'honored', createdAt: honored },
          // no createdAt -> write time (~now)
          { type: MessageType.reasoning, text: 'missing' },
          // earlier than the already-assigned one -> clamped forward, not honored
          {
            type: MessageType.reasoning,
            text: 'stale',
            createdAt: new Date(T - 55000),
          },
          // unparseable -> falls back to write time
          {
            type: MessageType.reasoning,
            text: 'invalid',
            createdAt: new Date('not-a-date'),
          },
        ])

        const persisted = await prisma.message.findMany({
          where: { conversationId, type: MessageType.reasoning },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        expect(persisted.map((message) => message.text)).toEqual([
          'honored',
          'missing',
          'stale',
          'invalid',
        ])

        const at = Object.fromEntries(
          persisted.map((message) => [
            message.text,
            message.createdAt.getTime(),
          ])
        )

        // the in-order real time is honored exactly
        expect(at.honored).toBe(honored.getTime())

        // the missing one falls back to write time, after the honored one
        expect(at.missing).toBeGreaterThan(at.honored)
        expect(at.missing).toBeGreaterThanOrEqual(T - 1000)

        // the stale (too-early) createdAt is clamped to preserve order, NOT honored
        expect(at.stale).toBe(at.missing + 1)
        expect(at.stale).not.toBe(new Date(T - 55000).getTime())

        // the invalid createdAt falls back to write time and stays in order
        expect(at.invalid).toBeGreaterThan(at.stale)

        // overall strictly increasing
        const ordered = persisted.map((message) => message.createdAt.getTime())

        for (let i = 1; i < ordered.length; i++) {
          expect(ordered[i]).toBeGreaterThan(ordered[i - 1])
        }
      } finally {
        await cleanupConversation(conversationId)
      }
    })
  })
})
