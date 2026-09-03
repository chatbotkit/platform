import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import type { Secret } from '@/prisma/types'
import { SecretType } from '@/prisma/types'

import { encode as encodeB64 } from '@/lib/b64'
import type { ContextContact, ContextNamespace } from '@/lib/context.store'
import {
  getContextContact,
  getContextNamespace,
  getContextUser,
} from '@/lib/context.store'
import { parseBasicCredentials } from '@/lib/creds.basic.parse'
import debug, { assert } from '@/lib/debug'
import { UserAuthError } from '@/lib/error'
import { toHeaders } from '@/lib/header'
import { getAccessToken } from '@/lib/oauth.token'
import { canUseSecret } from '@/lib/secret.access'
import { secretVariableRegex } from '@/lib/secret.extract'
import type { SecretManager } from '@/lib/secret.manager'
import { getSecretManager } from '@/lib/secret.manager'
import { normalizeSecretName } from '@/lib/secret.name'
import {
  getNewSecretOAuthValue,
  getSecretOAuthConfig,
  getSecretOAuthValue,
} from '@/lib/secret.oauth'
import { revealSecretInstanceFromReferenceSecret } from '@/lib/secret.reference'
import { revealSecretInstanceFromTemplateSecret } from '@/lib/secret.template'
import { replaceWithMap } from '@/lib/string'
import { normalizePrivateKeyPemToPKCS8 } from '@/lib/webcrypto'

/**
 * Check if headers contain any secret placeholders.
 *
 * @param headers - The headers to check for secret references
 * @returns True if any header value contains at least one secret placeholder
 */
export function hasSecrets(
  headers: Headers | Record<string, string | string[]>
): boolean {
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers)

  for (const [, value] of entries) {
    const values = Array.isArray(value) ? value : [value]

    for (const v of values) {
      if (secretVariableRegex.test(v)) {
        return true
      }
    }
  }

  return false
}

/**
 * The following types are designed for maximum flexibility in handling inline
 * secrets. These types support synchronous and asynchronous value resolution,
 * lazy loading, and both direct values and computed values.
 */

export type InlineSecretValueGetter = () => Promise<string | null>

export type InlineSecretValue = string | InlineSecretValueGetter

export type InlineSecretEntry =
  | { value: InlineSecretValue }
  | InlineSecretValueGetter

export type InlineSecretMap = Record<string, InlineSecretEntry>

export type InlineSecretMapGetter = () => Promise<InlineSecretMap | null>

export type InlineSecretSource = InlineSecretMap | InlineSecretMapGetter

/**
 * Retrieves an inline secret value by name from the provided secret source.
 * Supports multiple resolution patterns for maximum flexibility:
 * - Direct string values
 * - Async value getters
 * - Lazy-loaded secret maps
 * - Case-insensitive secret name matching
 *
 * @param secretSource - The source of secrets (map or getter function)
 * @param secretName - The name of the secret to retrieve
 * @returns The secret value or null if not found
 */
export async function getInlineSecretValue(
  secretSource: InlineSecretSource,
  secretName: string
): Promise<string | null> {
  debug(`getInlineSecretValue`, { secretName, secretSource }).log(
    'secret.value.getInlineSecretValue'
  )

  // @note resolve the secret map if it's a getter function

  let secretMap: InlineSecretMap | null

  if (typeof secretSource === 'function') {
    secretMap = await secretSource()
  } else {
    secretMap = secretSource
  }

  if (!secretMap) {
    debug(`no secret map found`).log('secret.value.getInlineSecretValue')

    return null
  }

  let secretEntry

  // @note try exact match first for performance

  if (!secretEntry) {
    secretEntry = secretMap[secretName]
  }

  // @note fallback to case-insensitive search if exact match fails

  if (!secretEntry) {
    const normalizedName = secretName.toLowerCase()

    const matchingKey = Object.keys(secretMap).find(
      (key) => key.toLowerCase() === normalizedName
    )

    if (matchingKey) {
      secretEntry = secretMap[matchingKey]

      debug(`found secret with case-insensitive match`, {
        requestedName: secretName,
        foundKey: matchingKey,
      }).log('secret.value.getInlineSecretValue')
    }
  }

  // @note exit if no secret sentry

  if (!secretEntry) {
    debug(`secret not found`, {
      secretName,
      availableKeys: Object.keys(secretMap),
    }).log('secret.value.getInlineSecretValue')

    return null
  }

  // @note handle direct getter function (not wrapped in object)

  if (typeof secretEntry === 'function') {
    return await secretEntry()
  }

  // @note handle object with value property

  if ('value' in secretEntry) {
    const { value } = secretEntry

    if (typeof value === 'function') {
      return await value()
    } else if (typeof value === 'string') {
      return value
    }
  }

  debug(`invalid secret entry format`, { secretEntry }).log(
    'secret.value.getInlineSecretValue'
  )

  return null
}

