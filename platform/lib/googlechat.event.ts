/**
 * Google Chat sends webhook events in one of two shapes depending on how the
 * Chat app was built in the Google Cloud Console:
 *
 * - **Classic Chat app**: `{ type, message, space, user }` at the top level.
 * - **Workspace add-on**: the event type is implied by which `*Payload` key
 *   is present under `chat`; e.g. `chat.messagePayload`, `chat.addedToSpacePayload`.
 *
 * `normaliseChatEventBody` maps the Workspace-add-on shape into the classic
 * shape so downstream code can work with a single representation. Bodies
 * already in the classic shape are returned unchanged.
 */

export type GoogleChatEventType =
  | 'MESSAGE'
  | 'APP_COMMAND'
  | 'ADDED_TO_SPACE'
  | 'REMOVED_FROM_SPACE'
  | 'CARD_CLICKED'

// @note Field shapes are intentionally `any` so callers (including
// @ts-check'd JS modules) can access nested Google Chat structures without
// extensive type assertions. The exact Google Chat payload schema is large
// and well documented by Google; mirroring it here would be churn.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface NormalisedChatEventBody {
  type?: GoogleChatEventType | string
  message?: any
  space?: any
  user?: any
  eventTime?: any
  [key: string]: any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function normaliseChatEventBody(
  body: unknown
): NormalisedChatEventBody {
  if (!body || typeof body !== 'object') {
    return {}
  }

  const b = body as Record<string, unknown>

  if (typeof b.type === 'string' && b.type) {
    return b as NormalisedChatEventBody
  }

  const chat = b.chat as Record<string, unknown> | undefined

  if (!chat || typeof chat !== 'object') {
    return b as NormalisedChatEventBody
  }

  const baseFields = {
    user: chat.user,
    eventTime: chat.eventTime,
  }

  if (chat.messagePayload) {
    const p = chat.messagePayload as Record<string, unknown>

    return {
      type: 'MESSAGE' as const,
      message: p.message,
      space: p.space,
      ...baseFields,
    }
  }

  if (chat.appCommandPayload) {
    const p = chat.appCommandPayload as Record<string, unknown>

    return {
      type: 'APP_COMMAND' as const,
      message: p.message,
      space: p.space,
      appCommandMetadata: p.appCommandMetadata,
      ...baseFields,
    }
  }

  if (chat.addedToSpacePayload) {
    const p = chat.addedToSpacePayload as Record<string, unknown>

    return {
      type: 'ADDED_TO_SPACE' as const,
      space: p.space,
      ...baseFields,
    }
  }

  if (chat.removedFromSpacePayload) {
    const p = chat.removedFromSpacePayload as Record<string, unknown>

    return {
      type: 'REMOVED_FROM_SPACE' as const,
      space: p.space,
      ...baseFields,
    }
  }

  if (chat.buttonClickedPayload || chat.widgetUpdatedPayload) {
    const p = (chat.buttonClickedPayload || chat.widgetUpdatedPayload) as Record<
      string,
      unknown
    >

    return {
      type: 'CARD_CLICKED' as const,
      message: p.message,
      space: p.space,
      ...baseFields,
    }
  }

  return b as NormalisedChatEventBody
}
