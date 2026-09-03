/**
 * The credentials each channel integration needs before it can carry traffic.
 *
 * Cloning strips every one of these - they are all `UNMANAGED_FIELDS` in
 * `blueprint.fields` - so a cloned integration lands credential-less and has
 * to be re-authenticated before anyone can reach the agent through it. Nothing
 * in the product says so today, which is what this table is for.
 *
 * The predicates mirror the install gates the integration pages already use,
 * so the overview and the integration page can never disagree about whether a
 * channel is installed. For example `pages/integrations/slack` keeps showing
 * its "Install to Workspace" button until `signingSecret` and `botToken` are
 * both set - so those are slack's required credentials here.
 */

// @note every field below is asserted to be a real column on its Prisma model
// by `integration.verification.utest.ts`, so a renamed or removed column cannot
// silently turn a credential check into a vacuous `[].every(...) === true`.
export const INTEGRATION_CREDENTIALS: Record<string, string[]> = {
  slack: ['signingSecret', 'botToken'],
  discord: ['appId', 'botToken'],
  telegram: ['botToken'],
  twilio: ['accountSid', 'authToken'],
  microsoftteams: ['botFrameworkAppSecret'],
  whatsapp: ['accessToken'],
  messenger: ['accessToken'],
  instagram: ['accessToken'],
  googlechat: ['serviceAccountKey'],

  // @note widget and email carry no credentials of their own - they are
  // reachable the moment they exist, so they are always configured
  widget: [],
  email: [],
}

/**
 * The prisma selection needed to decide whether an integration is configured.
 * The credentials are read on the server only to derive the status below and
 * are never exposed - see `verification` on the integration GraphQL types.
 */
export function getIntegrationCredentialSelection(
  type: string
): Record<string, boolean> {
  return {
    // @note the id is what the install action links to
    id: true,
    ...Object.fromEntries(
      (INTEGRATION_CREDENTIALS[type] || []).map((field) => [field, true])
    ),
  }
}

/**
 * Whether an integration holds every credential it needs to carry traffic. An
 * integration type with no credentials is configured by existing.
 *
 * @note module private - the graph and the dashboard both want the verification
 * below, not a bare boolean. Keeping this internal is what stops a second,
 * divergent notion of "configured" from growing next to it.
 */
function isIntegrationConfigured(
  type: string,
  row: Record<string, unknown> | null | undefined
): boolean {
  const required = INTEGRATION_CREDENTIALS[type]

  // @note an unknown type has no credential table, so there is nothing to
  // check and nothing to claim - treat it as configured rather than nag about
  // a channel this table does not model
  if (!required) {
    return true
  }

  return required.every((field) => !!row?.[field])
}

/**
 * The flag the install action carries on its url.
 *
 * A user who reaches an integration page through this action has already
 * pressed "Install" once, on the setup checklist they came from. The flag says
 * so, and the page opens its install instructions on arrival rather than asking
 * them to find and press the very same button a second time.
 */
export const INTEGRATION_INSTALL_INTENT_PARAM = 'install'

export type IntegrationVerification = {
  status: 'configured' | 'unconfigured'
  action: { type: 'install'; url: string } | null
}

/**
 * The verification of an integration: whether it can carry traffic, and where
 * to go to fix it when it cannot.
 *
 * Deliberately the same shape as a secret's verification (`SecretVerification`
 * in the graph) - a client asking "does this need authenticating, and how do I
 * authenticate it" gets one answer in one shape whether it holds a secret or
 * an integration. The action carries the install route so callers never have
 * to rebuild it from the type and the id.
 */
export function getIntegrationVerification(
  type: string,
  row: Record<string, unknown> | null | undefined
): IntegrationVerification {
  if (isIntegrationConfigured(type, row)) {
    // @note a configured integration has nothing left to do, so it offers no
    // action - exactly as an authenticated secret does not
    return { status: 'configured', action: null }
  }

  return {
    status: 'unconfigured',
    action: {
      type: 'install',
      url: `/integrations/${type}/${row?.id ?? ''}?${INTEGRATION_INSTALL_INTENT_PARAM}=1`,
    },
  }
}
