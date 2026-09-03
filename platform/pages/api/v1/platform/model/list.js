// @ts-check
import {
  defaultImageModel,
  defaultLanguageModel,
  defaultRerankModel,
  defaultVideoModel,
  imageModels,
  languageModels,
  rerankModels,
  videoModels,
} from '@/config/models'

import { withStreamCursor } from '@/lib/stream'
import { withGet } from '@/lib/method'
import { getQuery } from '@/lib/query.get'
import { throwBadRequest } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

const modelCatalogues = {
  language: languageModels,
  image: imageModels,
  video: videoModels,
  rerank: rerankModels,
}

// @note evaluated server-side, so these reflect the deployment's real,
// credential-gated defaults - the browser's compiled defaults do not
const modelDefaults = {
  language: defaultLanguageModel,
  image: defaultImageModel,
  video: defaultVideoModel,
  rerank: defaultRerankModel,
}

/**
 * @swagger
 *
 * /platform/model/list:
 *   get:
 *     operationId: listPlatformModels
 *     summary: Retrieve a list of platform models
 *     tags:
 *       - Platform
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           description: The type of models to list
 *           type: string
 *           enum:
 *             - language
 *             - image
 *             - video
 *             - rerank
 *           default: language
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of models was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             description: The type of the model
 *                             type: string
 *                             enum:
 *                               - language
 *                               - image
 *                               - video
 *                               - rerank
 *                           default:
 *                             description: Whether this model is the deployment's default for its type
 *                             type: boolean
 *                           provider:
 *                             description: The backstory of the model
 *                             type: string
 *                           family:
 *                             description: The model of the model
 *                             type: string
 *                           maxTokens:
 *                             description: The maximum number of tokens the model can use
 *                             type: number
 *                           maxInputTokens:
 *                             description: The maximum number of tokens the model can accept
 *                             type: number
 *                           maxOutputTokens:
 *                             description: The maximum number of tokens the model can generate
 *                             type: number
 *                         required:
 *                           - type
 *                           - provider
 *                           - family
 *                           - maxTokens
 *                           - maxInputTokens
 *                           - maxOutputTokens
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1platform~1model~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req) {
      if (cursor) {
        return {
          items: [],
        }
      }

      const type = getQuery(req).get('type') || 'language'

      const catalogue = modelCatalogues[type]

      if (!catalogue) {
        throwBadRequest('unknown model type')
      }

      return {
        items: Object.entries(catalogue)
          .filter(([, { visible }]) => {
            return visible
          })
          .map(
            ([
              id,
              {
                description,
                provider,
                family,
                maxTokens,
                maxInputTokens,
                maxOutputTokens,
              },
            ]) => {
              return {
                id,

                type,

                default: id === modelDefaults[type] || undefined,

                description,

                provider,

                family,

                maxTokens,
                maxInputTokens,
                maxOutputTokens,

                // @todo add pricing

                createdAt: Date.now(),
                updatedAt: Date.now(),
              }
            }
          ),
      }
    })
  )
)

/**
 * @manual Platform Models
 * @description Language models are the AI engines that power conversational experiences, with each model offering different capabilities, performance characteristics, and token limits.
 * @category Platform
 * @tags models, language-models, ai, llm
 * @index 12
 *
 * The platform integrates with multiple language model providers and model
 * families, giving you the flexibility to choose the right AI engine for your
 * specific needs. Different models excel at different tasks - some are
 * optimized for speed and efficiency, while others prioritize reasoning
 * capability, creativity, or specialized knowledge domains.
 *
 * ## Discovering Available Models
 *
 * To see which language models are currently available on the platform and
 * accessible with your account:
 *
 * ```http
 * GET /api/v1/platform/model/list
 * ```
 *
 * The response provides detailed information about each model including:
 *
 * - **id**: Unique identifier for the model (e.g., "glm-5.2", "claude-4.8-opus")
 * - **description**: Overview of the model's capabilities and characteristics
 * - **provider**: The organization providing the model (OpenAI, Anthropic, etc.)
 * - **family**: The model family or series it belongs to
 * - **maxTokens**: Total token capacity (input + output combined)
 * - **maxInputTokens**: Maximum tokens that can be sent to the model
 * - **maxOutputTokens**: Maximum tokens the model can generate in response
 *
 * ## Understanding Token Limits
 *
 * Token limits are critical when working with language models. Tokens are
 * pieces of text that models process - roughly equivalent to words, though
 * the exact tokenization varies by model. When building conversational
 * applications, you need to account for:
 *
 * 1. **Input tokens**: Your prompt, system instructions, conversation history, and context
 * 2. **Output tokens**: The model's generated response
 * 3. **Total tokens**: The sum of input and output, which cannot exceed `maxTokens`
 *
 * If you exceed token limits, the model will either truncate input or fail to
 * process the request. Design your applications to manage context efficiently,
 * potentially summarizing or truncating conversation history for long
 * interactions.
 *
 * ## Choosing the Right Model
 *
 * Different models have different strengths:
 *
 * - **Large context models** (high maxInputTokens): Ideal for processing lengthy documents or maintaining extensive conversation history
 * - **Fast models** (optimized for speed): Best for real-time chat applications requiring quick responses
 * - **Reasoning models** (optimized for accuracy): Suitable for complex analytical tasks, problem-solving, or technical questions
 * - **Specialized models**: Some models excel at code generation, creative writing, or specific language tasks
 *
 * ```javascript
 * {
 *   "id": "glm-5.2",
 *   "description": "Powerful coding model with usable 1M-context support",
 *   "provider": "vercel",
 *   "family": "glm",
 *   "maxTokens": 1040000,
 *   "maxInputTokens": 912000,
 *   "maxOutputTokens": 128000
 * }
 * ```
 *
 * ## Model Availability and Visibility
 *
 * The list endpoint only returns models that are visible and accessible based
 * on your subscription plan. Some advanced or specialized models may require
 * specific plan levels or additional agreements. Model availability may also
 * change as new models are released or deprecated by providers.
 *
 * **Note:** Model pricing, which varies by provider and model, will be added
 * to the API response in a future update. For current pricing information,
 * refer to the platform documentation or your account dashboard.
 */
