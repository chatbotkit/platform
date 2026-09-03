// @ts-check
import allAbilities from '@/data/abilities/all'

import { definitions } from '@/lib/action.definition'
import { ActionName } from '@/lib/action.name'
import { withStreamCursor } from '@/lib/stream'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /platform/action/list:
 *   get:
 *     operationId: listPlatformActions
 *     summary: Retrieve a list of platform actions
 *     tags:
 *       - Platform
 *     parameters:
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
 *         description: The list of actions was retrieved successfully
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
 *                           description:
 *                             description: The description of the action
 *                             type: string
 *                           examples:
 *                             description: Example demonstrating the action usage
 *                             type: array
 *                             items:
 *                               type: string
 *                         required:
 *                           - description
 *                           - examples
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
 *                       $ref: '#/paths/~1platform~1action~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor) {
      if (cursor) {
        return {
          items: [],
        }
      }

      return {
        items: Object.entries(ActionName).map(([key, id]) => {
          const definition = definitions[id]

          const examples = definition.examples
            .map((exampleRef) => {
              if (exampleRef.startsWith('@')) {
                const abilityKey = exampleRef.substring(1)
                const ability = allAbilities[abilityKey]

                if (ability && ability.instruction) {
                  return ability.instruction
                }
              }

              return null
            })
            .filter(Boolean)

          return {
            id,

            name: key,
            description: definition.description,

            examples,

            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }),
      }
    })
  )
)

/**
 * @manual Platform Actions
 * @description Actions are fundamental operations that conversational AI agents can perform, providing a standardized way to execute common tasks and behaviors within conversations.
 * @category Platform
 * @tags actions, platform, operations
 * @index 11
 *
 * Actions represent the core set of operations that your conversational AI
 * agents can execute during interactions. Unlike abilities which are
 * configurable capabilities, actions are predefined operations that handle
 * common conversational tasks such as responding to users, asking questions,
 * retrieving information, or triggering workflows.
 *
 * ## Understanding Platform Actions
 *
 * The platform provides a curated set of actions that have been designed to
 * work seamlessly with the conversational AI framework. Each action is
 * carefully defined with clear semantics and expected behaviors, ensuring
 * consistent and reliable operation across different contexts and use cases.
 *
 * To retrieve the complete catalog of available platform actions:
 *
 * ```http
 * GET /api/v1/platform/action/list
 * ```
 *
 * Each action in the response includes:
 *
 * - **id**: Unique identifier for the action
 * - **name**: Standardized name following action naming conventions
 * - **description**: Clear explanation of what the action does and when to use it
 * - **examples**: Real-world examples demonstrating how to invoke the action
 *
 * ## Action Examples and Usage Patterns
 *
 * The `examples` array is particularly valuable as it provides concrete
 * demonstrations of how each action should be used in practice. These examples
 * often reference specific abilities (indicated by the `@` prefix) and show
 * the exact syntax and structure needed to invoke the action correctly.
 *
 * ```javascript
 * {
 *   "id": "search-and-respond",
 *   "name": "SearchAndRespond",
 *   "description": "Search for information and provide a response",
 *   "examples": [
 *     "Search the web for (query) and summarize the findings",
 *     "Look up information about (topic) and explain it"
 *   ]
 * }
 * ```
 *
 * ## Building with Actions
 *
 * When designing conversational flows or building agent behaviors, use actions
 * as the building blocks for your logic. Actions provide a structured approach
 * to defining what your agent should do at each step of a conversation. By
 * combining multiple actions in sequence or conditionally, you can create
 * sophisticated conversational experiences.
 *
 * Review the examples provided with each action to understand typical usage
 * patterns and best practices. The examples often demonstrate how actions
 * integrate with abilities to create complete functionality, such as combining
 * a search action with a web search ability to retrieve and present information.
 *
 * **Important:** Actions are designed to work within the platform's
 * conversational framework and may have dependencies on specific abilities or
 * platform features. Always test your action implementations thoroughly to
 * ensure they behave as expected in your specific use case.
 */
