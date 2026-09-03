import '@/lib/scope.server'

import type { Contact, Secret } from '@/prisma/types'

import debug from '@/lib/debug'
import { getSecretManager } from '@/lib/secret.manager'

/** A secret manager that can produce an authorize URL (all concrete managers can). */
interface Authenticatable {
  getAuthUrl(secret: Secret, options?: { raw?: boolean }): Promise<URL>
}

function canAuthenticate(manager: unknown): manager is Authenticatable {
  return (
    !!manager && typeof (manager as Authenticatable).getAuthUrl === 'function'
  )
}

/** Build a JSON `Response` with the given status. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Resolves the authorize URL a user must visit to authenticate an unauthenticated
 * secret, or null if the secret cannot be authenticated in this context (e.g. a
 * personal secret addressed without a contact).
 */
export async function getSecretAuthorizationUrl(
  secret: Secret,
  options?: { contact?: Contact | null; namespace?: string | null }
): Promise<string | null> {
  try {
    const secretManager = getSecretManager(secret, {
      contact: options?.contact ?? null,
      namespace: options?.namespace ?? null,
    })

    if (!canAuthenticate(secretManager)) {
      return null
    }

    const url = await secretManager.getAuthUrl(secret, { raw: true })

    return url.href
  } catch (error) {
    debug(`could not resolve authorization url`, { error }).log(
      'secret.authorize.getSecretAuthorizationUrl'
    )

    return null
  }
}

/**
 * Builds the `409 authorization_required` response carrying the URL the user
 * must visit (when resolvable). Returned when a secret is not yet authenticated.
 */
export async function authorizationRequiredResponse(
  secret: Secret,
  options: { contact?: Contact | null; namespace?: string | null } | undefined,
  message: string
): Promise<Response> {
  const url = await getSecretAuthorizationUrl(secret, options)

  return jsonResponse(409, {
    error: 'authorization_required',
    message,
    ...(url ? { url } : {}),
  })
}
