import '@/lib/scope.server'

import prisma from '@/prisma/client'
import type { Secret, User } from '@/prisma/types'
import { SecretType } from '@/prisma/types'

import debug from '@/lib/debug'
import { omit, pick } from '@/lib/object'
import { canUseSecret } from '@/lib/secret.access'
import {
  ALLOWED_USER_CONFIG_FIELDS,
  SECRET_METADATA_FIELDS,
} from '@/lib/secret.constants'
import { fastGetUserById } from '@/lib/user.get'

/**
 * Retrieves a secret instance from a secret
 *
 * @param referenceSecret
 * @returns
 */
export async function revealSecretInstanceFromReferenceSecret(
  referenceSecret:
    | Secret
    | (Secret & { user: Pick<User, 'id' | 'email' | 'parentId'> })
): Promise<Secret | null> {
  debug('revealing secret instance from reference secret', {
    referenceSecret,
  }).log('secret.value.revealSecretInstanceFromReferenceSecret')

  if (referenceSecret.type === SecretType.reference) {
    const {
      id,
      secretId = id,
      reference = secretId,
      params,
      parameters = params,
    } = (referenceSecret.config || {}) as {
      id?: string
      secretId?: string
      reference?: string
      params?: Record<string, unknown>
      parameters?: Record<string, unknown>
    }

    if (reference) {
      let user

      if ('user' in referenceSecret) {
        user = referenceSecret.user
      } else {
        user = await fastGetUserById(referenceSecret.userId)
      }

      if (!user) {
        debug('user not found for secret reference', {
          userId: referenceSecret.userId,
        }).log('secret.value.revealSecretInstanceFromReferenceSecret')

        return null
      }

      const instance = await prisma.secret.findUniqueByIdentifier(
        user,
        reference
      )

      if (!instance) {
        debug('referenced secret instance not found', {
          reference,
        }).log('secret.value.revealSecretInstanceFromReferenceSecret')

        return null
      }

      if (await canUseSecret(user, instance)) {
        parameters // @note not used at the moment

        return {
          ...omit(referenceSecret, ['user']),

          ...instance,

          config: {
            // @note this potentially could lead to security issues, therefore
            // we only allow specific fields to be overridden
            // @todo figure out how to do this better

            // 1. Start with the referenced secret's config as the base,
            //    but omit metadata fields that should not be exposed
            ...omit(
              typeof instance.config === 'object' ? instance.config : {},
              [...SECRET_METADATA_FIELDS]
            ),

            // 2. Allow user's config to override specific allowed fields
            ...pick((referenceSecret.config as object) || {}, [
              ...ALLOWED_USER_CONFIG_FIELDS,
            ]),

            // 3. Apply any additional parameters
            ...parameters,
          },

          value: referenceSecret.value || instance.value,
        }
      }
    }
  }

  return null
}
