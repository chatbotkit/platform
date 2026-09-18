// @ts-check
import { createDecision } from '@/lib/decision.core'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { withStream } from '@/lib/stream'
import { Usage } from '@/lib/usage.model'

import decisionModelSchema from '@/schemas/decisionModel'

const inputSchema = schema.alternatives(
  schema.string(),
  schema.object(),
  schema.array()
)

const criterionSchema = inputSchema.allow(null)

const questionSchema = schema.object({
  type: schema.string().valid('boolean', 'choice', 'score').required(),

  instructions: inputSchema.required(),

  criteria: schema.when('type', {
    switch: [
      {
        is: 'boolean',
        then: schema.object({
          true: criterionSchema.required(),
          false: criterionSchema.required(),
        }),
      },
      {
        is: 'choice',
        then: schema
          .object()
          .pattern(schema.string(), criterionSchema)
          .min(2)
          .max(255)
          .required(),
      },
      {
        is: 'score',
        then: schema.array().items(criterionSchema).min(2).max(10).required(),
      },
    ],
  }),
})

export const bodySchema = schema.object({
  model: decisionModelSchema,

  state: inputSchema.required(),

  questions: schema
    .object()
    .pattern(schema.string(), questionSchema)
    .min(1)
    .required(),
})

/**
 * @swagger
 *
 * /decision/create:
 *   post:
 *     operationId: createDecision
 *     summary: Answer typed questions about a state
 *     tags:
 *       - Decision
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 description: The decision model to use
 *                 type: string
 *               state:
 *                 description: The content to decide about, as text or a JSON object or array of related context
 *                 oneOf:
 *                   - type: string
 *                   - type: object
 *                     additionalProperties: true
 *                   - type: array
 *                     items: {}
 *               questions:
 *                 description: The questions to answer keyed by a name of your choice
 *                 type: object
 *                 minProperties: 1
 *                 additionalProperties:
 *                   $ref: '#/components/schemas/DecisionQuestion'
 *             required:
 *               - state
 *               - questions
 *     responses:
 *       200:
 *         description: The decision was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answers:
 *                   description: The answers keyed by the question names
 *                   type: object
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/DecisionAnswer'
 *                 usage:
 *                   type: object
 *                   properties:
 *                     model:
 *                       description: The model that answered
 *                       type: string
 *                     inputTokens:
 *                       type: number
 *                     outputTokens:
 *                       type: number
 *                   required:
 *                     - model
 *                     - inputTokens
 *                     - outputTokens
 *               required:
 *                 - answers
 *                 - usage
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['token'],
    withSchema(
      bodySchema,
      withStream(async function (_req, stream, session, body) {
        const { model, state, questions } = body

        const { answers, usage } = await createDecision(state, questions, {
          model,
          signal: stream.abortSignal,
        })

        const usageRecorder = new Usage()

        usageRecorder.addDecisionTokens(usage.inputTokens, usage.model, 'input')
        usageRecorder.addDecisionTokens(
          usage.outputTokens,
          usage.model,
          'output'
        )

        await usageRecorder.recordBaseTokens({
          user: session.user,
          meta: {
            reason: 'decision/create',
          },
        })

        await stream.result({
          answers,
          usage,
        })
      })
    )
  )
)

/**
 * @manual Decisions
 * @description Decisions answer typed questions about a piece of state and return probabilities, for classification, routing, rubric scoring and verification.
 * @category Platform
 * @tags decisions, models, classification, routing
 * @index 14
 *
 * A decision model reads a state and answers one or more typed questions about
 * it. Unlike a language model it does not generate text: every answer is a
 * structured value with probabilities, so code can act on it directly. Use it
 * to classify a message, route a conversation, score something against a
 * rubric, or verify that an outcome happened.
 *
 * ## Creating a Decision
 *
 * ```http
 * POST /api/v1/decision/create
 * Content-Type: application/json
 *
 * {
 *   "state": "I was charged twice and need this fixed today",
 *   "questions": {
 *     "urgent": {
 *       "type": "boolean",
 *       "instructions": "Does this convey urgency?"
 *     },
 *     "topic": {
 *       "type": "choice",
 *       "instructions": "Which team should handle this?",
 *       "criteria": {
 *         "billing": "Payment or subscription issues",
 *         "technical": "Bugs or integration problems"
 *       }
 *     },
 *     "frustration": {
 *       "type": "score",
 *       "instructions": "How frustrated is the customer?",
 *       "criteria": ["Calm", "Frustrated but civil", "Very angry"]
 *     }
 *   }
 * }
 * ```
 *
 * The `state` is the content to decide about. It can be text, or a JSON object
 * or array of related context, such as a record or a message history. The
 * `questions` are keyed by a name of your choice and the answers come back
 * under the same names. All questions are answered in one request.
 *
 * ## Question Types
 *
 * - **boolean**: a yes or no question. `criteria` is optional and, when given,
 *   describes what `true` and `false` mean.
 * - **choice**: one of several named options. `criteria` maps each option name
 *   to a description, or to `null` when the name says enough. It takes between
 *   2 and 255 options.
 * - **score**: a level on an ordered scale. `criteria` lists the levels from
 *   lowest to highest and takes between 2 and 10 of them.
 *
 * `instructions`, and each criterion, accept text or a JSON object or array.
 *
 * ## Reading the Answers
 *
 * ```json
 * {
 *   "answers": {
 *     "urgent": { "type": "boolean", "probability": 0.97 },
 *     "topic": {
 *       "type": "choice",
 *       "choice": "billing",
 *       "probabilities": { "billing": 0.9, "technical": 0.1 }
 *     },
 *     "frustration": {
 *       "type": "score",
 *       "score": 1.2,
 *       "probabilities": { "0": 0.1, "1": 0.6, "2": 0.3 }
 *     }
 *   },
 *   "usage": { "model": "jev", "inputTokens": 120, "outputTokens": 8 }
 * }
 * ```
 *
 * A boolean answer is the probability, from 0 to 1, that the answer is true.
 * Compare it against a threshold that suits the cost of a wrong decision. A
 * choice answer names the most likely option and the probability of each. A
 * score answer is the probability-weighted level index, starting at 0, so it
 * can fall between two levels.
 *
 * ## Choosing a Model
 *
 * The `model` field is optional and defaults to the deployment's default
 * decision model. List the decision models a deployment serves with:
 *
 * ```http
 * GET /api/v1/platform/model/list?type=decision
 * ```
 *
 * ## Usage
 *
 * Decisions are metered against the token limit on the tokens the model
 * reports, using the same calibration as other model classes.
 */
