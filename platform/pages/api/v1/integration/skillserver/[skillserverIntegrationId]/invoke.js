// @ts-check
import { getAbilityFunctionInput } from '@/lib/ability.function'
import { setContextNamespace, setContextUser } from '@/lib/context.store'
import { captureException } from '@/lib/error'
import { getHeader } from '@/lib/header'
import { getExternalAPIHostURL } from '@/lib/host'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { queryParam } from '@/lib/query.get'
import {
  badRequest,
  methodNotAllowed,
  notFound,
  ok,
  send,
} from '@/lib/response'
import {
  authorizeSkillserverRequest,
  findSkillserverAbility,
  renderSkillserverManual,
} from '@/lib/skillserver'
import { applySkillset } from '@/lib/skillset.apply'
import { Usage } from '@/lib/usage.model'

const TEXT_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' }

/**
 * @param {any} req
 * @returns {boolean}
 */
function wantsJson(req) {
  if (queryParam(req, 'format') === 'json') {
    return true
  }

  return (getHeader(req, 'accept') || '').includes('application/json')
}

/**
 * @param {unknown} result
 * @returns {string}
 */
function renderResultText(result) {
  if (result === undefined || result === null) {
    return ''
  }

  if (typeof result === 'string') {
    return result
  }

  return JSON.stringify(result, null, 2)
}

/**
 * GET returns the skill server manual; POST invokes an ability. Both endpoints
 * share the integration root so the runtime surface is a single URL - which
 * keeps it trivial to remap onto a per-skillserver subdomain later.
 *
 * @param {any} integration
 * @param {any} req
 */
async function handleManual(integration, req) {
  const baseUrl = getExternalAPIHostURL(
    `/v1/integration/skillserver/${integration.id}/invoke`
  )

  const manual = renderSkillserverManual(integration, { baseUrl })

  return send(manual, { 'Content-Type': 'text/markdown; charset=utf-8' })
}

/**
 * @param {any} integration
 * @param {any} req
 */
async function handleInvoke(integration, req) {
  if (!integration.skillset) {
    return notFound('The linked skillset no longer exists')
  }

  let body

  try {
    body = await req.json()
  } catch {
    return badRequest('Request body must be valid JSON')
  }

  const abilityName = body?.ability

  if (typeof abilityName !== 'string' || !abilityName) {
    return badRequest('Missing required field: ability')
  }

  const ability = findSkillserverAbility(integration, abilityName)

  if (!ability) {
    return notFound(`Ability not found: ${abilityName}`)
  }

  // @note ability execution may need owner-scoped resources such as linked
  // secrets, so we establish the integration owner as the context user. The
  // namespace groups any tool state; an optional ?session= lets a caller thread
  // continuity across calls, defaulting to the integration id.

  setContextUser(integration.user)

  setContextNamespace(
    getSafeNamespace(
      { id: integration.userId },
      queryParam(req, 'session') || integration.id
    )
  )

  const input = getAbilityFunctionInput(ability, body.input)

  try {
    const { usage, error, result } = await applySkillset(
      integration.userId,
      integration.skillset,
      ability.name,
      input
    )

    await logEvent({
      user: { id: integration.userId },
      name: 'SkillServer Ability Invoke',
      description: `Invoked skill server ability ${abilityName}`,
      type: 'action.skillserver.ability.invoke',
      relations: {
        skillserverIntegrationId: integration.id,
        skillsetId: integration.skillset.id,
        abilityId: ability.id,
      },
      meta: {
        abilityName,
        arguments: input,
      },
    })

    if (usage) {
      await Usage.createAndRecord({
        user: { id: integration.userId },
        token: usage.token,
        model: usage.model,
        meta: {
          reason: 'ability/execute',
        },
        references: {
          skillsetId: integration.skillset.id,
        },
      })
    }

    if (wantsJson(req)) {
      return ok({ result, error: error || null })
    }

    if (error) {
      return send(
        `Error: ${typeof error === 'string' ? error : JSON.stringify(error)}`,
        TEXT_HEADERS
      )
    }

    return send(renderResultText(result), TEXT_HEADERS)
  } catch (e) {
    await captureException(e)

    const message = e instanceof Error ? e.message : 'Unknown error'

    // @todo decide whether execution errors should carry a non-200 status in
    // text mode; mirrors the MCP handler which returns isError with a 200 body

    return send(`Error: ${message}`, TEXT_HEADERS)
  }
}

