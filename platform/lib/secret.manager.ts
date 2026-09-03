import {
  ONE_DAY_IN_SECONDS,
  QUARTER_HOUR_IN_SECONDS,
} from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import type { Contact as DBContact, Secret as DBSecret } from '@/prisma/types'
import { SecretKind } from '@/prisma/types'

import debug, { assert } from '@/lib/debug'
import { AdminAuthError, UserAuthError } from '@/lib/error'
import { getExternalFrontendHostURL } from '@/lib/host'
import { sign } from '@/lib/jwt'
import memcache from '@/lib/memcache'
import { getTempShortURL } from '@/lib/short'

type Contact = Omit<DBContact, 'createdAt' | 'updatedAt'>

type Secret = Omit<DBSecret, 'createdAt' | 'updatedAt'>

export interface DirectState {
  userId: string
  secretId: string

  direct: {
    id: string
  }
}

export interface EphemeralState {
  userId: string
  secretId: string

  ephemeral: {
    namespace: string
  }
}

export interface ContactState {
  userId: string
  secretId: string

  contact: {
    id: string
  }
}

export async function getAuthURL(
  path: string,
  state: Record<string, unknown>,
  options?: { raw?: boolean }
): Promise<URL> {
  const stateToken = await sign(state, QUARTER_HOUR_IN_SECONDS)

  // @todo use signed urls

  const url = new URL(path, getExternalFrontendHostURL())

  url.searchParams.set('state', stateToken)

  url.hash = new URLSearchParams({
    target: '_popup', // @note used to hint that this should open in a new window
    unfurl: '0', // @note used to hint that this should not unfurl
  }).toString()

  let authUrl: string

  if (options?.raw) {
    authUrl = url.href
  } else {
    authUrl = await getTempShortURL(url.href)
  }

  {
    const url = new URL(authUrl)

    if (!url.searchParams.has('cbk')) {
      url.searchParams.set('cbk', '1')
    }

    if (!url.searchParams.has('auth')) {
      url.searchParams.set('auth', '1')
    }

    if (!url.searchParams.has('unfurl')) {
      url.searchParams.set('unfurl', '0')
    }

    authUrl = url.href
  }

  return new URL(authUrl)
}

export async function getUserAuthError(
  path: string,
  state: Record<string, unknown>,
  options?: { raw?: boolean }
): Promise<UserAuthError> {
  const url = await getAuthURL(path, state, options)

  return new UserAuthError(
    `Missing value for secret: ask the user to visit ${url.href} to authorize access`
  )
}

export async function getAdminAuthError(
  path: string,
  state: Record<string, unknown>,
  options?: { raw?: boolean }
): Promise<AdminAuthError> {
  const url = await getAuthURL(path, state, options)

  // @note the url is generated but for security reasons we don't reveal it in
  // the message although technically we are returning an admin auth error which
  // should prevent this scenario

  void url

  return new AdminAuthError(`Missing value for secret`)
}

export interface SecretManager {
  getValue(secret: Secret): Promise<string | null>
  setValue(secret: Secret, value: string): Promise<void>
  delValue(secret: Secret, auth?: boolean): Promise<void>
}

export class DirectSecretManager implements SecretManager {
  #required: boolean

  constructor({ required = false }: { required?: boolean }) {
    this.#required = required
  }

  #getAuthState(secret: Secret): DirectState {
    return {
      userId: secret.userId,
      secretId: secret.id,

      direct: {
        id: secret.id,
      },
    }
  }

  async getAuthUrl(secret: Secret, options?: { raw?: boolean }): Promise<URL> {
    assert(secret.kind === SecretKind.shared, 'Secret kind must be shared')

    const state: DirectState = this.#getAuthState(secret)

    return await getAuthURL(
      `/secrets/${secret.id}/manager/authenticate`,
      {
        ...state,
      },
      options
    )
  }

  async getAuthError(secret: Secret): Promise<UserAuthError> {
    const state: DirectState = this.#getAuthState(secret)

    return await getAdminAuthError(
      `/secrets/${secret.id}/manager/authenticate`,
      {
        ...state,
      }
    )
  }

  async getValue(secret: Secret): Promise<string | null> {
    const value = secret.value

    if (!value) {
      if (this.#required) {
        // @note do not throw UserAuthError because direct secret manager is
        // only used by administrators - this can cause for setup links to be
        // revealed to the user - which can be a security risk
        // @todo alternative, detect what is the current user and throw a
        // UserAuthError if the current user does not represent a risk
      }
    }

    return value || null
  }

  async setValue(secret: Secret, value: string): Promise<void> {
    await prisma.secret.update({
      where: {
        id: secret.id,
      },

      data: {
        value,
      },
    })
  }

  async delValue(secret: Secret): Promise<void> {
    await prisma.secret.update({
      where: {
        id: secret.id,
      },

      data: {
        value: null,
      },
    })
  }
}

export class ContactSecretManager implements SecretManager {
  #required: boolean
  #contact: Contact

  constructor({
    required = false,
    contact,
  }: {
    required?: boolean
    contact: Contact
  }) {
    this.#required = required
    this.#contact = contact
  }

