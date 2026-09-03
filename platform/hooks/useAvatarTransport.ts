import { useCallback, useEffect, useMemo } from 'react'

export const AVATAR_MESSAGE_MIC_CONTROL = 'chatbotkit:mic-control'
export const AVATAR_MESSAGE_INTERRUPT = 'chatbotkit:interrupt'
export const AVATAR_MESSAGE_USER_MESSAGE = 'chatbotkit:user-message'

type AvatarMessageBase = {
  source?: string
}

export type AvatarParticipant = {
  name?: string
  [key: string]: unknown
}

export type AvatarMicControlMessage = AvatarMessageBase & {
  type: typeof AVATAR_MESSAGE_MIC_CONTROL
  muted: boolean
}

export type AvatarInterruptMessage = AvatarMessageBase & {
  type: typeof AVATAR_MESSAGE_INTERRUPT
  reason?: string
  participantId?: string
  previousParticipantId?: string
}

export type AvatarUserMessage = AvatarMessageBase & {
  type: typeof AVATAR_MESSAGE_USER_MESSAGE
  text: string
  participant?: AvatarParticipant
}

export type AvatarMessage =
  | AvatarMicControlMessage
  | AvatarInterruptMessage
  | AvatarUserMessage

type AvatarTransportOptions = {
  disabled?: boolean
  onInterrupt?: (message: AvatarInterruptMessage, event: MessageEvent) => void
  onMicControl?: (message: AvatarMicControlMessage, event: MessageEvent) => void
  onUserMessage?: (message: AvatarUserMessage, event: MessageEvent) => void
  source?: string
  targetOrigin?: string
  targetWindow?: () => Window | null | undefined
}

type SendInterruptOptions = Omit<AvatarInterruptMessage, 'source' | 'type'>

type SendMicControlOptions = Omit<AvatarMicControlMessage, 'source' | 'type'>

type SendUserMessageOptions = Omit<
  AvatarUserMessage,
  'participant' | 'source' | 'type'
> & {
  participant?: AvatarParticipant
  participantName?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAvatarMicControlMessage(
  message: unknown
): message is AvatarMicControlMessage {
  return isObject(message) && message.type === AVATAR_MESSAGE_MIC_CONTROL
}

function isAvatarInterruptMessage(
  message: unknown
): message is AvatarInterruptMessage {
  return isObject(message) && message.type === AVATAR_MESSAGE_INTERRUPT
}

function isAvatarUserMessage(message: unknown): message is AvatarUserMessage {
  return isObject(message) && message.type === AVATAR_MESSAGE_USER_MESSAGE
}

export default function useAvatarTransport({
  disabled = false,
  onInterrupt,
  onMicControl,
  onUserMessage,
  source = 'avatar-transport',
  targetOrigin = '*',
  targetWindow,
}: AvatarTransportOptions = {}) {
  const send = useCallback(
    (message: AvatarMessage) => {
      if (disabled || !targetWindow) {
        return false
      }

      const target = targetWindow()

      if (!target) {
        return false
      }

      try {
        target.postMessage(message, targetOrigin)

        return true
      } catch {
        return false
      }
    },
    [disabled, targetOrigin, targetWindow]
  )

  const sendInterrupt = useCallback(
    (message: SendInterruptOptions = {}) =>
      send({
        ...message,
        source,
        type: AVATAR_MESSAGE_INTERRUPT,
      }),
    [send, source]
  )

  const sendMicControl = useCallback(
    ({ muted }: SendMicControlOptions) =>
      send({
        muted,
        source,
        type: AVATAR_MESSAGE_MIC_CONTROL,
      }),
    [send, source]
  )

  const sendUserMessage = useCallback(
    ({ participant, participantName, text }: SendUserMessageOptions) =>
      send({
        participant:
          participant ||
          (participantName
            ? {
                name: participantName,
              }
            : undefined),
        source,
        text,
        type: AVATAR_MESSAGE_USER_MESSAGE,
      }),
    [send, source]
  )

  useEffect(() => {
    if (disabled || (!onInterrupt && !onMicControl && !onUserMessage)) {
      return
    }

    function handleMessage(event: MessageEvent) {
      const message = event.data

      if (isAvatarMicControlMessage(message)) {
        onMicControl?.(message, event)
      } else if (isAvatarInterruptMessage(message)) {
        onInterrupt?.(message, event)
      } else if (isAvatarUserMessage(message)) {
        onUserMessage?.(message, event)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [disabled, onInterrupt, onMicControl, onUserMessage])

  return useMemo(
    () => ({
      send,
      sendInterrupt,
      sendMicControl,
      sendUserMessage,
    }),
    [send, sendInterrupt, sendMicControl, sendUserMessage]
  )
}
