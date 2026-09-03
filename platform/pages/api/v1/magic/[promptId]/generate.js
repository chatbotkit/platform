// @ts-check
import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { aliasToPromptIdMap, prompts } from '@/lib/magic'
import { withPost } from '@/lib/method'
import { getBaseLanguageModelTokenCount } from '@/lib/model.utils'
import { execPrompt } from '@/lib/prompt'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotFound } from '@/lib/response'
import { Usage } from '@/lib/usage.model'

import modelSchema from '@/schemas/languageModel'

export const bodySchema = schema.object({
  text: schema.string().required(),

  props: schema.object(),

  model: modelSchema,
})

/**
 * @swagger
 *
 * /magic/{promptId}/generate:
 *   post:
 *     operationId: generateMagicFromPrompt
 *     summary: Generate text (description, records, abilities and more) based on input.
 *     tags:
 *       - Magic
 *     parameters:
 *       - in: path
 *         name: promptId
 *         required: true
 *         schema:
 *           description: The ID of the prompt to use for generation
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 description: The text to use as input
 *                 type: string
 *               props:
 *                 description: Additional properties to pass to the prompt
 *                 type: object
 *               model:
 *                 description: Optional language model to use for generation
 *                 type: string
 *             required:
 *               - text
 *     responses:
 *       200:
 *         description: The magic prompt completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   description: The input text
 *                   type: string
 *                 usage:
 *                   $ref: '#/components/schemas/Usage'
 *               required:
 *                 - text
 *                 - usage
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The generated text
 *                       type: string
 *                       enum:
 *                         - result
 *                     data:
 *                       $ref: '#/paths/~1magic~1{promptId}~1generate/post/responses/200/content/application~1json/schema'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const { text, model, props } = body

        const prompt =
          prompts[requiredUrlParam(req, 'promptId')] ||
          prompts[aliasToPromptIdMap[requiredUrlParam(req, 'promptId')]]

        if (!prompt) {
          return throwNotFound()
        }

        // @todo validate the props against the prompt schema

        const { completion, tokensUsed, modelUsed } = await execPrompt(
          { model, ...prompt, user: session.user.id },
          { ...props, input: text },
          {
            sink: {
              push: async (type, data) => {
                switch (type) {
                  case 'token': {
                    const tokenData = /** @type {{token: string}} */ (data)

                    await stream.push({
                      type: 'token',
                      data: {
                        token: tokenData.token,
                      },
                    })

                    break
                  }
                }
              },
            },

            abortSignal: stream.abortSignal,
          }
        )

        await Usage.createAndRecord({
          user: session.user,
          token: tokensUsed,
          model: modelUsed,
          meta: {
            reason: 'magic/generate',
          },
        })

        await stream.result({
          text: completion,
          usage: {
            token: getBaseLanguageModelTokenCount(modelUsed, tokensUsed),
          },
        })
      })
    )
  )
)

// @note do not document this file for now
