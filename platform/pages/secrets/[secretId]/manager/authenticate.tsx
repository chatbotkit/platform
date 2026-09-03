import { useEffect } from 'react'

import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import type { Secret } from '@/prisma/types'
import { SecretKind, SecretType } from '@/prisma/types'

import { setupRequestContext } from '@/lib/context.setup'
import { executeInContext } from '@/lib/context.store'
import { tryVerify } from '@/lib/jwt'
import {
  getAuthorizationURL,
  getClientCredentialsGrantCredentials,
} from '@/lib/oauth.authorization'
import { generatePkcePair, storePkceVerifier } from '@/lib/oauth.pkce'
import {
  getNewSecretOAuthValue,
  getSecretOAuthConfig,
  performClientRegistration,
} from '@/lib/secret.oauth'
import { revealSecretInstanceFromReferenceSecret } from '@/lib/secret.reference'
import { revealSecretInstanceFromTemplateSecret } from '@/lib/secret.template'
import { makeJsonSafe } from '@/lib/struct'

import Errata, { fail } from '@/layouts/Errata'

export default function Page({ error, error_description, secretId }) {
  useEffect(() => {
    // @note it is normal for this to be called twice in non-production
    // environments so you will see the same message twice

    window.opener?.postMessage(
      { type: 'oauth', params: { error, error_description, secretId } },
      '*'
    )

    if (!error) {
      window.close()
    }
  }, [error, error_description, secretId])

  return (
    !error && (
      <div>
        <h1>Success</h1>
        <p>You have been securely authenticated.</p>
      </div>
    )
  )
}

Page.getLayout = function (children, props) {
  return <Errata {...props}>{children}</Errata>
}

/**
 * @todo move the implementation into the API using simple HTML pages
 */
export async function getServerSideProps(context) {
  return executeInContext(async () => {
    // @note we need to set some headers in order to get the correct context for
    // the secret manager, so we can use the correct frontend host and other
    // context information

    setupRequestContext(context.req)

    const incomingStateToken = context.query.state

    if (!incomingStateToken) {
      return fail('state_token_not_found', 'State token not found')
    }

    const incomingState = await tryVerify(incomingStateToken)

    if (!incomingState) {
      return fail('state_token_invalid', 'State token invalid')
    }

    if (!incomingState.secretId) {
      return fail('state_secret_id_not_found', 'State secretId not found')
    }

    if (incomingState.secretId !== context.params.secretId) {
      return fail('state_secret_mismatch', 'State secret mismatch')
    }

    const secret = await prisma.secret.findUnique({
      where: {
        id: incomingState.secretId,
      },
    })

    if (!secret) {
      return fail('not_found', 'Secret not found')
    }

    if (secret.userId !== incomingState.userId) {
      return fail('state_user_mismatch', 'State user mismatch')
    }

    async function getProps(secret: Secret) {
      switch (secret.type) {
        case SecretType.plain: {
          return fail('unsupported', 'Unsupported secret type')
        }

        case SecretType.basic: {
          return fail('unsupported', 'Unsupported secret type')
        }

        case SecretType.bearer: {
          return fail('unsupported', 'Unsupported secret type')
        }

        case SecretType.jwt: {
          return fail('unsupported', 'Unsupported secret type')
        }

        case SecretType.oauth: {
          // Get OAuth config - this may perform discovery if resourceUrl is set

          let config = await getSecretOAuthConfig(secret)

          // If self-registration is needed (resourceUrl without clientId),
          // perform it now and update the config

          if (config.resourceUrl && !config.clientId) {
            try {
              config = await performClientRegistration(secret, config)
            } catch {
              return fail('registration_failed', 'Client registration failed')
            }
          }

          const {
            clientId,
            clientSecret,
            authorizationUrl,
            tokenUrl,
            scope,
            grantType,
            requiresPkce,
            codeChallengeMethodsSupported,
          } = config

          // For public clients (no clientSecret), clientId and endpoints are
          // required, for confidential clients, clientSecret is also required

          if (!clientId || !authorizationUrl || !tokenUrl) {
            return fail('invalid_config', 'Invalid config')
          }

          // Determine if PKCE should be used:
          // - Required if no clientSecret (public client)
          // - Required if server indicates PKCE support
          // - Required if config explicitly requires it

          const usePkce =
            !clientSecret ||
            requiresPkce ||
            (codeChallengeMethodsSupported &&
              codeChallengeMethodsSupported.includes('S256'))

          switch (grantType) {
            case 'client_credentials': {
              if (secret.kind !== SecretKind.shared) {
                return fail(
                  'invalid_kind',
                  'Invalid secret kind for grant type'
                )
              }

              try {
                const credentials = await getClientCredentialsGrantCredentials({
                  clientId,
                  clientSecret,
                  tokenUrl,
                })

                await prisma.secret.update({
                  where: {
                    id: secret.id,
                  },
                  data: {
                    value: await getNewSecretOAuthValue(secret, credentials),
                  },
                })
              } catch {
                return fail('token_request_failed', 'Token request failed')
              }

              return {
                props: makeJsonSafe({
                  secretId: secret.id,
                }),
              }
            }

            default: {
              let url: URL

              try {
                // Generate PKCE pair and store verifier server-side if needed

                let pkceParams: {
                  codeChallenge?: string
                  codeChallengeMethod?: 'S256'
                } = {}

                let pkceId: string | undefined

                if (usePkce) {
                  const pkcePair = await generatePkcePair()

                  pkceParams = {
                    codeChallenge: pkcePair.codeChallenge,
                    codeChallengeMethod: pkcePair.codeChallengeMethod,
                  }

                  // Store verifier in Redis and get back an ID

                  pkceId = await storePkceVerifier(pkcePair.codeVerifier)
                }

                url = await getAuthorizationURL(
                  {
                    clientId,
                    authorizationUrl,
                    scope,
                    codeChallenge: pkceParams.codeChallenge,
                    codeChallengeMethod: pkceParams.codeChallengeMethod,
                  },
                  {
                    ...incomingState,

                    id: secret.id,

                    callbackUrl: `/secrets/${secret.id}/manager/oauth/callback`,

                    // Only pass the PKCE ID - verifier is stored server-side

                    pkceId,
                  }
                )
              } catch {
                return fail(
                  'authorization_url_failed',
                  'Authorization URL failed'
                )
              }

              return {
                redirect: {
                  destination: url.href,
                  permanent: false,
                },
              }
            }
          }
        }

        case SecretType.template: {
          const instance = await revealSecretInstanceFromTemplateSecret(secret)

          if (!instance) {
            return fail('template_not_found', 'Secret template not found')
          }

          return await getProps({
            ...secret,

            type: instance.type,
            config: instance.config,
            value: instance.value,
          })
        }

        case SecretType.reference: {
          const instance = await revealSecretInstanceFromReferenceSecret(secret)

          if (!instance) {
            return fail('reference_not_found', 'Secret reference not found')
          }

          return await getProps({
            ...secret,

            type: instance.type,
            config: instance.config,
            value: instance.value,
          })
        }

        default: {
          try {
            assertUnreachable(secret.type)
          } catch {
            return fail('invalid_state', 'Invalid state')
          }
        }
      }
    }

    return await getProps(secret)
  })
}
