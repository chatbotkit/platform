import type { AuthOptions } from 'next-auth'
import type { AdapterUser } from 'next-auth/adapters'
import _EmailProvider from 'next-auth/providers/email'
import type EmailProviderType from 'next-auth/providers/email'

import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import defaultAuthAdapter from '@/lib/auth.adapter'
import defaultAuthCallbacks from '@/lib/auth.callbacks'
import debug, { log } from '@/lib/debug'
import { captureError } from '@/lib/error'
import memcache from '@/lib/memcache'
import { notifyEmailLogin } from '@/lib/notify'
import {
  getPartnerByIdentifier,
  getPartnerSlugFromHostname,
  partnerToEmailBranding,
} from '@/lib/partner.helpers'
import { throwNotFound } from '@/lib/response'
import { generateRandomHex } from '@/lib/webcrypto'

import type { EmailBranding } from '@/layouts/Email'

const EmailProvider: typeof EmailProviderType =
  (_EmailProvider as unknown as { default?: typeof EmailProviderType })
    .default ?? (_EmailProvider as unknown as typeof EmailProviderType)

export async function getPartnerAuthInitialAdapter(
  host: string
): Promise<AuthOptions['adapter']> {
  debug(`getPartnerAuthInitialAdapter`, { host }).log(
    'partner.auth.getPartnerAuthInitialAdapter'
  )

  const slug = getPartnerSlugFromHostname(host)

  if (!slug) {
    debug(`partner not found`, { host }).log(
      'partner.auth.getPartnerAuthInitialAdapter'
    )

    return throwNotFound(`Partner not found`)
  }

  // @note validate slug doesn't contain unexpected characters or data

  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    debug(`invalid slug format`, { host, slug }).log(
      'portal.auth.getPortalAuthInitialAdapter'
    )

    return throwNotFound(`Invalid portal slug`)
  }

  const partner = await getPartnerByIdentifier(slug)

  if (!partner) {
    debug(`partner not found`, { slug }).log(
      'partner.auth.getPartnerAuthInitialAdapter'
    )

    return throwNotFound(`Partner not found`)
  }

  const commonPrefix = `partner:${partner.id}`

  return {
    async getUserByEmail(email) {
      debug('partner getUserByEmail', { email }).log(
        'partner.auth.getPartnerAuthInitialAdapter.getUserByEmail'
      )

      let user = await prisma.user.findFirst({
        where: {
          parentId: partner.id,
          OR: [{ email }, { parentContextEmail: email }],
        },
      })

      if (!user && partner.auth?.allowGlobalLogin) {
        user = await prisma.user.findUnique({
          where: {
            email,
          },
        })
      }

      if (!user) {
        debug(`user not found`, { email }).log(
          'partner.auth.getPartnerAuthInitialAdapter.getUserByEmail'
        )

        return null
      }

      const ret = {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      }

      debug(`returning`, { ret }).log(
        'partner.auth.getPartnerAuthInitialAdapter.getUserByEmail'
      )

      return ret
    },

    async createUser(user) {
      debug(`partner createUser`, { user }).log(
        'partner.auth.getPartnerAuthInitialAdapter.createUser'
      )

      // @note when global logins are allowed, new users can register through
      // the partner portal the same way they would through the default auth
      // flow

      if (partner.auth?.allowGlobalLogin) {
        return defaultAuthAdapter.createUser(user)
      }

      throw new Error(`User creation is not allowed`)
    },

    async updateUser(user) {
      debug(`partner updateUser`, { user }).log(
        'partner.auth.getPartnerAuthInitialAdapter.updateUser'
      )

      const ret: AdapterUser = {
        id: user.id,
        email: user.email as string,
        emailVerified: user.emailVerified ?? null,
      }

      debug(`returning`, { ret }).log(
        'partner.auth.getPartnerAuthInitialAdapter.updateUser'
      )

      return ret
    },

    async deleteUser() {
      debug(`partner deleteUser`).log(
        'partner.auth.getPartnerAuthInitialAdapter.deleteUser'
      )

      throw new Error(`User deletion is not allowed`)
    },

    async createSession(session) {
      debug('partner createSession', { session }).log(
        'partner.auth.getPartnerAuthInitialAdapter.createSession'
      )

      // @note can set the audience here

      const ret = await defaultAuthAdapter.createSession(session)

      debug(`returning`, { ret }).log(
        'partner.auth.getPartnerAuthInitialAdapter.createSession'
      )

      return ret || null
    },

    async updateSession(session) {
      debug('partner updateSession', { session }).log(
        'partner.auth.getPartnerAuthInitialAdapter.updateSession'
      )

      // @note can set the audience here

      const ret = await defaultAuthAdapter.updateSession(session)

      debug(`returning`, { ret }).log(
        'partner.auth.getPartnerAuthInitialAdapter.updateSession'
      )

      return ret || null
    },

    async deleteSession(sessionToken) {
      debug('partner deleteSession', { sessionToken }).log(
        'partner.auth.getPartnerAuthInitialAdapter.deleteSession'
      )

      const ret = await defaultAuthAdapter.deleteSession(sessionToken)

      debug(`returning`, { ret }).log(
        'partner.auth.getPartnerAuthInitialAdapter.deleteSession'
      )

      return ret || null
    },

    async getSessionAndUser(sessionToken) {
      debug(`partner getSessionAndUser`, { sessionToken }).log(
        'partner.auth.getPartnerAuthInitialAdapter.getSessionAndUser'
      )

      const ret = await defaultAuthAdapter.getSessionAndUser(sessionToken)

      debug(`returning`, { ret }).log(
        'partner.auth.getPartnerAuthInitialAdapter.getSessionAndUser'
      )

      return ret
    },

    async createVerificationToken(verificationToken) {
      debug('partner createVerificationToken', { verificationToken }).log(
        'partner.auth.getPartnerAuthInitialAdapter.createVerificationToken'
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
        'partner.auth.getPartnerAuthInitialAdapter.createVerificationToken'
      )

      return ret
    },

    async useVerificationToken(verificationToken) {
      debug('partner useVerificationToken', { verificationToken }).log(
        'partner.auth.getPartnerAuthInitialAdapter.useVerificationToken'
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
        'partner.auth.getPartnerAuthInitialAdapter.useVerificationToken'
      )

      return retToken
    },
  }
}

