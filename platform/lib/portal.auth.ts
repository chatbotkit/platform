import type { AuthOptions } from 'next-auth'
import type { AdapterUser } from 'next-auth/adapters'
import _EmailProvider from 'next-auth/providers/email'
import type EmailProviderType from 'next-auth/providers/email'

import { createEmailTransport } from '@chatbotkit-dev/email'
import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import type { PortalConfigType } from '@/prisma/zod'

import { userInConfig } from '@/lib/app.config.helpers'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import defaultAuthAdapter from '@/lib/auth.adapter'
import defaultAuthCallbacks from '@/lib/auth.callbacks'
import {
  getContextFrontendHost,
  getContextRequestIpAddress,
  getContextRequestUserAgent,
} from '@/lib/context.store'
import debug, { log } from '@/lib/debug'
import { getRootDomain } from '@/lib/domain'
import { captureError } from '@/lib/error'
import { logAudit } from '@/lib/log'
import memcache from '@/lib/memcache'
import { notifyEmailLogin } from '@/lib/notify'
import { getPortalGlobalConfig } from '@/lib/portal.config'
import {
  getPortalSlugFromHostname,
  isPortalHostname,
  isPortalRootHostname,
} from '@/lib/portal.hostname'
import { throwNotFound } from '@/lib/response'
import { generateRandomHex } from '@/lib/webcrypto'

import type { EmailBranding } from '@/layouts/Email'

const EmailProvider: typeof EmailProviderType =
  (_EmailProvider as unknown as { default?: typeof EmailProviderType })
    .default ?? (_EmailProvider as unknown as typeof EmailProviderType)

/**
 * Check access against the portal's own configuration and the partner's
 * shared portal configuration - either grants entry, so a partner can manage
 * its user lists in one place without duplicating them per portal.
 */
function userInPortalConfigs(
  user: { id?: string; email?: string },
  ...configs: (object | null | undefined)[]
): boolean {
  return configs.some(
    (config) =>
      !!config && userInConfig(user, config as Parameters<typeof userInConfig>[1])
  )
}