/**
 * Retrieves a secret from the secret store. This method checks if the session
 * user is the same as the secret owner. If yes, the secret is returned. Keep in
 * mind that this function does not check whether the user has access to the
 * secret - the caller must implement this check.
 *
 * @param options
 * @returns
 * @todo implement caching for faster lookups
 */
export async function getUnsafeSecretInstance({
  userId,
  secretName,
  secretId,
  abilityId,
}: {
  userId: string
  secretName: string
  secretId: string | null | undefined
  abilityId: string | null | undefined
}): Promise<Secret | null> {
  debug(`getUnsafeSecretInstance`, {
    userId,
    secretName,
    secretId,
    abilityId,
  }).log('secret.value.getUnsafeSecretInstance')

  const user = getContextUser()

  {
    // exit if no user is found

    if (!user) {
      debug(`no user in session`).log('secret.value.getUnsafeSecretInstance')

      return null
    }

    // exit if the user is not the owner of the secret

    if (user.id !== userId) {
      debug(`user in session does not match secret owner`, {
        sessionUserId: user.id,
        secretOwnerId: userId,
      }).log('secret.value.getUnsafeSecretInstance')

      return null
    }
  }

  let secret

  {
    // find the secret by secret id

    if (!secret) {
      if (secretId && secretName === 'DEFAULT') {
        secret = await prisma.secret.findUnique({
          where: {
            id: secretId,
          },

          // @note we cannot cache because token update may happen which will
          // result in stale data
          // cacheStrategy: {
          //   swr: 60,
          //   ttl: 60,
          // },
        })
      }
    }

    // find the secret by ability id

    if (!secret) {
      if (abilityId && secretName === 'DEFAULT') {
        const ability = await prisma.ability.findUnique({
          where: {
            id: abilityId,
          },

          select: {
            linkedSecret: true,
          },
        })

        secret = ability?.linkedSecret
      }
    }

    // find the secret by custom name

    if (!secret) {
      const secrets = await prisma.secret.findMany({
        where: {
          userId: userId,
        },

        // @note we cannot cache because token update may happen which will
        // result in stale data
        // cacheStrategy: {
        //   swr: 60,
        //   ttl: 60,
        // },
      })

      secret = secrets.find((secret) => {
        return (
          normalizeSecretName(secret.name || '') ===
          normalizeSecretName(secretName)
        )
      })
    }

    // exit if the secret is not found

    if (!secret) {
      return null
    }
  }

  // @note never log the record itself - it carries the stored value
  debug(`found secret`, {
    secretId: secret.id,
    secretType: secret.type,
    secretKind: secret.kind,
  }).log('secret.value.getUnsafeSecretInstance.foundSecret')

  return secret || null
}

/**
 * Get the value of a secret. The value is returned as a string. The secret
 * value is determined by the type of secret and returned in the appropriate
 * format.
 *
 * @param secret
 * @param [options]
 * @returns
 */
