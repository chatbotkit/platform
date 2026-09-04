import prisma from '@/prisma/client'
import type { User } from '@/prisma/types'

import debug from '@/lib/debug'
import { cleanupEmptyHeaders, toHeadersHashMap } from '@/lib/header'
import { hasSecrets, swapSecrets } from '@/lib/secret.value'
import type { McpHeaderSource } from '@/lib/tool.environment'

/**
 * Adds the default-secret Authorization header when a secret is linked but the
 * configured headers neither reference a secret nor set their own
 * Authorization, so linking a secret alone is enough to authenticate.
 */
export function withDefaultSecretHeader(
  headers: Record<string, string>,
  secretId: string | null | undefined
): Record<string, string> {
  if (
    secretId &&
    !hasSecrets(headers) &&
    !headers['authorization'] &&
    !headers['Authorization']
  ) {
    return { ...headers, Authorization: '${SECRET_DEFAULT}' }
  }

  return headers
}

/**
 * Swaps the secret placeholders in a header template against the given
 * context. Returns undefined when there is nothing to send.
 */
export async function swapMcpHeaders(
  user: Pick<User, 'id'>,
  { headerTemplate, abilityId, secretId, inlineSecrets }: McpHeaderSource
): Promise<Record<string, string> | undefined> {
  const headers = withDefaultSecretHeader(headerTemplate, secretId)

  if (Object.keys(headers).length === 0) {
    return undefined
  }

  return toHeadersHashMap(
    cleanupEmptyHeaders(
      await swapSecrets(headers, {
        userId: user.id,

        abilityId,
        secretId,

        inlineSecrets,

        // @note remove secret placeholders we could not replace

        discardSecretPlaceholders: true,
      })
    )
  )
}

/**
 * Builds the headers for an MCP call from the source stored on the tool. The
 * linked secret is re-read from the installing ability when there is one, so
 * the call reflects the ability as it is now rather than as it was installed.
 */
export async function resolveMcpHeaders(
  user: Pick<User, 'id'>,
  source: McpHeaderSource
): Promise<Record<string, string> | undefined> {
  let secretId = source.secretId

  if (source.abilityId) {
    const ability = await prisma.ability.findUnique({
      where: {
        id: source.abilityId,
      },

      select: {
        linkedSecretId: true,
      },
    })

    if (ability) {
      secretId = ability.linkedSecretId ?? undefined
    }
  }

  debug('resolving mcp headers', { abilityId: source.abilityId, secretId }).log(
    'mcp.headers.resolveMcpHeaders'
  )

  return swapMcpHeaders(user, { ...source, secretId })
}
