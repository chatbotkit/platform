'use client'

import { SecretKind } from '@/prisma/enums'

import { canAuthenticateSecret } from '@/lib/secret.authenticate'

import {
  SECRET_NEEDS_SETUP,
  SECRET_PER_CONTACT,
} from '@/hooks/useSkillsetSecrets'

/**
 * What is left to do to a secret before the abilities behind it will run.
 *
 * Reported the same way wherever a secret surfaces - the connection list, and
 * the ability which depends on it.
 */
export default function SecretConnectionStatus({ secret }) {
  const { status, kind } = secret

  if (status === SECRET_PER_CONTACT || kind === SecretKind.personal) {
    return <span className="tag">your users connect their own</span>
  }

  if (status !== SECRET_NEEDS_SETUP) {
    return <span className="tag">ready</span>
  }

  return (
    <span className="tag warning">
      {canAuthenticateSecret(secret) ? 'needs authenticating' : 'needs a value'}
    </span>
  )
}
