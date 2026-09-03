import { useMemo, useRef } from 'react'

import { splitBubbleText, splitStackText } from '@/lib/md.chat'
import { equal } from '@/lib/object'

import useConversationManager from '@/hooks/useConversationManager'

/**
 * Building upon the useConversationManager hook, this hook splits the incoming
 * and received messages into smaller parts if bubble option is enabled.
 *
 * @param {{
 *   stream?: boolean,
 *   bubble?: boolean,
 *   emitCompleteFencedCodeBlocks?: Parameter<typeof splitStackText>[1]['emitCompleteFencedCodeBlocks'],
 *   emitCompleteAnchors?: Parameter<typeof splitStackText>[1]['emitCompleteAnchors'],
 *   emitCompleteImages?: Parameter<typeof splitStackText>[1]['emitCompleteImages'],
 * } & Parameter<typeof useConversationManager>[0]} options
 */
export default function useConversationManager2({
  stream = false,

  bubble = false,

  emitCompleteFencedCodeBlocks = false,
  emitCompleteAnchors = false,
  emitCompleteImages = false,

  ...options
}) {
  const {
    receivedMessages: rms,
    incomingMessage: im,

    ...rest
  } = useConversationManager({
    ...options,

    // In this version of the hook, we change the semantics of what we mean by
    // streaming. Fundamentally, we always stream the server messages, but we
    // only update the incomingMessage if the stream option is true.

    stream: true,
  })

  const previousReceivedMessagesRef = useRef(rms)
  const previousIncomingMessageRef = useRef(im)

  const [receivedMessages, incomingMessage] = useMemo(() => {
    let receivedMessages = rms
    let incomingMessage = im

    if (bubble) {
      receivedMessages = receivedMessages.flatMap((message, messageIndex) => {
        if (message.type === 'bot') {
          const texts = splitBubbleText(message.text)

          return texts.map((text, textIndex) => {
            const isLast = textIndex === texts.length - 1

            // Every message carries the original id.

            const originalMessageId = message.id

            // The last message carries the original id.

            const id = isLast
              ? message.id
              : `sub/${message.id || messageIndex}/${textIndex}`

            // The last message carries the original meta.

            const meta = isLast ? message.meta : undefined

            // The last message carries the original micro.

            const micro = isLast ? message.micro : undefined

            // The last message carries the original extra.

            const extra = isLast ? message.extra : undefined

            // The last message carries the original actions.

            const actions = isLast ? message.actions : undefined

            // The last message carries the original references.

            const references = isLast ? message.references : undefined

            // The last message carries the original attachments.

            const attachments = isLast ? message.attachments : undefined

            return {
              ...message,

              originalMessageId,
              id,
              text,
              meta,
              micro,
              extra,
              actions,
              references,
              attachments,
            }
          })
        } else {
          return message
        }
      })

      if (incomingMessage) {
        const texts = splitBubbleText(incomingMessage.text)

        const lastText = texts.pop()

        if (texts.length) {
          receivedMessages = receivedMessages.concat(
            texts.map((text, index) => ({
              ...incomingMessage,

              originalMessageId: incomingMessage.id,

              id: `inc/${incomingMessage.id}/${index}`,

              text: text,

              sequenceMessageId: `seq/${index}`,
            }))
          )
        }

        if (lastText) {
          incomingMessage = {
            ...incomingMessage,

            text: lastText,

            sequenceMessageId: `seq/${texts.length}`,
          }
        }
      }
    }

    if (stream) {
      if (incomingMessage) {
        const text = splitStackText(incomingMessage.text, {
          emitCompleteFencedCodeBlocks,
          emitCompleteAnchors,
          emitCompleteImages,
        }).join('\n\n')

        if (incomingMessage.text !== text) {
          incomingMessage = {
            ...incomingMessage,

            text,
          }
        }
      }
    }

    if (
      receivedMessages.length === previousReceivedMessagesRef.current.length
    ) {
      receivedMessages = previousReceivedMessagesRef.current
    }

    if (equal(incomingMessage, previousIncomingMessageRef.current || {})) {
      incomingMessage = previousIncomingMessageRef.current
    }

    return [receivedMessages, incomingMessage]
  }, [
    stream,
    bubble,

    emitCompleteFencedCodeBlocks,
    emitCompleteAnchors,
    emitCompleteImages,

    rms,
    im,
  ])

  previousReceivedMessagesRef.current = receivedMessages
  previousIncomingMessageRef.current = incomingMessage

  return {
    receivedMessages,
    incomingMessage,

    ...rest,
  }
}
