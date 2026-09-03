// @ts-check
import { getTextTokensLength } from '@chatbotkit-dev/gpt'

import { logError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import {
  createTextCompletion,
  getOpenAIError,
} from '@/lib/model.provider.openai'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'
import { genericError, ok } from '@/lib/response'
import { Usage } from '@/lib/usage.model'

import { openaiLanguageModel } from '@/schemas/languageModel'

export const PADDING_RATIO = 0.9

const defaultLanguageModel = 'text-davinci-003'

export const bodySchema = schema.object({
  prompt: schema.string(),

  model: openaiLanguageModel,

  stop: schema.array().items(schema.string()).default(['<|endoftext|>']),
})

// @todo add streaming support
// @todo expose route details

export default withPost(
  withSessionLimits(
    ['token'],
    withSchema(bodySchema, async function (req, session, body) {
      const { prompt, model, stop } = body

      if (!prompt) {
        return ok({ completion: '' })
      }

      const {
        name: modelName,
        config: { maxTokens, temperature, frequencyPenalty, presencePenalty },
      } = parseAndRevealLanguageModel(model || defaultLanguageModel)

      const textTokensLength = getTextTokensLength(prompt, modelName)

      let response

      try {
        // @todo choose the correct method based on the model

        response = await createTextCompletion({
          model: modelName,

          maxTokens: Math.round((maxTokens - textTokensLength) * PADDING_RATIO),

          temperature: temperature,
          frequencyPenalty: frequencyPenalty,
          presencePenalty: presencePenalty,

          prompt: prompt,

          stop: stop,

          user: session.user.id,
        })
      } catch (e) {
        await logError(e)

        return genericError(getOpenAIError(e))
      }

      const {
        completion,
        usage: { totalTokens: tokens },
      } = response

      await Usage.createAndRecord({
        user: session.user,
        token: tokens,
        model: modelName,
        meta: {
          reason: 'text/complete',
        },
      })

      return ok({ completion })
    })
  )
)

// @note this API route is not public - no documentation available
