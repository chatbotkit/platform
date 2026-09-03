// @note the sending identity and the one message shape every vendor module
// delivers. Credentials live with their vendor; the from and reply-to
// addresses are shared because a verified sending domain is a property of the
// deployment, not of whichever API delivers for it.

/**
 * A rendered message with its sending identity resolved, ready for a vendor.
 */
export interface OutboundMessage {
  /** RFC 5322 address, `Name <mailbox@example.com>` or bare. */
  from: string
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
  messageId?: string

  /**
   * Must reach the recipient regardless of subscription state, and carries no
   * tracking: essential notifications and all third-party action mail, whose
   * recipient never subscribed to anything. Vendors without list management
   * have nothing to do here.
   */
  essential?: boolean
}

export interface Address {
  name?: string
  email: string
}

export function parseAddress(source: string): Address {
  const match = source.match(/^\s*(?:"?(.*?)"?\s*)?<([^<>]+)>\s*$/)

  if (!match) {
    return { email: source.trim() }
  }

  const name = match[1]?.trim()

  return { ...(name ? { name } : null), email: match[2].trim() }
}

export function formatAddress({ name, email }: Address): string {
  return name ? `${name} <${email}>` : email
}

/**
 * Headers that thread a message against the id the platform minted for it.
 */
export function threadingHeaders(messageId: string): Record<string, string> {
  return {
    'Message-ID': messageId,
    'In-Reply-To': messageId,
    References: messageId,
  }
}

/**
 * The address this deployment's own mail is sent from.
 *
 * @throws {Error} when `EMAIL_FROM` is not set.
 */
export function notificationFrom(): string {
  const from = process.env.EMAIL_FROM

  if (!from) {
    throw new Error(
      'EMAIL_FROM is not set, so there is no address to send this ' +
        "deployment's mail from. Set it to a sender the email vendor has " +
        'verified, e.g. "Login <noreply@example.com>".'
    )
  }

  return from
}

/**
 * The default mailbox agents and integrations write from.
 *
 * @throws {Error} when neither `EMAIL_ACTIONS_FROM` nor `EMAIL_FROM` is set.
 */
export function actionFrom(): string {
  return process.env.EMAIL_ACTIONS_FROM || notificationFrom()
}

export function defaultReplyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO || undefined
}