export async function getSecretValueAndType(
  secret: Secret,
  options?: {
    contact?: ContextContact
    namespace?: ContextNamespace
  },
  baseType?: SecretType
): Promise<{
  value: string
  type: SecretType
  baseType: SecretType
  expiresAt?: number | null
} | null> {
  debug(`getting secret value and type`, {
    secretId: secret.id,
    secretType: secret.type,
    secretKind: secret.kind,
  }).log('secret.value.getSecretValueAndType')

  let secretManager: SecretManager | null

  {
    const contact = options?.contact || getContextContact()
    const namespace = options?.namespace || getContextNamespace()

    debug(`using context`, { contact, namespace }).log(
      'secret.value.getSecretValueAndType'
    )

    secretManager = getSecretManager(secret, {
      contact,
      namespace,
    })

    if (!secretManager) {
      if (!contact && !namespace) {
        // @note the reason we do this special check here is because the error
        // will be surfaced to the AI agent therefore we need to add some
        // information that may help the user

        throw new UserAuthError(
          `Cannot obtain valid authentication context: the current conversation session is mostly likely not trusted`
        )
      } else {
        throw new UserAuthError(`Cannot obtain secret manager`)
      }
    }
  }

  debug(`using secret manager`, {
    secretManager: secretManager.constructor.name,
  }).log('secret.value.getSecretValueAndType')

  const value = await secretManager.getValue(secret)

  switch (secret.type) {
    case SecretType.plain: {
      if (!value) {
        return null
      }

      return {
        value: value || '',
        type: SecretType.plain,
        baseType: baseType || SecretType.plain,
      }
    }

    case SecretType.basic: {
      const trimmedValue = (value || '').trim()

      // @note an empty value carries no credentials. Without this the raw
      // user:pass fallback below encodes it into a `Basic ` header with nothing
      // behind it, which reads as a value everywhere one is looked for - the
      // secret verifies as authenticated and the request goes out unauthorised

      if (!trimmedValue) {
        return null
      }

      const result = parseBasicCredentials(trimmedValue)

      if (!result.success) {
        if (result.isStructured) {
          // @note structured format but no valid credentials found

          return null
        }

        // @note treat unparsable value as raw user:pass format

        return {
          value: `Basic ${encodeB64(trimmedValue)}`,
          type: SecretType.basic,
          baseType: baseType || SecretType.basic,
        }
      }

      const { username, password } = result.credentials

      return {
        value: `Basic ${encodeB64(`${username}:${password}`)}`,
        type: SecretType.basic,
        baseType: baseType || SecretType.basic,
      }
    }

    case SecretType.bearer: {
      const trimmedValue = (value || '').trim()

      if (!trimmedValue) {
        return null
      }

      const { schema: rawSchema } =
        typeof secret.config === 'object' && secret.config !== null
          ? (secret.config as { schema?: unknown })
          : {}

      const trimmedSchema =
        typeof rawSchema === 'string' ? rawSchema.trim() : ''

      const schema = trimmedSchema || 'Bearer'

      return {
        value: `${schema} ${trimmedValue}`,
        type: SecretType.bearer,
        baseType: baseType || SecretType.bearer,
      }
    }

    case SecretType.jwt: {
      const trimmedValue = (value || '').trim()

      if (!trimmedValue) {
        return null
      }

      const config =
        typeof secret.config === 'object' && secret.config !== null
          ? (secret.config as Record<string, unknown>)
          : {}

      const algorithm =
        typeof config.algorithm === 'string' ? config.algorithm : 'RS256'

      const expiresInSeconds =
        typeof config.expiresInSeconds === 'number'
          ? config.expiresInSeconds
          : 600

      const claims =
        typeof config.claims === 'object' &&
        config.claims !== null &&
        !Array.isArray(config.claims)
          ? (config.claims as Record<string, unknown>)
          : {}

      const schema =
        typeof config.schema === 'string' && config.schema.trim()
          ? config.schema.trim()
          : 'Bearer'

      const { importPKCS8, SignJWT } = await import('jose')

      const privateKey = await importPKCS8(
        normalizePrivateKeyPemToPKCS8(trimmedValue),
        algorithm
      )

      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt()
        .setExpirationTime(`${expiresInSeconds}s`)
        .sign(privateKey)

      return {
        value: `${schema} ${token}`,
        type: SecretType.bearer,
        baseType: baseType || SecretType.jwt,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      }
    }

    case SecretType.oauth: {
      const pseudoSecret = {
        ...secret,

        value,
      }

      debug(`using pseudo secret`, { pseudoSecret }).log(
        'secret.value.getSecretValueAndType'
      )

      const oAuthValue = await getSecretOAuthValue(pseudoSecret)
      const oAuthConfig = await getSecretOAuthConfig(pseudoSecret)

      debug(`using`, { oAuthValue, oAuthConfig }).log(
        'secret.value.getSecretValueAndType'
      )

      let resolvedAccessTokenExpiresAt: number | null =
        typeof oAuthValue.accessTokenExpiresAt === 'number'
          ? oAuthValue.accessTokenExpiresAt
          : null

      const toEpochMs = (value: unknown): number | null => {
        if (value == null) {
          return null
        }

        if (typeof value === 'number') {
          return value
        }

        if (value instanceof Date) {
          return value.getTime()
        }

        const parsed = Date.parse(String(value))

        return Number.isNaN(parsed) ? null : parsed
      }

      const accessToken = await getAccessToken({
        ...oAuthValue,

        oAuthIntegration: {
          ...oAuthConfig,
        },

        updateToken: async (
          accessToken,
          accessTokenExpiresAt,
          refreshToken,
          refreshTokenExpiresAt
        ) => {
          debug(`updating access token`, {
            accessToken,
            accessTokenExpiresAt,
            refreshToken,
            refreshTokenExpiresAt,
          }).log('secret.value.getSecretValueAndType')

          resolvedAccessTokenExpiresAt =
            toEpochMs(accessTokenExpiresAt) ?? resolvedAccessTokenExpiresAt

          await secretManager.setValue(
            pseudoSecret,
            await getNewSecretOAuthValue(pseudoSecret, {
              accessToken,
              accessTokenExpiresAt,
              refreshToken,
              refreshTokenExpiresAt,
            })
          )
        },

        revokeToken: async (accessToken) => {
          debug(`revoking access token`, { accessToken }).log(
            'secret.value.getSecretValueAndType'
          )

          await secretManager.delValue(pseudoSecret, true)
        },
      })

      debug(`using access token`, { accessToken }).log(
        'secret.value.getSecretValueAndType'
      )

      if (!accessToken) {
        return null
      }

      return {
        value: `Bearer ${(accessToken || '').trim()}`,
        type: SecretType.bearer,
        baseType: baseType || SecretType.oauth,
        expiresAt: resolvedAccessTokenExpiresAt,
      }
    }

    case SecretType.template: {
      const instance = await revealSecretInstanceFromTemplateSecret(secret)

      if (!instance) {
        throw new Error(`Cannot find secret template`)
      }

      assert(
        instance.type !== SecretType.template,
        'Nested templates are not allowed'
      )

      return await getSecretValueAndType(
        {
          ...secret,

          type: instance.type,
          config: instance.config,

          // @note we use the value of the template secret if available
          // @note might be overdoing it because this is the expected behavior for revealSecretInstanceFromTemplateSecret

          value: value || instance.value,
        },
        options,
        baseType || instance.type
      )
    }

    case SecretType.reference: {
      const instance = await revealSecretInstanceFromReferenceSecret(secret)

      if (!instance) {
        throw new Error(`Cannot find secret reference`)
      }

      return await getSecretValueAndType(
        {
          ...secret,

          type: instance.type,
          config: instance.config,

          // @note we use the value of the reference secret if available
          // @note might be overdoing it because this is the expected behavior for revealSecretInstanceFromReferenceSecret

          value: value || instance.value,
        },
        options,
        baseType || instance.type
      )
    }

    default: {
      assertUnreachable(secret.type)
    }
  }
}

