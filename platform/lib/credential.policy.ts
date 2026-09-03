/**
 * The credential-output policy: how every credential column in `schema.prisma`
 * is allowed to leave the platform through fetch, list, GraphQL and page-data
 * surfaces.
 *
 * Classes:
 *
 * - `never`: not returned by any read surface. Written once (create/update),
 *   used only server-side.
 * - `one-time`: returned exactly once, from the create call that minted it,
 *   and never again.
 * - `masked`: read surfaces return `MASK_SENTINEL` when the column is set and
 *   `null` otherwise; update accepts the sentinel as "keep the stored value".
 *   See `credential.mask.ts`.
 * - `reveal`: returned in clear to the owning session. Only justified when
 *   the user has to copy the value into another system (a webhook secret
 *   pasted into GitHub, a verify token pasted into Meta, a bearer token for
 *   an MCP client), so masking would make the feature unusable.
 *
 * A credential column is any column in `credential.policy.utest.js`'s
 * `CREDENTIAL_COLUMN_NAMES` list with a `String` type, plus the
 * credential-bearing JSON columns listed explicitly there (`Secret.config`).
 * That test parses `schema.prisma` and fails when a credential column has no
 * entry here or an entry here names a column that no longer exists - so a new
 * credential column cannot ship without a classification.
 *
 * Surfaces are enforced where the data leaves: the REST `fetch`/`list` routes
 * (and their `update` counterpart for the sentinel), the GraphQL object field
 * resolvers, and `getServerSideProps` for the few pages that read credential
 * columns directly.
 */

import type { Prisma as PrismaTypes } from '@chatbotkit-dev/db/client'

export type CredentialPolicy = 'never' | 'one-time' | 'masked' | 'reveal'

/**
 * Shape of the policy table. Keys are Prisma model names; each value maps
 * that model's own scalar columns to a policy. Typed against the generated
 * client (`Prisma.TypeMap`) so that renaming or removing a column in
 * `schema.prisma` breaks compilation here - the same binding
 * `prisma/encryption.ts` uses for `ENCRYPTED_FIELDS`. The runtime
 * completeness check (every credential column has an entry) is
 * `credential.policy.utest.js`.
 */
export type CredentialPolicyMap = {
  readonly [M in PrismaTypes.ModelName]?: Partial<
    Readonly<
      Record<
        keyof PrismaTypes.TypeMap['model'][M]['payload']['scalars'],
        CredentialPolicy
      >
    >
  >
}

export const CREDENTIAL_POLICY = {
    // next-auth provider tokens - server-side sign-in only
    Account: {
      access_token: 'never',
      refresh_token: 'never',
      id_token: 'never',
    },

    // next-auth email verification - consumed by the sign-in link
    VerificationToken: {
      token: 'never',
    },

    // identity provider client secret configured by the user for MCP auth -
    // masked on fetch (every audience), never on list
    OAuthConnection: {
      clientSecret: 'masked',
    },

    // CBK's own OAuth server - platform-registered applications, checked
    // in `oauth.server.js`; no user-facing read surface exists
    OAuthApplication: {
      clientSecret: 'never',
    },

    // issued by the token endpoint per the OAuth protocol and never listed
    // again (`pages/oauth/applications/tokens` shows expiry only)
    OAuthApplicationToken: {
      accessToken: 'one-time',
      refreshToken: 'one-time',
    },

    // user-defined secret store. `value` is omitted by every REST/GraphQL
    // read (verify/authenticate report status instead) and revealed only on
    // the owner's `/secrets/[secretId]` page, where the user edits it in
    // place. `config` is a JSON column whose `clientSecret` key is masked -
    // see `SECRET_CONFIG_CREDENTIAL_KEYS`.
    Secret: {
      value: 'reveal',
      config: 'masked',
    },

    // per-user values of personal secrets - written by the OAuth callback,
    // read only by the ability runtime
    SecretValue: {
      value: 'never',
    },

    // the caller must present it to hit the trigger, so the owner can read it
    TriggerIntegration: {
      secret: 'reveal',
    },

    SlackIntegration: {
      signingSecret: 'masked',
      botToken: 'masked',
      userToken: 'masked',
    },

    DiscordIntegration: {
      botToken: 'never',
      publicKey: 'never',
    },

    MicrosoftteamsIntegration: {
      botFrameworkAppSecret: 'never',
    },

    GooglechatIntegration: {
      serviceAccountKey: 'masked',
    },

    // Meta platforms: the verify token is what the user pastes into the Meta
    // webhook configuration, so it stays readable; the app credentials are
    // masked
    WhatsappIntegration: {
      verifyToken: 'reveal',
      accessToken: 'masked',
      appSecret: 'masked',
    },

    MessengerIntegration: {
      verifyToken: 'reveal',
      accessToken: 'masked',
      appSecret: 'masked',
    },

    InstagramIntegration: {
      verifyToken: 'reveal',
      accessToken: 'masked',
      appSecret: 'masked',
    },

    TelegramIntegration: {
      botToken: 'never',
    },

    TwilioIntegration: {
      authToken: 'never',
    },

    AnamIntegration: {
      apiKey: 'never',
    },

    RecallIntegration: {
      apiKey: 'never',
      webhookSecret: 'never',
    },

    // the private key only ever goes to GitHub's API from the server; the
    // webhook secret is what the user pastes into the GitHub App settings
    GithubIntegration: {
      privateKey: 'masked',
      webhookSecret: 'reveal',
    },

    NotionIntegration: {
      token: 'masked',
    },

    // bearer tokens the user configures in their MCP/skill client - revealed
    // on fetch to user-audience sessions only, never on list
    McpserverIntegration: {
      accessToken: 'reveal',
    },

    SkillserverIntegration: {
      accessToken: 'reveal',
    },

    // API keys are shown once by create and never again
    Token: {
      token: 'one-time',
    },

    // outbound webhook secret - no signing scheme consumes it yet, so there is
    // nothing for the user to copy and it stays hidden
    Webhook: {
      secret: 'never',
    },
  } as const satisfies CredentialPolicyMap

/**
 * The columns of `model` classified as `policy`, for routes that want to
 * derive their mask list from the table rather than repeat it.
 */
export function getCredentialColumns<M extends keyof typeof CREDENTIAL_POLICY>(
  model: M,
  policy: CredentialPolicy
): (keyof (typeof CREDENTIAL_POLICY)[M])[] {
  return (
    Object.entries(CREDENTIAL_POLICY[model] || {}) as [
      keyof (typeof CREDENTIAL_POLICY)[M],
      CredentialPolicy,
    ][]
  )
    .filter(([, value]) => value === policy)
    .map(([column]) => column)
}
