import type { AuthOptions } from 'next-auth'
import _AzureADProvider from 'next-auth/providers/azure-ad'
import type AzureADProviderType from 'next-auth/providers/azure-ad'
import _EmailProvider from 'next-auth/providers/email'
import type EmailProviderType from 'next-auth/providers/email'
import _GithubProvider from 'next-auth/providers/github'
import type GithubProviderType from 'next-auth/providers/github'
import _GoogleProvider from 'next-auth/providers/google'
import type GoogleProviderType from 'next-auth/providers/google'

import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import debug, { log } from '@/lib/debug'
import { isAllowedEmail } from '@/lib/email.validation'
import { isDevelopment } from '@/lib/env'
import { notifyEmailLogin } from '@/lib/notify'
import { generateRandomHex } from '@/lib/webcrypto'

// @todo come up with better types
// @ts-ignore
const EmailProvider = _EmailProvider as typeof EmailProviderType

// @todo come up with better types
// @ts-ignore
const GithubProvider = _GithubProvider as typeof GithubProviderType

// @todo come up with better types
// @ts-ignore
const GoogleProvider = _GoogleProvider as typeof GoogleProviderType

// @todo come up with better types
// @ts-ignore
const AzureADProvider = _AzureADProvider as typeof AzureADProviderType

export const providers: AuthOptions['providers'] = [
  // Optionally setup Google provider.

  ...(process.env.NEXTAUTH_GOOGLE_APP_ID &&
  process.env.NEXTAUTH_GOOGLE_APP_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.NEXTAUTH_GOOGLE_APP_ID,
          clientSecret: process.env.NEXTAUTH_GOOGLE_APP_SECRET,
        }),
      ]
    : []),

  // Optionally setup Azure AD provider.

  ...(process.env.NEXTAUTH_AZURE_AD_CLIENT_ID &&
  process.env.NEXTAUTH_AZURE_AD_CLIENT_SECRET &&
  process.env.NEXTAUTH_AZURE_AD_TENANT_ID
    ? [
        AzureADProvider({
          clientId: process.env.NEXTAUTH_AZURE_AD_CLIENT_ID,
          clientSecret: process.env.NEXTAUTH_AZURE_AD_CLIENT_SECRET,
          tenantId: process.env.NEXTAUTH_AZURE_AD_TENANT_ID,
        }),
      ]
    : []),

  // Optionally setup Github provider.

  ...(process.env.NEXTAUTH_GITHUB_APP_ID &&
  process.env.NEXTAUTH_GITHUB_APP_SECRET
    ? [
        GithubProvider({
          clientId: process.env.NEXTAUTH_GITHUB_APP_ID,
          clientSecret: process.env.NEXTAUTH_GITHUB_APP_SECRET,
        }),
      ]
    : []),

  // The email provider is default and it is required for the app to work even
  // when no other providers are configured.

  EmailProvider({
    maxAge: QUARTER_HOUR_IN_SECONDS, // token age in seconds

    async generateVerificationToken(): Promise<string> {
      debug(`generateVerificationToken`).log(
        'auth.providers.EmailProvider.generateVerificationToken'
      )

      return generateRandomHex(6)
    },

    async sendVerificationRequest({
      identifier,
      token,
    }: {
      identifier: string
      url: string
      token: string
    }): Promise<void> {
      debug(`sendVerificationRequest`, { identifier, token }).log(
        'auth.providers.EmailProvider.sendVerificationRequest'
      )

      // @note never email a sign-in code to a disallowed address (blacklisted /
      // disposable domain, throwaway-looking local part). Beyond blocking the
      // account, this stops wasted sends and protects our sender reputation -
      // mailing disposable/bouncing domains hurts deliverability for everyone.

      if (!(await isAllowedEmail(identifier))) {
        log(`skipping verification request for disallowed email`, {
          identifier,
        })

        return
      }

      const user = await prisma.user.findUnique({
        where: {
          email: identifier,
        },
      })

      if (isDevelopment) {
        log(`login token`, { token })
      }

      if (process.env.SKIP_VERIFICATION_REQUEST) {
        log(`skipping verification request`)
      } else {
        await notifyEmailLogin(user || { id: identifier, email: identifier }, {
          token,
        })
      }
    },
  }),
]

export default providers
