import type {
  ActionEmail,
  EmailProvider,
  EmailTransport,
  InboundEmail,
  NotificationEmail,
} from '@chatbotkit-dev/email-spec'

import type { OutboundMessage } from './identity'
import {
  actionFrom,
  defaultReplyTo,
  formatAddress,
  notificationFrom,
  parseAddress,
} from './identity'
import * as print from './print'
import * as resend from './resend'
import * as sendgrid from './sendgrid'
import * as ses from './ses'

export type * from '@chatbotkit-dev/email-spec'

// @note the community email provider picks its delivery vendor from whichever
// credentials are present, and with none present it writes what it would have
// sent to the console so a deployment runs without an email vendor at all.
//
// Detection is by credential, in the order below, and EMAIL_PROVIDER pins one
// when that is not what an operator wants. Everything is resolved at send
// time: nothing that merely imports this package needs any of it configured.

export type EmailVendor = 'print' | 'resend' | 'sendgrid' | 'ses'

interface Vendor {
  isConfigured(): boolean
  assertEnv(): void
  send(message: OutboundMessage): Promise<void>
}

const VENDORS: Record<Exclude<EmailVendor, 'print'>, Vendor> = {
  resend,
  sendgrid,
  ses,
}

/**
 * The vendor mail is currently delivered through.
 *
 * @throws {Error} when `EMAIL_PROVIDER` names something that is not one.
 */
export function detectVendor(): EmailVendor {
  const pinned = process.env.EMAIL_PROVIDER

  if (pinned) {
    if (pinned === 'print' || pinned in VENDORS) {
      return pinned as EmailVendor
    }

    throw new Error(
      `EMAIL_PROVIDER=${JSON.stringify(pinned)} is not one of print, ${Object.keys(VENDORS).join(', ')}`
    )
  }

  for (const [name, vendor] of Object.entries(VENDORS)) {
    if (vendor.isConfigured()) {
      return name as EmailVendor
    }
  }

  return 'print'
}

// @note the message is built only once a vendor is chosen: resolving the
// sending identity throws without one, and printing needs none
async function deliver(
  kind: string,
  preview: { to: string; subject: string; text: string },
  message: () => OutboundMessage
): Promise<void> {
  const vendor = detectVendor()

  if (vendor === 'print') {
    print.describe(kind, preview, preview.text)

    return
  }

  await VENDORS[vendor].send(message())
}

export async function sendEmailNotification(
  email: NotificationEmail
): Promise<void> {
  const { to, subject, content, replyTo, essential = false } = email

  await deliver('notification', { to, subject, text: content.text }, () => ({
    from: notificationFrom(),
    to,
    subject,
    text: content.text,
    html: content.html,

    replyTo: replyTo ?? defaultReplyTo(),

    essential,
  }))
}

export async function sendEmailAction(email: ActionEmail): Promise<void> {
  const { to, subject, content, from, name, replyTo, messageId } = email

  await deliver('action', { to, subject, text: content.text }, () => {
    const base = parseAddress(actionFrom())

    return {
      from: formatAddress({
        name: name || base.name,
        email: from || base.email,
      }),
      to,
      subject,
      text: content.text,
      html: content.html,

      replyTo,
      messageId,

      // @note the recipient never subscribed to anything and must not land on
      // a suppression list by replying
      essential: true,
    }
  })
}

/**
 * @note the vendor is resolved on send, not here. A configuration catalogue
 * constructs transports at import, and nothing that merely imports one should
 * need this deployment's credentials present.
 */
export function createEmailTransport(source: string): EmailTransport {
  return {
    async send({ to, subject, text, html }) {
      await deliver(`transport from=${source}`, { to, subject, text }, () => ({
        from: source,
        to,
        subject,
        text,
        html,
      }))
    },
  }
}

/**
 * @throws {Error} when a vendor is selected but its credentials or the sending
 * identity are incomplete. With no vendor configured there is nothing to
 * check: printing needs nothing.
 */
export async function assertConfigured(): Promise<void> {
  const vendor = detectVendor()

  if (vendor === 'print') {
    return
  }

  VENDORS[vendor].assertEnv()

  notificationFrom()
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

// @note none of the outbound vendors above receives mail for us, so inbound
// mail is described and declined regardless of which one is delivering
export async function parseInboundEmail(
  _form: FormData
): Promise<InboundEmail | null> {
  // eslint-disable-next-line no-console
  console.log(
    '[email:inbound] inbound message ignored (not parsed: this email provider has no inbound vendor)'
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