  #getAuthState(secret: Secret): ContactState {
    return {
      userId: secret.userId,
      secretId: secret.id,

      contact: {
        id: this.#contact.id,
      },
    }
  }

  async getAuthUrl(secret: Secret, options?: { raw?: boolean }): Promise<URL> {
    assert(secret.kind === SecretKind.personal, 'Secret kind must be personal')

    const state: ContactState = this.#getAuthState(secret)

    return await getAuthURL(
      `/secrets/${secret.id}/manager/authenticate`,
      {
        ...state,
      },
      options
    )
  }

  async getAuthError(secret: Secret): Promise<UserAuthError> {
    const state: ContactState = this.#getAuthState(secret)

    return await getUserAuthError(
      `/secrets/${secret.id}/manager/authenticate`,
      {
        ...state,
      }
    )
  }

  async getValue(secret: Secret): Promise<string | null> {
    const { value } =
      (await prisma.secretValue.findUnique({
        where: {
          userId_secretId_contactId: {
            userId: secret.userId,
            secretId: secret.id,
            contactId: this.#contact.id,
          },
        },
      })) || {}

    if (!value) {
      if (this.#required) {
        throw await this.getAuthError(secret)
      }
    }

    return value || null
  }

  async setValue(secret: Secret, value: string): Promise<void> {
    await prisma.secretValue.upsert({
      where: {
        userId_secretId_contactId: {
          userId: secret.userId,
          secretId: secret.id,
          contactId: this.#contact.id,
        },
      },

      create: {
        userId: secret.userId,
        secretId: secret.id,
        contactId: this.#contact.id,

        value,
      },

      update: {
        value,
      },
    })
  }

  async delValue(secret: Secret, auth: boolean): Promise<void> {
    await prisma.secretValue.delete({
      where: {
        userId_secretId_contactId: {
          userId: secret.userId,
          secretId: secret.id,
          contactId: this.#contact.id,
        },
      },
    })

    if (auth) {
      throw await this.getAuthError(secret)
    }
  }
}

export class EphemeralSecretManager implements SecretManager {
  #required: boolean
  #namespace: string

  constructor({
    required = false,
    namespace,
  }: {
    required?: boolean
    namespace: string
  }) {
    this.#required = required
    this.#namespace = namespace
  }

  #getCacheKey(secret: Secret): string {
    return `secret:ephemeral:${secret.id}:${this.#namespace}`
  }

  #getAuthState(secret: Secret): EphemeralState {
    return {
      userId: secret.userId,
      secretId: secret.id,

      ephemeral: {
        namespace: this.#namespace,
      },
    }
  }

  async getAuthUrl(secret: Secret, options?: { raw?: boolean }): Promise<URL> {
    assert(secret.kind === SecretKind.personal, 'Secret kind must be personal')

    const state: EphemeralState = this.#getAuthState(secret)

    return await getAuthURL(
      `/secrets/${secret.id}/manager/authenticate`,
      {
        ...state,
      },
      options
    )
  }

  async getAuthError(secret: Secret): Promise<UserAuthError> {
    const state: EphemeralState = this.#getAuthState(secret)

    return await getUserAuthError(
      `/secrets/${secret.id}/manager/authenticate`,
      {
        ...state,
      }
    )
  }

  async getValue(secret: Secret): Promise<string | null> {
    const value = await memcache.get<string>(this.#getCacheKey(secret))

    if (!value) {
      if (this.#required) {
        throw await this.getAuthError(secret)
      }
    }

    return value || null
  }

  async setValue(secret: Secret, value: string): Promise<void> {
    await memcache.set<string>(this.#getCacheKey(secret), value, {
      ex: ONE_DAY_IN_SECONDS,
    })
  }

  async delValue(secret: Secret, auth: boolean): Promise<void> {
    await memcache.del(this.#getCacheKey(secret))

    if (auth) {
      throw await this.getAuthError(secret)
    }
  }
}

export function getSecretManager(
  secret: Secret,
  {
    contact,
    namespace,
  }: { contact?: Contact | null; namespace?: string | null },
  result?: { rejectionReason: string }
): SecretManager | null {
  debug(`getSecretManager`, { secretId: secret.id, contact, namespace }).log(
    'secret.manager.getSecretManager'
  )

  switch (secret.kind) {
    case SecretKind.personal: {
      // @note the function is implemented to cascade until it finds a
      // satisfactory secret manager

      // handle contact secrets
      {
        if (contact) {
          debug(`using contact`, { contact }).log(
            'secret.manager.getSecretManager'
          )

          if (contact.verifiedAt) {
            debug(`contact is verified`).log('secret.manager.getSecretManager')

            return new ContactSecretManager({
              required: true,
              contact: contact,
            })
          } else {
            if (result && !result.rejectionReason) {
              result.rejectionReason = 'contact not verified'
            }

            debug(`contact is not verified`).log(
              'secret.manager.getSecretManager'
            )
          }
        }
      }

      // handle namespace secrets
      {
        if (namespace) {
          debug(`using namespace`, { namespace }).log(
            'secret.manager.getSecretManager'
          )

          return new EphemeralSecretManager({
            required: true,
            namespace: namespace,
          })
        }
      }

      // return null if neither contact nor namespace is available - it
      // indicates that there is a lack of suitable manager for this context

      if (result && !result.rejectionReason) {
        result.rejectionReason = 'no contact or namespace available'
      }

      return null
    }

    case SecretKind.shared: {
      return new DirectSecretManager({
        required: true,
      })
    }

    default: {
      assertUnreachable(secret.kind)
    }
  }
}
