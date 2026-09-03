// @note the contract for outbound email. Implementations decide the sending
// identity, the delivery vendor, tracking and suppression behaviour. None of
// that appears here, because none of it is the platform's concern.
//
// There are two kinds of outbound mail and they differ in who the message is
// from, not merely in content:
//
//   notification - the deployment writing to its own user. Sent from the
//                  deployment's identity, so the implementation owns the from
//                  address and the caller only chooses where replies go.
//
//   action       - an agent or integration writing to a third party. The
//                  caller may supply the sending identity, because the message
//                  is from a mailbox the deployment does not own.
//
//   transport    - the deployment writing to its own user, but as an identity it
//                  hosts on someone else's behalf: a whitelabel partner's
//                  domain, a portal's own host. The caller names that identity
//                  and gets something it can send through repeatedly.
//
// They are separate entry points rather than a flag because they usually want
// separate sending domains, reputations and often separate vendors - the
// identity a deployment hosts for a partner is verified wherever that partner's
// domain is verified, which need not be where the deployment's own mail goes.

/**
 * A fully rendered message body. Callers render before handing off.
 */
export interface EmailContent {
  text: string
  html: string
}

/**
 * Mail the deployment sends to its own user.
 */
export interface NotificationEmail {
  to: string
  subject: string

  /**
   * The rendered body, both parts. Callers render before handing off: whether a
   * body is markdown, HTML or plain text is something the caller knows and the
   * provider should not have to guess.
   */
  content: EmailContent

  /**
   * Where replies should go, when this particular message needs them to go
   * somewhere specific.
   *
   * @note omit it and the implementation uses its own reply address. Where a
   * deployment's notifications should be replied to is the implementation's
   * business, not the caller's, so the platform does not carry that address.
   */
  replyTo?: string

  /**
   * Marks mail the user must receive regardless of their subscription
   * preferences: login links, invitations, security notices.
   *
   * @note this is a property of the message, not a delivery setting. An
   * implementation decides what it means - typically suppressing tracking and
   * bypassing list management - but the platform only states that the message
   * is essential.
   */
  essential?: boolean
}

/**
 * Mail an agent or integration sends to a third party.
 */
export interface ActionEmail {
  to: string
  subject: string

  /**
   * The rendered body, both parts. See NotificationEmail.content.
   */
  content: EmailContent

  /**
   * The sending mailbox. Absent means the implementation supplies its own
   * action identity.
   */
  from?: string

  /** Display name for the sending mailbox. */
  name?: string

  replyTo?: string

  /**
   * Threads the message against an existing conversation, for replies to
   * inbound mail.
   */
  messageId?: string
}

/**
 * A fully rendered message, ready to deliver. See NotificationEmail.content for
 * why both parts are the caller's job.
 */
export interface EmailTransportMessage {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Delivers mail sent as one particular identity, which was fixed when the
 * transport was created.
 */
export interface EmailTransport {
  send(message: EmailTransportMessage): Promise<void>
}

/**
 * An attachment carried by an inbound message, already extracted from the
 * vendor's payload format.
 */
export interface InboundEmailAttachment {
  name: string
  size: number
  type: string
  data: ArrayBuffer
}

/**
 * An inbound message addressed to an email integration, normalized out of
 * whatever payload format the implementation's inbound vendor delivers.
 */
export interface InboundEmail {
  /**
   * The integration whose inbox received the message - the implementation
   * recognizes its own integration addresses and extracts the id.
   */
  integrationId: string

  /** The integration inbox address the message arrived on. */
  to: string

  fromName?: string
  fromEmail: string

  subject: string

  text?: string
  html?: string

  /** Raw transport headers, for message-id / in-reply-to threading. */
  headers?: string

  senderIp?: string

  attachments: InboundEmailAttachment[]
}

export interface EmailProvider {
  sendEmailNotification(email: NotificationEmail): Promise<void>
  sendEmailAction(email: ActionEmail): Promise<void>

  /**
   * Composes the inbox address of an email integration. This is sending
   * identity, so the implementation owns the address scheme: the hosted
   * domain, the routing, and the inbound recognition are all its business.
   * Implementations without a hosted domain derive a deterministic address
   * from the deployment's site URL.
   */
  formatIntegrationInbox(integrationId: string): string

  /**
   * Mints a fresh RFC 5322 message-id for mail sent from an integration
   * inbox. Sending identity again: the id-right part is the implementation's
   * domain. The caller keeps the value for reply threading (replies echo it
   * in In-Reply-To), which is why it is minted up front rather than by the
   * delivery vendor.
   */
  formatIntegrationMessageId(integrationId: string): string

  /**
   * Parses an inbound-mail webhook payload into a normalized message, or
   * returns null when the payload is not recognized or is not addressed to
   * an integration inbox. The payload format belongs to whichever inbound
   * vendor the implementation uses - the application never sees it. An
   * implementation without inbound delivery logs and returns null.
   */
  parseInboundEmail(form: FormData): Promise<InboundEmail | null>

  /**
   * Creates a transport that sends as `source`, a full RFC 5322 address such as
   * `Login <notifications@example.com>`.
   *
   * @note this is how a deployment sends as an identity it hosts for someone
   * else - a whitelabel partner, a portal on its own domain. Neither of the two
   * functions above fits: a notification comes from the deployment's own
   * identity, and an action comes from a mailbox the deployment does not own at
   * all. Here the deployment does own the mail, but not the name on it.
   *
   * The sending domain has to be verified with whichever vendor the
   * implementation delivers through, and which vendor that is - along with the
   * credential it needs - is the implementation's business. Callers hold the
   * returned transport and call `send`.
   */
  createEmailTransport(source: string): EmailTransport

  /**
   * Throws when this provider is not usable with the current configuration.
   *
   * @note an implementation resolves its own configuration lazily, so nothing
   * that merely imports it needs that configuration present. This is how a
   * deployment gets the guarantee back: it calls this where its environment is
   * loaded - in its test suite or at startup - and finds out then rather than
   * when a user fails to receive a login link.
   *
   * An implementation needing no configuration should resolve.
   */
  assertConfigured(): Promise<void>
}
