import { SecretKind, SecretType } from '@/prisma/enums'

type SecretLike = {
  kind?: string | null
  type?: string | null
  config?: Record<string, unknown> | null
}

/**
 * Whether the owner authenticates this secret through a link, rather than
 * typing a value into it.
 *
 * A platform secret is stored as a `template` referencing the catalogue entry -
 * the real oauth config never leaves the server - so keying off `oauth` alone
 * misses every Google, Slack and Linear connection. Mirrors the Authenticate
 * button on the secret page.
 *
 * A personal secret is never the owner's to authenticate: each contact connects
 * their own when they first use it.
 */
export function canAuthenticateSecret(secret: SecretLike | null | undefined) {
  if (!secret || secret.kind === SecretKind.personal) {
    return false
  }

  const config = secret.config || {}

  switch (secret.type) {
    case SecretType.template: {
      return Boolean(config.template)
    }

    case SecretType.oauth: {
      return Boolean(
        (config.clientId &&
          config.clientSecret &&
          config.authorizationUrl &&
          config.tokenUrl) ||
          // @note the discovery flow needs only a resource url
          config.resourceUrl
      )
    }

    default: {
      return false
    }
  }
}

/**
 * Explains, in one sentence for the UI, why the owner cannot authenticate this
 * secret - or `null` when they can. `canAuthenticateSecret` stays the single
 * decision; this only captions the cases it rejects.
 */
export function getSecretAuthenticationBlockReason(
  secret: SecretLike | null | undefined
): string | null {
  if (canAuthenticateSecret(secret)) {
    return null
  }

  if (!secret) {
    return 'Save this secret before you can authenticate it.'
  }

  if (secret.kind === SecretKind.personal) {
    return 'Personal secrets are authenticated by each contact when they first use them. Switch the kind to Shared to authenticate it yourself.'
  }

  switch (secret.type) {
    // @note reached only when the flow config is incomplete - the decision
    // above already let the configured ones through
    case SecretType.template:
    case SecretType.oauth: {
      return 'Finish configuring this secret before you can authenticate it.'
    }

    default: {
      return 'This secret type stores a value you type in, so there is nothing to authenticate.'
    }
  }
}