export async function getPortalAuthInitialAdapter(
  host: string
): Promise<AuthOptions['adapter']> {
  debug(`getPortalAuthInitialAdapter`, { host }).log(
    'portal.auth.getPortalAuthInitialAdapter'
  )

  const slug = getPortalSlugFromHostname(host)

  if (!slug) {
    debug(`portal not found`, { host }).log(
      'portal.auth.getPortalAuthInitialAdapter'
    )

    return throwNotFound(`Portal not found`)
  }

  // @note validate slug doesn't contain unexpected characters or data

  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    debug(`invalid slug format`, { host, slug }).log(
      'portal.auth.getPortalAuthInitialAdapter'
    )

    return throwNotFound(`Invalid portal slug`)
  }

  let portal

  try {
    portal = await prisma.portal.findUnique({
      where: {
        slug: slug,
      },
    })
  } catch (error) {
    // @note catch Prisma errors and log for debugging

    debug(`prisma error finding portal`, { host, slug, error }).log(
      'portal.auth.getPortalAuthInitialAdapter'
    )

    await captureError(error)

    return throwNotFound(`Portal not found`)
  }

  if (!portal) {
    debug(`portal not found`, { host }).log(
      'portal.auth.getPortalAuthInitialAdapter'
    )

    return throwNotFound(`Portal not found`)
  }

  const portalConfig = portal.config as PortalConfigType

  const portalGlobalConfig = await getPortalGlobalConfig(portal)

  const commonPrefix = `portal:${portal.id}`

  let name: string | undefined
  let description: string | undefined

  const portalId = portal.id
  let portalUserId: string | undefined = undefined

  return {
    async getUserByEmail(email) {
      debug('portal getUserByEmail', { email }).log(
        'portal.auth.getPortalAuthInitialAdapter.getUserByEmail'
      )

      let user

      if (email.startsWith('!')) {
        user = await prisma.user.findUnique({
          where: {
            email: email.slice(1),
          },
        })
      } else {
        if (userInPortalConfigs({ email }, portalConfig, portalGlobalConfig)) {
          name = email

          portalUserId = email

          user = await prisma.user.findUnique({
            where: {
              id: portal.userId,
            },
          })

          if (user) {
            user.email = `!${user.email}`
          }
        }
      }

      if (!user) {
        debug(`user not found`, { email }).log(
          'portal.auth.getPortalAuthInitialAdapter.getUserByEmail'
        )

        return null
      }

      const ret = {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      }

      debug(`returning`, { ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.getUserByEmail'
      )

      return ret
    },

    async createUser() {
      debug(`portal createUser`).log(
        'portal.auth.getPortalAuthInitialAdapter.createUser'
      )

      throw new Error(`User creation is not allowed`)
    },

    async updateUser(user) {
      debug(`portal updateUser`, { user }).log(
        'portal.auth.getPortalAuthInitialAdapter.updateUser'
      )

      const ret: AdapterUser = {
        id: user.id,
        email: user.email as string,
        emailVerified: user.emailVerified ?? null,
      }

      debug(`returning`, { ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.updateUser'
      )

      return ret
    },

    async deleteUser() {
      debug(`portal deleteUser`).log(
        'portal.auth.getPortalAuthInitialAdapter.deleteUser'
      )

      throw new Error(`User deletion is not allowed`)
    },

    async createSession(session) {
      debug('portal createSession', { session }).log(
        'portal.auth.getPortalAuthInitialAdapter.createSession'
      )

      const ret = await defaultAuthAdapter.createSession({
        ...session,

        ...{
          name: name,
          description: description,

          audience: APP_AUDIENCE,

          options: {
            portalId,
            portalUserId,
          },
        },
      })

      if (ret) {
        try {
          const ipAddress = getContextRequestIpAddress()
          const userAgent = getContextRequestUserAgent()
          const frontendHost = getContextFrontendHost()

          await logAudit({
            user: { id: session.userId },
            action: 'LOGIN',
            oldValues: undefined,
            newValues: {
              portalId: portalId,
              portalUserId: portalUserId,
            },
            relations: {
              portalId: portalId,
              // sessionId: ret.id, // @todo get the actual session id
            },
            meta: {
              ipAddress: ipAddress,
              userAgent: userAgent,
              frontendHost: frontendHost,
            },
          })
        } catch (auditError) {
          await captureError(auditError)
        }
      }

      debug(`returning`, { ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.createSession'
      )

      return ret || null
    },

    async updateSession(session) {
      debug('portal updateSession', { session }).log(
        'portal.auth.getPortalAuthInitialAdapter.updateSession'
      )

      const ret = await defaultAuthAdapter.updateSession({
        ...session,

        ...{
          // @note no additional properties are required for the update
        },
      })

      debug(`returning`, { ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.updateSession'
      )

      return ret || null
    },

    async deleteSession(sessionToken) {
      debug('portal deleteSession', { sessionToken }).log(
        'portal.auth.getPortalAuthInitialAdapter.deleteSession'
      )

      const ret = await defaultAuthAdapter.deleteSession(sessionToken)

      debug(`returning`, { ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.deleteSession'
      )

      return ret || null
    },

    async getSessionAndUser(sessionToken) {
      debug(`portal getSessionAndUser`, { sessionToken }).log(
        'portal.auth.getPortalAuthInitialAdapter.getSessionAndUser'
      )

      const ret = await defaultAuthAdapter.getSessionAndUser(sessionToken)

      debug(`returning`, { ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.getSessionAndUser'
      )

      return ret
    },

    async createVerificationToken(verificationToken) {
      debug('portal createVerificationToken', { verificationToken }).log(
        'portal.auth.getPortalAuthInitialAdapter.createVerificationToken'
      )

      const ret = {
        ...verificationToken,
      }

      const key = `${commonPrefix}:verificationToken:${verificationToken.token}`

      await memcache.set(key, ret, {
        ex: Math.floor(
          Math.abs(verificationToken.expires.getTime() - Date.now()) / 1000
        ),
      })

      debug(`returning`, { retToken: ret }).log(
        'portal.auth.getPortalAuthInitialAdapter.createVerificationToken'
      )

      return ret
    },

    async useVerificationToken(verificationToken) {
      debug('portal useVerificationToken', { verificationToken }).log(
        'portal.auth.getPortalAuthInitialAdapter.useVerificationToken'
      )

      const key = `${commonPrefix}:verificationToken:${verificationToken.token}`

      const value = await memcache.get(key)

      if (!value) {
        throw new Error(`Invalid token`)
      }

      await memcache.del(key)

      const { expires } = value as { expires: string }

      const retToken = {
        ...verificationToken,

        expires: new Date(expires),
      }

      debug(`returning`, { retToken }).log(
        'portal.auth.getPortalAuthInitialAdapter.useVerificationToken'
      )

      return retToken
    },
  }
}

export async function getPortalAuthProviders(
  host: string
): Promise<AuthOptions['providers']> {
  debug(`getPortalAuthProviders`, { host }).log(
    'portal.auth.getPortalAuthProviders'
  )

  const slug = getPortalSlugFromHostname(host)

  if (!slug) {
    debug(`portal not found`, { host }).log(
      'portal.auth.getPortalAuthProviders'
    )

    throw new Error(`Portal not found`)
  }

  // @note validate slug doesn't contain unexpected characters or data
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    debug(`invalid slug format`, { host, slug }).log(
      'portal.auth.getPortalAuthProviders'
    )

    throw new Error(`Invalid portal slug`)
  }

  let portal

  try {
    portal = await prisma.portal.findUnique({
      where: {
        slug: slug,
      },
    })
  } catch (error) {
    // @note catch Prisma errors and log for debugging
    debug(`prisma error finding portal`, { host, slug, error }).log(
      'portal.auth.getPortalAuthProviders'
    )

    await captureError(error)

    throw new Error(`Portal not found`)
  }

  if (!portal) {
    debug(`portal not found`, { host }).log(
      'portal.auth.getPortalAuthProviders'
    )

    throw new Error(`Portal not found`)
  }

  const portalConfig = portal.config as PortalConfigType

  const portalGlobalConfig = await getPortalGlobalConfig(portal)

  return [
    EmailProvider({
      maxAge: QUARTER_HOUR_IN_SECONDS, // token age in seconds

      async generateVerificationToken() {
        debug(`generateVerificationToken`).log(
          'auth.providers.EmailProvider.generateVerificationToken'
        )

        return generateRandomHex(6)
      },

      async sendVerificationRequest({
        identifier,
        url: _url,
        token,
      }: {
        identifier: string
        url: string
        token: string
      }): Promise<void> {
        debug(`portal sendVerificationRequest`, {
          identifier,
          token,
        }).log(
          'portal.auth.getPortalAuthProviders.EmailProvider.sendVerificationRequest'
        )

        if (
          !userInPortalConfigs({ email: identifier }, portalConfig, portalGlobalConfig)
        ) {
          debug(`user not in config`, { identifier }).log(
            'portal.auth.getPortalAuthProviders.EmailProvider.sendVerificationRequest'
          )

          return
        }

        const user = await prisma.user.findUnique({
          where: {
            id: portal.userId,
          },
        })

        if (!user) {
          debug(`user not found`, { identifier }).log(
            'portal.auth.getPortalAuthProviders.EmailProvider.sendVerificationRequest'
          )

          return
        }

        if (process.env.SKIP_VERIFICATION_REQUEST) {
          log(`skipping verification request`)
        } else {
          const effectiveHost = getRootDomain(getContextFrontendHost() || host)

          const sidebar =
            typeof portalConfig?.layout?.sidebar === 'object'
              ? portalConfig.layout.sidebar
              : undefined

          // @note the portal's own sidebar branding wins; the partner's
          // shared configuration supplies the customer-facing brand when the
          // portal itself sets none - portal.name is an internal label (a
          // workspace called "Production"), not a brand

          const globalName =
            typeof portalGlobalConfig?.name === 'string'
              ? portalGlobalConfig.name
              : undefined

          const globalLayout =
            portalGlobalConfig &&
            typeof portalGlobalConfig.layout === 'object' &&
            portalGlobalConfig.layout !== null
              ? (portalGlobalConfig.layout as { icon?: unknown; logo?: unknown })
              : undefined

          const globalIcon =
            typeof globalLayout?.icon === 'string'
              ? globalLayout.icon
              : undefined

          const globalLogo =
            typeof globalLayout?.logo === 'string'
              ? globalLayout.logo
              : undefined

          const branding: EmailBranding = {
            id: portal.id,
            name: sidebar?.title || globalName || portal.name || 'Portal',
            logo: sidebar?.logo || globalLogo,
            icon: sidebar?.icon || globalIcon,
            whitelabel: true,
          }

          // @note a portal on its own domain sends as that domain, which the
          // email module knows how to do - see createEmailTransport in
          // @chatbotkit-dev/email-spec. A portal on one of ours has no identity
          // of its own, so it falls through to the platform's own address.

          const transport =
            !isPortalRootHostname(effectiveHost) &&
            !isPortalHostname(effectiveHost)
              ? createEmailTransport(`notifications@${effectiveHost}`)
              : undefined

          try {
            await notifyEmailLogin(
              {
                ...user,

                email: identifier,
              },
              { token, branding, transport }
            )
          } catch (emailError) {
            // @note capture but do not propagate - a notification failure
            // must not block the auth flow; the token is already stored
            await captureError(emailError)
          }
        }
      },
    }),
  ]
}

export async function getPortalAuthInitialCallbacks(
  host: string
): Promise<AuthOptions['callbacks']> {
  debug(`getPortalAuthInitialCallbacks`, { host }).log(
    'portal.auth.getPortalAuthInitialCallbacks'
  )

  return {
    ...defaultAuthCallbacks,

    async signIn(params) {
      // @note we mute the signIn callback for portals to avoid adding emails to
      // mailing lists and other unwanted behavior

      debug(`portal signIn`, params).log(
        'portal.auth.getPortalAuthInitialCallbacks.signIn'
      )

      const ret = true // @note returning true to simplify the flow

      return ret
    },
  }
}
