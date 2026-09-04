import { useEffect } from 'react'

import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'

import { setupRequestContext } from '@/lib/context.setup'
import { executeInContext } from '@/lib/context.store'
import { tryVerify } from '@/lib/jwt'
import type { ContactState, EphemeralState } from '@/lib/secret.manager'
import {
  ContactSecretManager,
  DirectSecretManager,
  EphemeralSecretManager,
} from '@/lib/secret.manager'
import { makeJsonSafe } from '@/lib/struct'

import Errata, { fail } from '@/layouts/Errata'

export default function Page({ error, error_description, secretId }) {
  useEffect(() => {
    // @note it is normal for this to be called twice in non-production
    // environments so you will see the same message twice

    // @note the target stays '*' because portal custom domains open the popup
    // on the customer host while the OAuth redirect lands on the portal apex;
    // the payload carries no credentials and receivers verify event.source
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

    const incomingState = (await tryVerify(incomingStateToken)) as (
      | EphemeralState
      | ContactState
    ) & { secret: { value: string } }

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

    switch (true) {
      case 'direct' in incomingState: {
        const sm = new DirectSecretManager({
          required: true,
        })

        await sm.setValue(secret, incomingState.secret.value)

        return {
          props: makeJsonSafe({
            secretId: secret.id,
          }),
        }
      }

      case 'ephemeral' in incomingState: {
        const sm = new EphemeralSecretManager({
          required: true,
          namespace: incomingState.ephemeral.namespace,
        })

        await sm.setValue(secret, incomingState.secret.value)

        return {
          props: makeJsonSafe({
            secretId: secret.id,
          }),
        }
      }

      case 'contact' in incomingState: {
        const contact = await prisma.contact.findUnique({
          where: {
            id: incomingState.contact.id,
          },
        })

        if (!contact) {
          return fail('contact_not_found', 'Contact not found')
        }

        const sm = new ContactSecretManager({
          required: true,
          contact: contact,
        })

        await sm.setValue(secret, incomingState.secret.value)

        return {
          props: makeJsonSafe({
            secretId: secret.id,
          }),
        }
      }

      default: {
        try {
          assertUnreachable(incomingState)
        } catch {
          return fail('invalid_state', 'Invalid state')
        }
      }
    }
  })
}
