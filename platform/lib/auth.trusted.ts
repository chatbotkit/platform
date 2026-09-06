import type { AuthOptions } from 'next-auth'
import _EmailProvider from 'next-auth/providers/email'
import type EmailProviderType from 'next-auth/providers/email'

import { ONE_MINUTE_IN_SECONDS } from '@chatbotkit-dev/time'

import { TRUSTED_SIGNIN_PROVIDER_ID } from '@/lib/auth.trusted.consts'
import { getContextNextApiRequest } from '@/lib/context.store'
import { log } from '@/lib/debug'

import { z } from 'zod'

export { TRUSTED_SIGNIN_PROVIDER_ID }

// @todo come up with better types
// @ts-ignore
const EmailProvider = _EmailProvider as typeof EmailProviderType

/**
 * Trusted sign-in: an opt-in NextAuth provider where entering an email
 * address signs the visitor straight into that account, creating it on first
 * use, with no code and no password. Anyone who can reach the deployment can
 * sign in as anyone, so it exists for single-user and private installs - a
 * desktop build, a laptop, a lab box - and must never be enabled on a shared
 * deployment.
 *
 * The gate fails closed and fails loud. It is enabled only by the literal
 * `NEXTAUTH_TRUSTED_SIGNIN=true`; any other nonempty value is an error, as
 * is enabling it while `TARGET_ENV` names a hosted
 * environment or while any credential of a shared deployment is configured.
 * The check runs at boot, so an environment that carries the flag by mistake
 * refuses to start with a named error instead of opening every account.
 *
 * It is an email-type provider, so NextAuth runs its ordinary verified-code
 * flow end to end - adapter, sign-in callback, audit log, database session,
 * session cookie - the only difference being that the browser supplies a
 * fresh token for each attempt instead of receiving a code by mail. Knowing
 * this token is not proof of email ownership in trusted mode.
 */

const HOSTED_TARGET_ENVS = ['production', 'staging']

// @note credentials that only a deployment facing other people configures -
// any one of them present means this is not a single-user install
const SHARED_DEPLOYMENT_KEYS = [
  'NEXTAUTH_GOOGLE_APP_ID',
  'NEXTAUTH_AZURE_AD_CLIENT_ID',
  'NEXTAUTH_GITHUB_APP_ID',
  'LIMITS_CONFIG',
]

const envSchema = z
  .object({
    NEXTAUTH_TRUSTED_SIGNIN: z
      .union([
        z.literal('true').transform(() => true),
        z.literal('').transform(() => false),
      ])
      .optional(),
    TARGET_ENV: z.string().optional(),
    sharedDeploymentKeys: z.array(z.string()),
  })
  .refine(
    ({ NEXTAUTH_TRUSTED_SIGNIN, TARGET_ENV }) =>
      NEXTAUTH_TRUSTED_SIGNIN !== true ||
      !HOSTED_TARGET_ENVS.includes(TARGET_ENV ?? ''),
    {
      message: `NEXTAUTH_TRUSTED_SIGNIN must not be set when TARGET_ENV is ${HOSTED_TARGET_ENVS.join(
        ' or '
      )}: trusted sign-in lets anyone sign in as anyone`,
      path: ['NEXTAUTH_TRUSTED_SIGNIN'],
    }
  )
  .refine(
    ({ NEXTAUTH_TRUSTED_SIGNIN, sharedDeploymentKeys }) =>
      NEXTAUTH_TRUSTED_SIGNIN !== true || sharedDeploymentKeys.length === 0,
    ({ sharedDeploymentKeys }) => ({
      message: `NEXTAUTH_TRUSTED_SIGNIN must not be set alongside ${sharedDeploymentKeys.join(
        ', '
      )}: those belong to a deployment other people sign in to, and trusted sign-in lets anyone sign in as anyone`,
      path: ['NEXTAUTH_TRUSTED_SIGNIN'],
    })
  )

let parsed: z.infer<typeof envSchema> | undefined

/**
 * Parses the trusted sign-in configuration, throwing a named error for every
 * combination that must never reach a shared deployment. Called at boot from
 * instrumentation.ts so a misconfigured process refuses to start, and again
 * lazily by everything below.
 *
 * @throws {z.ZodError} when the variable is malformed or set where it must not be
 */
export function assertTrustedSigninEnv(): void {
  parsed = envSchema.parse({
    NEXTAUTH_TRUSTED_SIGNIN: process.env.NEXTAUTH_TRUSTED_SIGNIN,
    TARGET_ENV: process.env.TARGET_ENV,
    sharedDeploymentKeys: SHARED_DEPLOYMENT_KEYS.filter(
      (key) => process.env[key]
    ),
  })
}

/**
 * Whether trusted sign-in is enabled for this deployment.
 */
export function isTrustedSigninEnabled(): boolean {
  if (!parsed) {
    assertTrustedSigninEnv()
  }

  return parsed?.NEXTAUTH_TRUSTED_SIGNIN === true
}

/**
 * The trusted provider, or nothing when trusted sign-in is off.
 */
export function getTrustedProviders(): AuthOptions['providers'] {
  if (!isTrustedSigninEnabled()) {
    return []
  }

  // @note next-auth honours a custom `id` at runtime (it is merged from
  // `options`) but its EmailUserConfig typing does not declare one
  const config = {
    id: TRUSTED_SIGNIN_PROVIDER_ID,
    name: 'Trusted',

    // @note the token only has to survive the form's immediate second step
    maxAge: ONE_MINUTE_IN_SECONDS,

    async generateVerificationToken(): Promise<string> {
      // @note verification tokens are globally unique in the database; the
      // browser reuses this attempt's UUID in the callback, so abandoned
      // attempts for other addresses cannot collide with it
      return z
        .string()
        .uuid()
        .parse(getContextNextApiRequest()?.body?.trustedToken)
    },

    async sendVerificationRequest({
      identifier,
    }: {
      identifier: string
    }): Promise<void> {
      log(`trusted sign-in`, { identifier })
    },
  }

  return [EmailProvider(config)]
}