/**
 * @swagger
 *
 * /integration/skillserver/{skillserverIntegrationId}/invoke:
 *   get:
 *     operationId: fetchSkillServerManual
 *     summary: Fetch the SkillServer manual
 *     description: >-
 *       Returns a text-first manual describing the abilities exposed by this
 *       skill server and how to invoke them. Authenticated with the static
 *       access token as a bearer token.
 *     tags:
 *       - SkillServer Integration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: skillserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the SkillServer integration
 *           type: string
 *     responses:
 *       200:
 *         description: The skill server manual
 *         content:
 *           text/markdown:
 *             schema:
 *               type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     operationId: invokeSkillServerAbility
 *     summary: Invoke a SkillServer ability
 *     description: >-
 *       Directly invoke a single ability from the linked skillset by name.
 *       Authenticated with the static access token as a bearer token. Responses
 *       are plain text by default; append ?format=json (or send an
 *       Accept: application/json header) for a JSON response.
 *     tags:
 *       - SkillServer Integration
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: skillserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the SkillServer integration
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           description: Set to "json" to receive a JSON response
 *           type: string
 *           enum:
 *             - json
 *       - in: query
 *         name: session
 *         schema:
 *           description: Optional session id to group tool state across calls
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ability:
 *                 description: The name of the ability to invoke (as listed in the manual)
 *                 type: string
 *               input:
 *                 description: The ability input
 *                 type: object
 *             required:
 *               - ability
 *     responses:
 *       200:
 *         description: The ability was invoked
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result: {}
 *                 error:
 *                   type: string
 *                   nullable: true
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withAny(async function (req) {
  const auth = await authorizeSkillserverRequest(req)

  if (!auth.ok) {
    return auth.response
  }

  const { integration } = auth

  if (req.method === 'GET') {
    return handleManual(integration, req)
  }

  if (req.method === 'POST') {
    return handleInvoke(integration, req)
  }

  return methodNotAllowed()
})

/**
 * @manual SkillServer Integration
 * @index 30
 *
 * ## The Skill Server Runtime Endpoint
 *
 * A skill server exposes a single runtime URL, dispatched by HTTP method:
 *
 * - `GET` returns the **manual** - a text description of the available
 *   abilities and how to call them, generated from the linked skillset so it
 *   always reflects what is callable.
 * - `POST` **invokes** an ability by name with its input.
 *
 * Both share one URL so the runtime surface is a single endpoint, which also
 * makes it easy to remap onto a per-skill-server subdomain later.
 *
 * ```http
 * GET /api/v1/integration/skillserver/{skillserverIntegrationId}/invoke
 * Authorization: Bearer <accessToken>
 * ```
 *
 * ```http
 * POST /api/v1/integration/skillserver/{skillserverIntegrationId}/invoke
 * Content-Type: application/json
 * Authorization: Bearer <accessToken>
 *
 * {
 *   "ability": "search_knowledge_base",
 *   "input": { "query": "refund policy" }
 * }
 * ```
 *
 * Although the manual is "public information" describing the server, it is still
 * gated by the static access token - a skill server is never anonymous.
 *
 * Invocation responses are plain text by default - the ability result rendered
 * for an agent to read. Append `?format=json` (or send `Accept:
 * application/json`) for a structured `{ "result": ..., "error": ... }`
 * response. Pass an optional `?session=<id>` to group tool state across calls.
 *
 * ### Security
 *
 * The static access token unlocks every ability in the linked skillset,
 * including any that touch secrets, bots, spaces, or files. Distribute it only
 * to trusted consumers and scope the linked skillset to exactly the abilities
 * you intend to expose.
 */
