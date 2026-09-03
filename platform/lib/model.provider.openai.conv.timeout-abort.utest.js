import {
  TAG_COMPLETE_END,
  TAG_MESSAGE,
  TAG_TOKEN,
} from '@/lib/conversation.tag'
import { AbortError } from '@/lib/fetch'
import {
  HANDLER_DEADLINE_GRACE_MS,
  completeChatConversation,
} from '@/lib/model.provider.openai.conv'

import { installOpenAITestLanguageModels } from '@/jest/utils/openai'

const restoreTestLanguageModels = installOpenAITestLanguageModels()

afterAll(restoreTestLanguageModels)

/**
 * Regression coverage for a queue-handler timeout and the adjacent symptom: a
 * trigger/batch run that times out and saves NOTHING - not
 * the run's messages, not even the timeout-mark breadcrumbs.
 *
 * The queue handler wires the 750s hard-timeout monitor signal into the engine
 * (pages/api/v1/integration/trigger/[triggerIntegrationId]/queue.js) on the
 * premise that the deadline surfaces as a catchable AbortError so the engine can
 * salvage + persist partial output within the ~50s buffer before Vercel's 800s
 * hard kill. In batch/settle mode the whole multi-turn run is buffered and
 * persisted in a single write at the very END of CoreEngine.complete()
 * (conversation.engine.js) - reached only after the conv generator returns.
 *
 * These tests isolate WHERE that premise holds and where it breaks:
 *
 *  - It holds only while the run is blocked INSIDE a model fetch: an abort there
 *    is re-thrown out of the conv generator (completeChatConversationStream's
 *    outer catch -> `throw e`), which the engine's stream() catch turns into a
 *    graceful salvage.
 *
 *  - It breaks while the run is executing a TOOL handler: handlers are invoked
 *    as `func.handler(args, { newMessages })` with NO abort signal, and the
 *    agentic loop does not consult the abort signal at iteration boundaries
 *    (isIterationLimitReached checks yieldSignal, not abortSignal). So a tool
 *    that does not return on its own cannot be interrupted by the deadline; the
 *    loop only reacts once it RE-ENTERS a fetch. If a single tool call outlives
 *    the 50s buffer, the run never returns, complete() never reaches its single
 *    persist call, and the entire buffered run is discarded by the hard kill.
 */

/**
 * Minimal deferred promise helper.
 *
 * @returns {{ promise: Promise<void>, resolve: () => void }}
 */
function deferred() {
  let resolve

  const promise = new Promise((res) => {
    resolve = res
  })

  // @ts-ignore - resolve is assigned synchronously by the Promise executor
  return { promise, resolve }
}

describe('conv timeout-abort handling', () => {
  it('re-throws an abort raised while reading the model stream (the salvageable path)', async () => {
    // @note simulate the deadline firing mid-stream: undici aborts the response
    // body read and the chunk iterator throws an AbortError. This is the ONLY
    // shape the engine can salvage, because the conv generator re-throws it.

    const abortController = new AbortController()

    const tokens = []

    const options = {
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      abortSignal: abortController.signal,
      createChatCompletionStream: () =>
        (async function* () {
          // one token lands, then the deadline aborts the body read mid-stream
          yield {
            error: null,
            finishReason: null,
            completion: 'partial answer',
            reasoning: null,
            functionCall: null,
            toolCalls: null,
            usage: null,
          }

          abortController.abort()

          throw new AbortError('aborted while streaming body')
        })(),
    }

    let thrown

    try {
      for await (const item of completeChatConversation(options)) {
        if (item.type === TAG_TOKEN) {
          tokens.push(item.data.token)
        }
      }
    } catch (error) {
      thrown = error
    }

    // the abort propagates promptly out of the generator -> engine.stream()
    // catches ABORT_ERROR_NAME and salvages whatever streamed before it
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.name).toBe('AbortError')

    // and the partial token actually streamed before the abort, so there IS
    // something to salvage on this path
    expect(tokens.join('')).toContain('partial answer')
  })

  it('bypasses a tool that does not return before the deadline and stops the run with a paired result', async () => {
    // @note the incident shape: the deadline fires while the loop is parked at
    // `await func.handler(...)` and the tool ignores the signal. The loop must
    // hand the handler the signal, give it a short grace, then bypass it -
    // recording a PAIRED timeout response for the tool call (so the model is not
    // left with a dangling, unanswered tool call) - and stop with reason 'abort'
    // without starting another model round.

    jest.useFakeTimers()

    try {
      const abortController = new AbortController()

      const handlerEntered = deferred()

      /** @type {Record<string, any> | undefined} */
      let handlerContext

      let handlerReturned = false
      let streamCalls = 0

      const options = {
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'do the thing' }],
        abortSignal: abortController.signal,
        // @note background + settle mirrors the trigger queue handler's engine
        background: true,
        maxCalls: 10,
        maxCycles: 10,
        functions: [
          {
            name: 'slowTool',
            description: 'A tool that never returns on its own',
            parameters: { type: 'object', properties: {} },
            handler: async (args, context) => {
              handlerContext = context

              handlerEntered.resolve()

              // never returns and never observes the signal - the "does not
              // comply" case
              await new Promise(() => {})

              handlerReturned = true

              return { ok: true }
            },
          },
        ],
        createChatCompletionStream: () => {
          streamCalls += 1

          const round = streamCalls

          return (async function* () {
            if (round === 1) {
              // round 1: model asks for the slow tool
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
                usage: {
                  promptTokens: 10,
                  completionTokens: 5,
                  totalTokens: 15,
                },
              }

              return
            }

            // must NOT be reached: the deadline already fired, so the loop must
            // stop rather than start another model round
            yield {
              error: null,
              finishReason: 'stop',
              completion: 'done',
              reasoning: null,
              functionCall: null,
              toolCalls: null,
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }
          })()
        },
      }

      const items = []

      const consume = (async () => {
        for await (const item of completeChatConversation(options)) {
          items.push(item)
        }
      })()

      // wait until the loop is parked inside the tool handler
      await handlerEntered.promise

      // the handler is given the abort signal so a cooperative tool could cancel
      expect(handlerContext.signal).toBeInstanceOf(AbortSignal)

      // the deadline fires while the tool is mid-flight
      abortController.abort()

      expect(handlerContext.signal.aborted).toBe(true)

      // advance past the handler grace - the loop bypasses the hung tool
      await jest.advanceTimersByTimeAsync(HANDLER_DEADLINE_GRACE_MS + 100)

      await consume

      // the hung tool never returned, yet the run finished
      expect(handlerReturned).toBe(false)

      // no second model round was started after the deadline
      expect(streamCalls).toBe(1)

      // the bypassed tool call still got a PAIRED response activity (no dangling
      // tool call), carrying the timeout error as its result
      const slowToolResponse = items.find(
        (item) =>
          item.type === TAG_MESSAGE &&
          item.data?.meta?.activity?.type === 'response' &&
          item.data?.meta?.activity?.function?.name === 'slowTool'
      )

      expect(slowToolResponse).toBeDefined()
      // @note the result is serialized to a string in the activity record
      expect(slowToolResponse.data.meta.activity.function.result).toContain(
        'deadline'
      )

      // the run ended with reason 'abort', never a normal 'stop'
      const completeEnd = items.filter((item) => item.type === TAG_COMPLETE_END)

      expect(completeEnd.at(-1).data.reason).toBe('abort')
      expect(completeEnd.every((item) => item.data.reason !== 'stop')).toBe(
        true
      )
    } finally {
      jest.useRealTimers()
    }
  }, 15000)
})