/**
 * Get the value of a secret. The value is returned as a string. The secret
 * value is determined by the type of secret and returned in the appropriate
 * format.
 *
 * @param secret
 * @param [options]
 * @returns
 * @deprecated use getSecretValueAndType instead
 */
export async function getSecretValue(
  secret: Secret,
  options?: {
    contact?: ContextContact
    namespace?: ContextNamespace
  }
): Promise<string | null> {
  const result = await getSecretValueAndType(secret, options)

  if (!result) {
    return null
  }

  return result.value
}

/**
 * Recursively identifies secret placeholders and swaps them with values from
 * the secret store. Secrets are defined in the format: ${SECRET_NAME}.
 *
 * @param options
 * @returns
 */
export async function swapSecrets(
  headers: Headers | Record<string, string | string[]>,
  {
    userId,
    secretId,
    abilityId,

    inlineSecrets,

    fnGetInlineSecretValue = getInlineSecretValue,
    fnGetUnsafeSecretInstance = getUnsafeSecretInstance,

    contact,
    namespace,

    discardSecretPlaceholders,
  }: {
    userId: string
    secretId: string | null | undefined
    abilityId: string | null | undefined
    inlineSecrets?: InlineSecretSource
    fnGetInlineSecretValue?: typeof getInlineSecretValue
    fnGetUnsafeSecretInstance?: typeof getUnsafeSecretInstance
    contact?: ContextContact
    namespace?: ContextNamespace
    discardSecretPlaceholders?: boolean
  }
): Promise<Headers> {
  debug(`swapSecrets`, {
    headers,
    userId,
    abilityId,
    secretId,
    inlineSecrets,
    contact,
    namespace,
  }).log('secret.value.swapSecrets')

  const thisHeaders = headers instanceof Headers ? headers : toHeaders(headers)
  const updatedHeaders: Headers = new Headers()

  const collectMatches = (value: string) => {
    const secretPattern = new RegExp(secretVariableRegex, 'g')

    const matches: Array<{
      fullMatch: string
      secretName: string
      index: number
      length: number
    }> = []

    while (true) {
      const match = secretPattern.exec(value)

      if (!match) {
        break
      }

      matches.push({
        fullMatch: match[0],
        secretName: match[1] || match[2], // handle both capture groups
        index: match.index,
        length: match[0].length,
      })
    }

    return matches
  }

  for (const [key, value] of thisHeaders.entries()) {
    const matches = collectMatches(value)

    if (matches.length > 0) {
      const swapMap = {}

      // @note process matches in reverse order to maintain correct string positions

      for (const matchInfo of matches.reverse()) {
        let secretValue: string | null | undefined

        // start with inline secrets
        {
          // @note we use == to capture both undefined and null

          if (secretValue == null) {
            if (inlineSecrets) {
              secretValue = await fnGetInlineSecretValue(
                inlineSecrets,
                matchInfo.secretName
              )
            }
          }
        }

        // fallback to secret store
        {
          // @note we use == to capture both undefined and null

          if (secretValue == null) {
            const secret = await fnGetUnsafeSecretInstance({
              userId,
              abilityId,
              secretId,
              secretName: matchInfo.secretName,
            })

            debug(`found secret`, {
              secretName: matchInfo.secretName,
              secret,
            }).log('secret.value.swapSecrets')

            if (secret) {
              // @note for purely safety reason the canUseSecret expect the user
              // object to contain an email field - however, in this case we do
              // not have access to the user's email address therefore we pass
              // a placeholder value

              if (await canUseSecret({ id: userId, email: '' }, secret)) {
                debug(`can use secret`, {
                  secretName: matchInfo.secretName,
                  secret,
                }).log('secret.value.swapSecrets')

                secretValue = await getSecretValue(secret, {
                  contact,
                  namespace,
                })

                // @note if we found a secret record but it has no value, throw
                // an error to help users debug the issue - this is much better
                // than silently discarding the placeholder

                if (secretValue == null) {
                  throw new UserAuthError(
                    `A linked secret exists but has no value configured. Please authenticate or set up the secret value.`
                  )
                }
              } else {
                debug(`cannot use secret`, {
                  secretName: matchInfo.secretName,
                  secret,
                }).log('secret.value.swapSecrets')
              }
            }
          }
        }

        // swap the secret
        {
          // @note we use != to capture both undefined and null

          if (secretValue != null) {
            debug(`replacing secret`, {
              secretName: matchInfo.secretName,
              secretValue,
            }).log('secret.value.swapSecrets')

            swapMap[matchInfo.fullMatch] = secretValue
          } else {
            debug(`discarding secret`, {
              secretName: matchInfo.secretName,
              secretValue,
            }).log('secret.value.swapSecrets')

            if (discardSecretPlaceholders) {
              swapMap[matchInfo.fullMatch] = ''
            }
          }
        }
      }

      if (Object.keys(swapMap).length) {
        let thisValue = replaceWithMap(value, swapMap)

        // @note we want to fix some common errors here
        {
          thisValue = thisValue
            .replace(/^Basic(\s*Basic)+\s+/i, 'Basic ')
            .replace(/^Bearer(\s*Bearer)+\s+/i, 'Bearer ')
        }

        updatedHeaders.append(key, thisValue)
      } else {
        updatedHeaders.append(key, value)
      }
    } else {
      updatedHeaders.append(key, value)
    }
  }

  debug(`using headers`, { updatedHeaders }).log('secret.value.swapSecrets')

  return updatedHeaders
}
