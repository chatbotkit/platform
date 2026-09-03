import { useEffect } from 'react'

import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { setupRequestContext } from '@/lib/context.setup'
import { executeInContext } from '@/lib/context.store'
import debug from '@/lib/debug'
import { getExternalFrontendHostURL } from '@/lib/host'
import { trySign, tryVerify } from '@/lib/jwt'
import { getAuthorizationCodeGrantCredentials } from '@/lib/oauth.authorization'
import { retrievePkceVerifier } from '@/lib/oauth.pkce'
import {
  getNewSecretOAuthValue,
  getSecretOAuthConfig,
} from '@/lib/secret.oauth'
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

Page.getLayout = function (children, { secretId: _secretId, ...props }) {
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

    if (!incomingState.callbackUrl) {
      return fail('state_callback_url_not_found', 'State callbackUrl not found')
    }

    const error = context.query.error

    if (error) {
      return {
        props: makeJsonSafe({
          error,
          error_description: context.query.error_description,
        }),
      }
    }

    const code = context.query.code

    if (!code) {
      return fail('code_not_found', 'Code not found')
    }

    const secret = await prisma.secret.findUnique({
      where: {
        id: incomingState.secretId,
      },
    })

    if (!secret) {
      return fail('secret_not_found', 'Secret not found')
    }

    // @note getSecretOAuthConfig handles discovery automatically when
    // resourceUrl is present - tokenUrl will be populated from discovery if not
    // explicit

    const config = await getSecretOAuthConfig(secret)

    const { clientId, clientSecret, tokenUrl } = config

    if (!clientId || !tokenUrl) {
      return fail('invalid_config', 'Invalid config')
    }

    // Retrieve PKCE verifier from Redis if a pkceId was provided in state

    let codeVerifier: string | undefined

    if (incomingState.pkceId) {
      const verifier = await retrievePkceVerifier(incomingState.pkceId)

      if (!verifier) {
        return fail(
          'pkce_verifier_not_found',
          'PKCE verifier expired or invalid'
        )
      }

      codeVerifier = verifier
    }

    // For PKCE flow, clientSecret is optional (public clients), for non-PKCE
    // flow, clientSecret is required

    if (!codeVerifier && !clientSecret) {
      return fail('invalid_config', 'Invalid config: missing client secret')
    }

    let credentials: {
      accessToken: string
      accessTokenExpiresAt?: Date
      refreshToken?: string
      refreshTokenExpiresAt?: Date
      additionalProperties?: {
        [key: string]: unknown
      }
    }

    try {
      credentials = await getAuthorizationCodeGrantCredentials(code, {
        clientId,
        clientSecret,
        tokenUrl,
        codeVerifier,
      })
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        debug(`error getting authentication credentials`, { error: e }).log() // @note always log
      }

      return fail('credentials_failed', 'Credentials failed')
    }

    const state = {
      ...incomingState,

      secret: {
        ...incomingState.secret,

        value: await getNewSecretOAuthValue(secret, credentials),
      },
    }

    const stateToken = await trySign(state, QUARTER_HOUR_IN_SECONDS)

    if (!stateToken) {
      return fail('state_token_failed', 'State token failed')
    }

    const url = new URL(incomingState.callbackUrl, getExternalFrontendHostURL())

    url.searchParams.set('state', stateToken)

    return {
      redirect: {
        destination: url.href,
        permanent: false,
      },
    }
  })
}
