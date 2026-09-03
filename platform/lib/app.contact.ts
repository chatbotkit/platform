import type { Session } from 'next-auth'

import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import { withCache } from '@/lib/app.cache'
import { getSessionClient } from '@/lib/cbk.sdk'
import { createContactFingerprint } from '@/lib/contact.create'
import { isValidEmail } from '@/lib/email.validation'
import { throwNotFound } from '@/lib/response'

import type { ContactEnsureResponse } from '@chatbotkit/sdk/contact/v1'

export async function buildContact({
  namespace,
  session,
  app,
}: {
  namespace: string
  session: Session
  app?: string
}): Promise<{
  fingerprint: string
  name?: string
  email?: string
  meta: {
    app?: string
  }
}> {
  // portal user

  if (session.options.portalUserId && session.options.portalId) {
    return {
      fingerprint: createContactFingerprint(namespace, [
        // @todo consider if we should use a shared ID for portal sessions such
        // that two portals can share the same contact for a user

        // @note do not change the order of these values, or introduce new ones,
        // because this will result in a different fingerprint and create a new
        // contact

        session.options.portalId,
        session.options.portalUserId,
      ]),

      name: session.options.portalUserId,

      email: isValidEmail(session.options.portalUserId)
        ? session.options.portalUserId
        : undefined,

      meta: {
        app,
      },
    }
  }

  // current user

  if (session.options.currentUserId) {
    // @note the reason why we need to special case current user is because when
    // we do assumption, we want to a unique contact for the current user - not
    // the assumed users which is shared across all users that can assume the
    // account

    return {
      fingerprint: createContactFingerprint(namespace, [
        session.options.currentUserId,
      ]),

      name: session.user.name,

      email: session.user.email,

      meta: {
        app,
      },
    }
  }

  // default state

  {
    return {
      fingerprint: createContactFingerprint(namespace, [session.user.id]),

      name: session.user.name,
      email: session.user.email,

      meta: {
        app,
      },
    }
  }
}

export async function ensureContact({
  namespace,
  session,
  app,
}: {
  namespace: string
  session: Session
  app: string
}): Promise<ContactEnsureResponse> {
  return await withCache(
    async () => {
      const userClient = await getSessionClient(session)

      const contactDetails = await buildContact({
        namespace: namespace,
        session: session,
        app: 'app', // contact meta is app is set to app - confusing I guess
      })

      if (!contactDetails) {
        return throwNotFound('Contact not found')
      }

      const contact = await userClient.contact.ensure({
        ...contactDetails,

        verifiedAt: Date.now(),
      })

      return contact
    },
    {
      app: app,
      category: 'contact',
      session: session,
      timeInSeconds: ONE_DAY_IN_SECONDS,
    }
  )
}
