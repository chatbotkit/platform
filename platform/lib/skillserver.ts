import prisma from '@/prisma/client'

import {
  getAbilityFunctionDescription,
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { getHeader } from '@/lib/header'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthenticated, notFound } from '@/lib/response'
import { getActiveSkillsetAbilities } from '@/lib/skillset.abilities'

// @note the skillserver runtime surface (manual + invoke) is authenticated with
// a single static access token, mirroring how trigger integrations authenticate
// their public event endpoint (`Authorization: Bearer <secret>`). There is no
// OAuth - that deliberate simplicity is what distinguishes a skillserver from an
// mcpserver. The same token gates the "public information" manual endpoint too,
// so a skillserver is never anonymous.

export const SKILLSERVER_URL_PARAM = 'skillserverIntegrationId'

/**
 * Load a skillserver integration together with everything needed to render its
 * manual and execute its abilities.
 */
export function loadSkillserverIntegration(id: string) {
  return prisma.skillserverIntegration.findUnique({
    where: { id },
    include: {
      user: true,
      skillset: { include: { abilities: true } },
    },
  })
}

export type SkillserverIntegrationWithSkillset = NonNullable<
  Awaited<ReturnType<typeof loadSkillserverIntegration>>
>

// @note the method wrappers hand these endpoints a web Request; getHeader and
// requiredUrlParam both accept it at runtime but expose narrower,
// differently-named request types, so we keep the parameter permissive here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBearerToken(req: any): string | null {
  const authHeader = getHeader(req, 'authorization')

  if (!authHeader) {
    return null
  }

  return authHeader.replace(/^Bearer /i, '').trim() || null
}

export type SkillserverAuthorization =
  | { ok: true; integration: SkillserverIntegrationWithSkillset }
  | { ok: false; response: Response }

/**
 * Resolve and authenticate a skillserver runtime request from its URL id and
 * static bearer token. Returns the loaded integration on success, or the HTTP
 * error response to return on failure.
 */
export async function authorizeSkillserverRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any
): Promise<SkillserverAuthorization> {
  const integration = await loadSkillserverIntegration(
    requiredUrlParam(req, SKILLSERVER_URL_PARAM)
  )

  if (!integration) {
    return { ok: false, response: notFound() }
  }

  const token = getBearerToken(req)

  if (!token || token !== integration.accessToken) {
    return { ok: false, response: notAuthenticated() }
  }

  return { ok: true, integration }
}

/**
 * Find the ability whose generated function name matches the supplied call name.
 * The manual advertises abilities by their function name (the same name the MCP
 * server exposes), so callers address them the same way over both transports.
 */
export function findSkillserverAbility(
  integration: SkillserverIntegrationWithSkillset,
  name: string
) {
  return (
    getActiveSkillsetAbilities(integration.skillset).find(
      (ability) => getAbilityFunctionName(ability) === name
    ) || null
  )
}

function renderInputFieldLines(parameters: unknown): string[] {
  // @note getAbilityFunctionParameters returns a flat schema - fields live at
  // the top level (no `input` wrapper)
  const schema = parameters as {
    properties?: Record<string, { type?: string; description?: string }>
    required?: string[]
  }

  const properties = schema?.properties || {}
  const required = schema?.required || []

  const lines = Object.entries(properties).map(([key, value]) => {
    const type = value?.type || 'string'
    const isRequired = required.includes(key) ? ' (required)' : ''
    const description = value?.description ? ` - ${value.description}` : ''

    return `    - ${key} (${type})${isRequired}${description}`
  })

  return lines.length ? lines : ['    (no input fields)']
}

/**
 * Render a self-describing, text-first manual for the skillserver: how to
 * authenticate, how to invoke, and one section per ability with its input
 * fields. Generated from the same ability metadata the MCP tool schema uses, so
 * it cannot drift from what is actually callable.
 */
export function renderSkillserverManual(
  integration: SkillserverIntegrationWithSkillset,
  { baseUrl }: { baseUrl: string }
): string {
  const abilities = getActiveSkillsetAbilities(integration.skillset)
  const title = integration.name || integration.skillset?.name || 'Skill Server'

  const lines: string[] = [`# ${title}`]

  if (integration.description) {
    lines.push('', integration.description)
  }

  lines.push(
    '',
    'This is a ChatBotKit skill server: a text-first HTTP API that exposes a',
    "skillset's abilities for direct invocation by an agent. Authenticate every",
    'request (including this manual) with the static access token as a bearer',
    'token:',
    '',
    '    Authorization: Bearer <accessToken>',
    '',
    'This manual is served by a GET to this same URL.',
    '',
    '## Invoking an ability',
    '',
    'Call an ability by POSTing its name and input to this same URL.',
    'Responses are plain text by default; for JSON, append ?format=json or',
    'send an Accept: application/json header.',
    '',
    `    POST ${baseUrl}`,
    '    Content-Type: application/json',
    '    Authorization: Bearer <accessToken>',
    '',
    '    { "ability": "<name>", "input": { ... } }',
    '',
    'The input is flexible: pass a structured object matching the fields listed',
    'for an ability, or - for a freeform ability - a plain string. The server',
    'normalizes and coerces loosely-typed input, so you do not have to match the',
    'schema exactly.',
    '',
    `## Abilities (${abilities.length})`,
    ''
  )

  if (!abilities.length) {
    lines.push('No abilities are available in the linked skillset.')

    return lines.join('\n')
  }

  for (const ability of abilities) {
    lines.push(
      `### ${getAbilityFunctionName(ability)}`,
      '',
      getAbilityFunctionDescription(ability),
      '',
      '  input:',
      ...renderInputFieldLines(getAbilityFunctionParameters(ability)),
      ''
    )
  }

  return lines.join('\n')
}