export async function getPartnerAuthProviders(
  host: string
): Promise<AuthOptions['providers']> {
  debug(`getPartnerAuthProviders`, { host }).log(
    'partner.auth.getPartnerAuthProviders'
  )

  const slug = getPartnerSlugFromHostname(host)

  if (!slug) {
    debug(`partner not found`, { host }).log(
      'partner.auth.getPartnerAuthProviders'
    )

    throw new Error(`Partner not found`)
  }

  const partner = await getPartnerByIdentifier(slug)

  if (!partner) {
    debug(`partner not found`, { slug }).log(
      'partner.auth.getPartnerAuthProviders'
    )

    throw new Error(`Partner not found`)
  }

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        url: _url,
        token,
      }: {
        identifier: string
        url: string
        token: string
      }): Promise<void> {
        debug(`partner sendVerificationRequest`, {
          identifier,
          token,
        }).log(
          'partner.auth.getPortalAuthProviders.EmailProvider.sendVerificationRequest'
        )

        const user = await prisma.user.findUnique({
          where: {
            parentId_parentContextEmail: {
              parentId: partner.id,
              parentContextEmail: identifier,
            },
          },
        })

        const resolvedUser =
          user ||
          (partner.auth?.allowGlobalLogin
            ? await prisma.user.findUnique({
                where: {
                  email: identifier,
                },
              })
            : null)

        if (!resolvedUser) {
          if (!partner.auth?.allowGlobalLogin) {
            debug(`user not found`, { identifier }).log(
              'partner.auth.getPortalAuthProviders.EmailProvider.sendVerificationRequest'
            )

            return
          }

          // @note the user does not exist yet - they will be created by createUser
          // on callback. proceed with notification using identifier as stand-in id.
          debug(`no existing user found, proceeding for new global user`, {
            identifier,
          }).log(
            'partner.auth.getPortalAuthProviders.EmailProvider.sendVerificationRequest'
          )
        }

        if (process.env.SKIP_VERIFICATION_REQUEST) {
          log(`skipping verification request`)
        } else {
          const branding: EmailBranding = partnerToEmailBranding(partner)

          // @note a partner that sends as its own identity carries the
          // transport that does it, so there is no vendor to name here. A
          // partner without one falls through to the platform's own email
          // module - see @chatbotkit-dev/partners-spec.

          const transport = partner.email

          try {
            await notifyEmailLogin(
              {
                // @note for new global users resolvedUser is null; use identifier as
                // stand-in id since notifyEmailLogin only logs it, not persists it
                id: resolvedUser?.id ?? identifier,
                ...(resolvedUser ?? {}),

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

export async function getPartnerAuthInitialCallbacks(
  host: string
): Promise<AuthOptions['callbacks']> {
  debug(`getPartnerAuthInitialCallbacks`, { host }).log(
    'partner.auth.getPartnerAuthInitialCallbacks'
  )

  return {
    ...defaultAuthCallbacks,

    async signIn(params) {
      // @note we mute the signIn callback for partners to avoid adding emails
      // to mailing lists and other unwanted behavior

      debug(`partner signIn`, params).log(
        'partner.auth.getPartnerAuthInitialCallbacks'
      )

      const ret = true // @note returning true to simplify the flow

      return ret
    },
  }
}
