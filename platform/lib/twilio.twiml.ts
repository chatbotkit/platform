import debug from '@/lib/debug'
import type { markdownToMessages } from '@/lib/twilio.markdown'

import jstoxml from 'jstoxml'

export function createTwilioSmsResponseXml(
  messages: Awaited<ReturnType<typeof markdownToMessages>>
): string {
  const responseElements = messages
    .map((message) => {
      if (message.type === 'text') {
        return { Message: message.text }
      } else if (message.type === 'image') {
        return { Message: { Media: message.image } }
      }

      return null
    })
    .filter(Boolean)

  const xml = jstoxml.toXML({
    Response: responseElements,
  })

  debug(`created Twilio SMS response XML`, {
    messages,
    xml,
  }).log('integration.twilio.twiml')

  return xml
}

export function createTwilioConversationRelayXml(
  url: string,
  options: {
    ttsLanguage?: string
    ttsProvider?: string
    voice?: string
    reportInputDuringAgentSpeech?: string
    speechTimeout?: string
  } = {}
): string {
  const attrs = Object.fromEntries(
    Object.entries({
      url,
      ...options,
    }).filter(([, value]) => value != null && value !== '')
  )

  const xml = jstoxml.toXML({
    Response: {
      Connect: {
        ConversationRelay: {
          _attrs: attrs,
        },
      },
    },
  })

  debug(`created Twilio Conversation Relay XML`, {
    url,
    options,
    xml,
  }).log('integration.twilio.twiml')

  return xml
}

export function createTwilioDialXml(to: string): string {
  const xml = jstoxml.toXML({
    Response: {
      Dial: to,
    },
  })

  debug(`created Twilio Dial XML`, {
    to,
    xml,
  }).log('integration.twilio.twiml')

  return xml
}
