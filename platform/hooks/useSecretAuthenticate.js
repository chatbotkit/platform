'use client'

import { useCallback } from 'react'

import { canAuthenticateSecret } from '@/lib/secret.authenticate'

import usePostMessageHandler from '@/hooks/usePostMessageHandler'
import { SECRET_NEEDS_SETUP } from '@/hooks/useSkillsetSecrets'

import toast from 'react-hot-toast'

/**
 * Whether this secret is one the owner can finish right here and now, by
 * following its authentication link.
 *
 * A secret which needs a typed-in value is not, and neither is one which is
 * already authenticated or connected by each contact instead of by the owner.
 */
export function isSecretAuthenticatable(secret) {
  return (
    canAuthenticateSecret(secret) &&
    secret?.status === SECRET_NEEDS_SETUP &&
    !!secret?.actionUrl
  )
}

/**
 * Sends the owner through a secret's authentication flow.
 *
 * The authenticate manager runs in a popup window and reports its result back to
 * its opener, so we listen rather than navigate. Same flow as the connect app.
 *
 * Mount this once per page - each call listens for the result, so a second one
 * would refetch on the back of the same message.
 */
export default function useSecretAuthenticate(onChange) {
  usePostMessageHandler(
    'oauth',
    ({ error_description: error }) => {
      if (error) {
        toast.error(error)

        return
      }

      onChange?.()
    },
    [onChange]
  )

  return useCallback((secret) => {
    if (!secret?.actionUrl) {
      return
    }

    // @note `_blank` rather than a navigation because the manager page needs an
    // opener to post its result back to
    window.open(secret.actionUrl, '_blank')
  }, [])
}
