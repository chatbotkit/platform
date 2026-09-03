import type {
  ActionEmail,
  EmailProvider,
  EmailTransport,
  InboundEmail,
  NotificationEmail,
} from '@chatbotkit-dev/email-spec'

export type * from '@chatbotkit-dev/email-spec'

// @note the community implementation does not deliver mail. It writes what it
// would have sent to the console, text body included, so a deployment runs and
// stays usable without an email vendor configured - the console IS delivery
// here: sign-in codes and invitations reach the operator nowhere else. Replace
// this package to deliver for real (and to keep bodies out of logs).

// @note the body is framed with an open left rail rather than a closed box:
// every line stands alone, so long URLs never break the frame and per-line
// log timestamps do not mangle it
function describe(
  kind: string,
  email: { to: string; subject: string },
  text: string
): void {
  const rule = '─'.repeat(50)

  const body = text
    .trim()
    .split('\n')
    .map((line) => `│ ${line}`)
    .join('\n')

  // eslint-disable-next-line no-console
  console.log(
    `[email:${kind}] to=${email.to} subject=${JSON.stringify(email.subject)} (not delivered: no email provider configured)\n┌${rule}\n${body}\n└${rule}`
  )
}

export async function sendEmailNotification(
  email: NotificationEmail
): Promise<void> {
  describe('notification', email, email.content.text)
}

export async function sendEmailAction(email: ActionEmail): Promise<void> {
  describe('action', email, email.content.text)
}

/**
 * @note the community implementation delivers nothing, so a transport is the
 * same console line as anything else - with the identity it would have sent as,
 * because that is the whole point of asking for one.
 */
export function createEmailTransport(source: string): EmailTransport {
  return {
    async send({ to, subject, text }) {
      describe(`transport from=${source}`, { to, subject }, text)
    },
  }
}

/**
 * @note the community provider needs no configuration, so there is nothing that
 * can be misconfigured.
 */
export async function assertConfigured(): Promise<void> {
  // pass
}

// @note the community implementation hosts no sending domain, so integration
// inboxes derive deterministically from the deployment's site URL - the
// address scheme an operator routes when they configure real email
function integrationHostname(): string {
  try {
    return new URL(process.env.SITE_URL ?? '').hostname || 'localhost'
  } catch {
    return 'localhost'
  }
}

export function formatIntegrationInbox(integrationId: string): string {
  return `${integrationId}@integration.${integrationHostname()}`
}

export function formatIntegrationMessageId(_integrationId: string): string {
  return `<${crypto.randomUUID()}@integration.${integrationHostname()}>`
}

// @note no inbound vendor means no inbound mail - describe and decline, the
// same posture as outbound delivery above
export async function parseInboundEmail(
  _form: FormData
): Promise<InboundEmail | null> {
  // eslint-disable-next-line no-console
  console.log(
    '[email:inbound] inbound message ignored (not parsed: no email provider configured)'
  )

  return null
}

const provider: EmailProvider = {
  sendEmailNotification,
  sendEmailAction,
  createEmailTransport,
  assertConfigured,
  formatIntegrationInbox,
  formatIntegrationMessageId,
  parseInboundEmail,
}

export default provider
