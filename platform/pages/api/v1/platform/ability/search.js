// @ts-check
import abilitiesData from '@/data/abilities/visible'

import { getExternalHostURL } from '@/lib/host'
import { convertToCallableTemplateInstruction } from '@/lib/instruction.convert'
import { extractInstructionFields } from '@/lib/instruction.field'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { toKebabCase } from '@/lib/string'
import { matchSearchText } from '@/lib/text.search'

export const bodySchema = schema.object({
  search: schema.string(),
  take: schema.number().integer().min(1).max(100).default(10),
})

/**
 * @swagger
 *
 * /platform/ability/search:
 *   post:
 *     operationId: searchPlatformAbilities
 *     summary: Search platform abilities
 *     tags:
 *       - Platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 description: The search query to find relevant abilities
 *                 type: string
 *               take:
 *                 description: The maximum number of results to return (1-100, default 10)
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
 *             required:
 *               - search
 *     responses:
 *       200:
 *         description: The search was successful
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
 *                           template:
 *                             type: string
 *                             description: The original template identifier for the ability
 *                           instruction:
 *                             type: string
 *                           schema:
 *                             allOf:
 *                               - $ref: '#/components/schemas/JsonSchemaObject'
 *                           bot:
 *                             type: string
 *                           file:
 *                             type: string
 *                           secret:
 *                             type: string
 *                           space:
 *                             type: string
 *                           provider:
 *                             type: string
 *                           icon:
 *                             type: string
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                           setup:
 *                             type: string
 *                           commentary:
 *                             type: string
 *                           score:
 *                             description: The text relevance score of the search result
 *                             type: number
 *                           excerpt:
 *                             description: An excerpt from the most relevant part of the ability
 *                             type: string
 *                           link:
 *                             description: The URL to the official ability page
 *                             type: string
 *                         required:
 *                           - name
 *                           - description
 *                           - instruction
 *                           - schema
 *                           - icon
 *                           - score
 *                           - excerpt
 *               required:
 *                 - items
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, _session, body) {
      const { search, take = 10 } = body

      if (!search || search.trim().length === 0) {
        return ok({ items: [] })
      }

      const results = []

      for (const [template, ability] of Object.entries(abilitiesData)) {
        const match = matchSearchText(search, [
          { value: ability.name, weight: 12, excerpt: true },
          { value: ability.tags, weight: 8 },
          { value: ability.description, weight: 6, excerpt: true },
          { value: ability.provider, weight: 4 },
          { value: ability.setup, weight: 3, excerpt: true },
          { value: ability.commentary, weight: 2, excerpt: true },
          { value: ability.instruction, weight: 1, excerpt: true },
        ])

        if (!match) {
          continue
        }

        results.push({
          template,
          score: match.score,
          snippet: match.excerpt || ability.description || '',
        })
      }

      results.sort((a, b) => b.score - a.score)

      const items = results
        .slice(0, take)
        .map((result) => {
          const ability = abilitiesData[result.template]

          if (!ability) {
            return null
          }

          // @note extract all instruction fields and filter to only placeholders (round bracket fields)
          const allFields = extractInstructionFields(ability.instruction)
          const fields = allFields.filter((field) => field.placeholder)

          const abilitySchema = {
            type: 'object',
            properties: Object.fromEntries(
              fields.map((field) => {
                return [
                  field.name,
                  {
                    ...(field.description != null
                      ? { description: field.description }
                      : {}),
                    ...(field.type != null ? { type: field.type } : {}),
                    ...(field.enum != null ? { enum: field.enum } : {}),
                    ...(field.default != null
                      ? { default: field.default }
                      : {}),
                  },
                ]
              })
            ),
            required: Array.from(
              new Set(
                fields
                  .filter((field) => field.required)
                  .map((field) => field.name)
              )
            ),
          }

          // @note example templates return raw instruction, non-examples return callable template instruction
          const isExample =
            result.template.startsWith('example') ||
            ability.tags?.includes('example')

          const processedInstruction = isExample
            ? ability.instruction
            : convertToCallableTemplateInstruction({
                template: result.template,
                instruction: ability.instruction,
              })

          return {
            id: toKebabCase(result.template),

            template: result.template,

            name: ability.name,
            description: ability.description,

            instruction: processedInstruction,
            schema: abilitySchema,

            bot: ability.bot,
            file: ability.file,
            secret: ability.secret,
            space: ability.space,

            provider: ability.provider,
            icon: ability.icon,
            tags: ability.tags,
            setup: ability.setup,
            commentary: ability.commentary,

            score: result.score,
            excerpt: result.snippet || '',
            link: getExternalHostURL(`/abilities/${result.template}`),

            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        })
        .filter((item) => item !== null)

      return ok({ items })
    })
  )
)

/**
 * @manual Platform Abilities
 * @index 11
 *
 * ## Searching Abilities
 *
 * Text search helps you find the most relevant platform abilities quickly.
 * The endpoint compares your query against the local ability catalogue and
 * returns ranked results sorted by relevance.
 * This is the recommended way to discover abilities before installing them on
 * a skillset, especially when building dynamic or AI-driven configurations.
 *
 * ```http
 * POST /api/v1/platform/ability/search
 * Content-Type: application/json
 *
 * {
 *   "search": "calendar scheduling and event management",
 *   "take": 10
 * }
 * ```
 *
 * The `search` field accepts natural language queries. Describe what you want
 * the ability to accomplish - for example "send an email with attachment",
 * "search and retrieve web pages", or "create a Jira issue". The optional
 * `take` parameter controls the number of returned results (between 1 and 100,
 * default 10).
 *
 * ## Ability Search Response Fields
 *
 * Each item in the `items` array contains the following fields:
 *
 * - **id**: Kebab-case slug derived from the template key (e.g.
 *   `google-calendar-event-list`). Use this as a stable reference.
 * - **template**: The original catalogue key (e.g.
 *   `google/calendar/event/list`). Use this when installing the ability on a
 *   skillset.
 * - **name**: Human-readable name of the ability.
 * - **description**: Short explanation of what the ability does.
 * - **instruction**: The processed instruction text the AI model uses when
 *   invoking this ability. For non-example abilities, this is a callable
 *   template instruction with parameter placeholders.
 * - **schema**: JSON Schema object describing the parameters the ability
 *   accepts. Use this to understand required and optional inputs.
 * - **bot**: Optional bot configuration reference attached to this ability.
 * - **file**: Optional file resource linked to this ability.
 * - **secret**: The secret identifier required to authenticate this ability
 *   (e.g. `@google/calendar`). Use this to pre-configure secrets before
 *   installing.
 * - **space**: Optional space resource reference for this ability.
 * - **provider**: The service provider name (e.g. `google`, `slack`).
 * - **icon**: URL or icon reference for displaying in UI.
 * - **tags**: Array of string tags for categorisation (e.g. `["calendar",
 *   "productivity"]`).
 * - **setup**: User-facing instructions for obtaining required credentials.
 * - **commentary**: Internal notes about quirks or caveats of this ability.
 * - **score**: Weighted text relevance score between 0 and 1. Higher values
 *   indicate a closer match to your query.
 * - **excerpt**: Text snippet from the best matching catalogue field - useful
 *   for quickly previewing relevance.
 * - **link**: URL to the full ability page on the ChatBotKit website.
 *
 * ```javascript
 * {
 *   "items": [
 *     {
 *       "id": "google-calendar-event-list",
 *       "template": "google/calendar/event/list",
 *       "name": "List Calendar Events",
 *       "description": "Retrieve upcoming events from a Google Calendar",
 *       "secret": "@google/calendar",
 *       "provider": "google",
 *       "tags": ["calendar", "productivity", "google"],
 *       "score": 0.93,
 *       "excerpt": "Lists upcoming calendar events filtered by date range...",
 *       "link": "https://chatbotkit.com/abilities/google-calendar-event-list"
 *     }
 *   ]
 * }
 * ```
 */
