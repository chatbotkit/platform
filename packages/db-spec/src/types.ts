import { z } from 'zod'

/**
 * SECRET CONFIG
 */
export const SecretConfig = z.union([
  // null
  z.null(),

  // oauth
  z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      authorizationUrl: z.string().url().optional(),
      tokenUrl: z.string().url().optional(),
      revokeUrl: z.string().url().optional(),
      scope: z.string().optional(),
      grantType: z.string().optional(),
    })
    .passthrough(),

  // basic
  z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
    })
    .passthrough(),
])

export type SecretConfigType = z.infer<typeof SecretConfig>

/**
 * PORTAL CONFIG
 */
export const PortalConfig = z
  .object({
    apps: z
      .record(
        z
          .object({
            // @todo add app specific configs here
          })
          .passthrough()
      )
      .optional(),

    groups: z
      .record(
        z
          .object({
            users: z.record(
              z
                .object({
                  // @todo add user specific configs here
                })
                .passthrough()
            ),

            apps: z.record(
              z
                .object({
                  // @todo add app specific configs here
                })
                .passthrough()
            ),
          })
          .passthrough()
      )
      .optional(),

    users: z
      .record(
        z
          .object({
            // @todo add user specific configs here
          })
          .passthrough()
      )
      .optional(),

    auth: z
      .object({
        // @todo add auth specific configs here
      })
      .passthrough()
      .optional(),

    signin: z
      .object({
        title: z.string().optional(),
        headline: z.string().optional(),
      })
      .passthrough()
      .optional(),

    layout: z
      .object({
        header: z
          .union([
            z.boolean(),
            z
              .object({
                // @todo add header specific configs here
              })
              .passthrough(),
          ])
          .optional(),

        footer: z
          .union([
            z.boolean(),
            z
              .object({
                madeWith: z.boolean().optional(),
              })
              .passthrough(),
          ])
          .optional(),

        sidebar: z.union([
          z.boolean(),
          z
            .object({
              title: z.string().optional(),
              logo: z.string().optional(),
              icon: z.string().optional(),
              link: z.string().url().optional(),
            })
            .passthrough()
            .optional(),
        ]),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

export type PortalConfigType = z.infer<typeof PortalConfig>

/**
 * TOKEN CONFIG
 */
export const TokenConfig = z
  .object({
    allowedRoutes: z.array(z.string()).optional(),

    // @note when set, the token is bound to this contact: the session loader
    // propagates it into the session payload so handlers such as
    // conversation/complete attribute interactions to the contact as a hard
    // override. @see @/lib/session.get and @/schemas/contactId
    contactId: z.string().optional(),
  })
  .passthrough()

export type TokenConfigType = z.infer<typeof TokenConfig>

/**
 * POLICY CONFIG
 *
 * Each policy type has its own config shape. The authoritative discriminator is
 * the Policy row's `type` column (so policies can be selected by a real column
 * rather than by querying inside the JSON), which is why `type` is intentionally
 * not duplicated inside the config. The right shape is selected by `type` via
 * `parsePolicyConfig` in `@/lib/policy.config`.
 */

// retention: how long (in days) to keep a conversation before it expires.
export const RetentionPolicyConfig = z.object({
  expiresInDays: z.number().int().positive().optional(),
})

export type RetentionPolicyConfigType = z.infer<typeof RetentionPolicyConfig>

const UsagePolicyEmailRecipient = z.string().email()

const UsagePolicyEmailRecipients = z.array(UsagePolicyEmailRecipient).min(1)

const UsagePolicyEmailAction = z.union([
  z.string().email(),
  UsagePolicyEmailRecipients,
  z.object({
    to: z
      .union([UsagePolicyEmailRecipient, UsagePolicyEmailRecipients])
      .optional(),
  }),
])

// usage: trip one or more actions when a bot's usage of `metric` exceeds
// `threshold` within a rolling `windowInSeconds` window.
export const UsagePolicyConfig = z.object({
  metric: z.enum(['tokens', 'messages', 'conversations']),

  threshold: z.number().int().positive(),

  windowInSeconds: z.number().int().positive(),

  actions: z
    .object({
      // temporarily block the bot for `durationInSeconds`.
      block: z
        .object({
          durationInSeconds: z.number().int().positive(),
        })
        .optional(),

      // send an email notification. A string or array sends to explicit
      // recipients. An object without `to` notifies the policy owner.
      email: UsagePolicyEmailAction.optional(),
    })
    .refine((actions) => !!actions.block || !!actions.email, {
      message:
        'a usage policy must define at least one action (block or email)',
    }),
})

export type UsagePolicyConfigType = z.infer<typeof UsagePolicyConfig>

// @note a plain (non-discriminated) union: with `type` removed from the config
// this only describes the JSON column / provides a soft client-side hint. The
// authoritative validation is `parsePolicyConfig`, which selects by row `type`.
// UsagePolicyConfig must be tried first: zod unions return the first matching
// branch, and RetentionPolicyConfig (all-optional keys, strip mode) matches any
// object and would strip a usage config down to `{}`.
export const PolicyConfig = z.union([UsagePolicyConfig, RetentionPolicyConfig])

export type PolicyConfigType = z.infer<typeof PolicyConfig>

/**
 * USER LIMITS
 */
export const UserLimits = z
  .object({
    tokens: z.number().int().min(0).optional(),
    conversations: z.number().int().min(0).optional(),
    messages: z.number().int().min(0).optional(),
    database: z
      .object({
        datasets: z.number().int().min(0).optional(),
        records: z.number().int().min(0).optional(),
        skillsets: z.number().int().min(0).optional(),
        abilities: z.number().int().min(0).optional(),
        files: z.number().int().min(0).optional(),
      })
      .passthrough()
      .optional(),
    file: z
      .object({
        maxFileSize: z.number().int().min(0).optional(),
      })
      .passthrough()
      .optional(),
    attachment: z
      .object({
        maxFileSize: z.number().int().min(0).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  .nullable()

export type UserLimitsType = z.infer<typeof UserLimits>

/**
 * CONVENIENCE EXPORT
 */
export default z
