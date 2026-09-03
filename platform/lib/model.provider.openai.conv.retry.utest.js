import { TAG_COMPLETE_END, TAG_TOKEN } from '@/lib/conversation.tag'
import { SystemError } from '@/lib/error'
import { completeChatConversation } from '@/lib/model.provider.openai.conv'

import { installOpenAITestLanguageModels } from '@/jest/utils/openai'

const restoreTestLanguageModels = installOpenAITestLanguageModels()

afterAll(restoreTestLanguageModels)

/**
 * Regression coverage for a transient AI Gateway 503
 * ("Service temporarily unavailable") thrown by the provider terminated the
 * whole run instead of being retried.
 *
 * Two retry layers exist, and both were closed to a 5xx:
 *
 *  - the adaptor's own short loop (3 attempts, sub-second backoff) skipped it,
 *    because retriability was decided by matching the error *prose* and the
 *    gateway's wording ("Service temporarily unavailable") did not match the
 *    `/service unavailable/i` pattern. Covered by model.retry.utest.js.
 *
 *  - the conv round's catch, exercised here, recovered only a fetch TimeoutError
 *    and re-threw everything else - so once the adaptor gave up, the error became
 *    `reason: 'error'` and hard-failed the run. A 5xx now gets the same
 *    continuation-bounded re-issue a stall gets.
 *
 * The stream is injected directly, so the adaptor's loop is out of the picture
 * and this asserts the *conv-level* behaviour on its own.
 */

/**
 * A stream chunk in the shape the chat round consumes.
 */
function chunk(overrides = {}) {
  return {
    error: null,
    finishReason: null,
    completion: null,
    reasoning: null,
    functionCall: null,
    toolCalls: null,
    usage: null,
    ...overrides,
  }
}

async function drain(options) {
  const tokens = []
  const reasons = []

  for await (const item of completeChatConversation(options)) {
    if (item.type === TAG_TOKEN) {
      tokens.push(item.data.token)
    }

    if (item.type === TAG_COMPLETE_END) {
      reasons.push(item.data.reason)
    }
  }

  return { text: tokens.join(''), reasons }
}

describe('conv recoverable provider errors', () => {
  it('re-issues the round after a gateway 503 and completes the run', async () => {
    let attempts = 0

    const { text, reasons } = await drain({
      model: 'gpt-4o',
      messages: [{ type: 'user', text: 'hello' }],
      createChatCompletionStream: () =>
        (async function* () {
          attempts++

          if (attempts === 1) {
            throw new SystemError(
              'Service temporarily unavailable. Please try again shortly. (503)',
              'VR_SERVICE_UNAVAILABLE'
            )
          }

          yield chunk({ completion: 'recovered answer' })
          yield chunk({ finishReason: 'stop' })
        })(),
    })

    // the round was re-issued rather than abandoned
    expect(attempts).toBe(2)

    // and the run produced a real answer, ending on a terminal stop
    expect(text).toContain('recovered answer')
    expect(reasons[reasons.length - 1]).toBe('stop')
  })

  it('does not retry a terminal 404 from the provider', async () => {
    let attempts = 0

    let thrown

    try {
      await drain({
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'hello' }],
        createChatCompletionStream: () =>
          (async function* () {
            attempts++

            throw new SystemError(
              'Publisher model gemini-3.1-flash-lite-preview was not found or your project does not have access to it. (404)',
              'VR_NOT_FOUND'
            )

            yield chunk()
          })(),
      })
    } catch (error) {
      thrown = error
    }

    // a missing model is the caller's problem - re-issuing it just burns budget
    expect(attempts).toBe(1)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.message).toContain('was not found')
  })

  it('gives up once the continuation budget is spent', async () => {
    let attempts = 0

    let thrown

    try {
      await drain({
        model: 'gpt-4o',
        messages: [{ type: 'user', text: 'hello' }],

        // @note keep the budget tiny so the test does not re-issue 20 times
        maxContinuations: 2,

        createChatCompletionStream: () =>
          (async function* () {
            attempts++

            throw new SystemError(
              'Service temporarily unavailable. Please try again shortly. (503)',
              'VR_SERVICE_UNAVAILABLE'
            )

            yield chunk()
          })(),
      })
    } catch (error) {
      thrown = error
    }

    // a persistent outage still terminates the run - it just does so after the
    // budget is spent rather than on the first blip
    expect(attempts).toBeGreaterThan(1)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.message).toContain('Service temporarily unavailable')
  })
})
