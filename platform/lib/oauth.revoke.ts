import type { Secret } from '@/prisma/types'

import { captureException } from '@/lib/error'
import fetch from '@/lib/egress.fetch'
import { getFetchError } from '@/lib/fetch'
import { getExternalAPIHostURL } from '@/lib/host'
import { getSecretOAuthConfig } from '@/lib/secret.oauth'

/**
 * Revoke an OAuth token server-side by calling the provider's revoke endpoint.
 */
export async function revokeOAuthToken(
  secret: Secret,
  token: string
): Promise<void> {
  try {
    const config = await getSecretOAuthConfig(secret)

    if (!config.revokeUrl) {
      return
    }

    const formData = new URLSearchParams()

    formData.append('token', token)

    if (config.clientId) {
      formData.append('client_id', config.clientId)
    }

    if (config.clientSecret) {
      formData.append('client_secret', config.clientSecret)
    }

    const url = new URL(config.revokeUrl, getExternalAPIHostURL())

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw await getFetchError(response)
    }
  } catch (e) {
    await captureException(e)
  }
}
