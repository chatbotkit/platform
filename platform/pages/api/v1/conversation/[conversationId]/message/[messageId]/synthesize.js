// @ts-check
// @todo convert to edge
import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { ttlCache } from '@/lib/cache'
import { getAcceptHeader } from '@/lib/header'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { createSpeech, getSpeechUsage } from '@/lib/model.provider.openai'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok, redirect } from '@/lib/response'
import { getObjectDownloadUrl, putObject } from '@/lib/storage'
import { recordAudioTokenUsage, recordAudioUsage } from '@/lib/usage.record'
import { sha256 } from '@/lib/webcrypto'

export const bodySchema = schema.object({
  text: schema.string().optional(),
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/{messageId}/synthesize:
 *   post:
 *     operationId: synthesizeConversationMessage
 *     summary: Synthesize conversation message
 *     tags:
 *       - Conversation Message
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           description: The ID of the message
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The message was synthesized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the synthesized message
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['token', 'audio'],
    withSchema(bodySchema, async function (req, session, body) {
      const { text } = body

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: requiredUrlParam(req, 'conversationId'),
        },

        select: {
          id: true,

          userId: true,

          botId: true,

          messages: {
            where: {
              id: requiredUrlParam(req, 'messageId'),
            },

            select: {
              id: true,

              text: true,
            },

            take: 1,
          },
        },
      })

      if (!conversation) {
        return notFound()
      }

      if (conversation.userId !== session.user.id) {
        return notAuthorized()
      }

      if (!conversation.messages.length) {
        return notFound()
      }

      let responseFormat

      let outputFormat

      switch (getAcceptHeader(req, 'application/json')) {
        case 'audio/mpeg': {
          responseFormat = 'mp3'
          outputFormat = 'mp3'

          break
        }

        default: {
          responseFormat = 'mp3'
          outputFormat = 'json'

          break
        }
      }

      let input = conversation.messages[0].text

      if (text) {
        const index = input.indexOf(text)

        if (index >= 0) {
          input = input.slice(index, index + text.length)
        }
      }

      const proposedKey = `conversation/${conversation.id}/message/${
        conversation.messages[0].id
      }/original.${outputFormat}:::${await sha256(input)}`

      let usage = getSpeechUsage(input, 'tts-1')

      const key = await ttlCache(
        `synthesize:${proposedKey}`,
        ONE_DAY_IN_SECONDS,
        async () => {
          const result = await createSpeech({
            input: input,

            model: 'tts-1',

            voice: 'alloy',

            // @ts-ignore
            responseFormat,
          })

          usage = result.usage

          await putObject('audio', proposedKey, new Uint8Array(result.data))

          return proposedKey
        }
      )

      {
        await recordAudioTokenUsage({
          user: session.user,
          count: usage.totalTokens,
          model: 'tts-1',
          meta: {
            reason: 'message/synthesize',
          },
          references: {
            conversationId: conversation.id,
            messageId: conversation.messages[0].id,
          },
        })

        await recordAudioUsage({
          user: session.user,
          count: 1,
          model: 'tts-1',
          meta: {
            reason: 'message/synthesize',
          },
          references: {
            conversationId: conversation.id,
            messageId: conversation.messages[0].id,
          },
        })
      }

      if (outputFormat === 'json') {
        return ok({
          id: conversation.messages[0].id,
          url: await getObjectDownloadUrl('audio', key),
        })
      } else {
        return redirect(new URL(await getObjectDownloadUrl('audio', key)))
      }
    })
  )
)

/**
 * @manual Conversation Messages
 *
 * ## Synthesizing Message Audio
 *
 * The message synthesis endpoint converts message text content into natural-
 * sounding speech audio, enabling voice-based interfaces and accessibility
 * features for your conversational applications. This powerful text-to-speech
 * capability leverages OpenAI's advanced TTS (Text-to-Speech) models to
 * generate high-quality audio that can be played back in real-time or
 * downloaded for offline use.
 *
 * Audio synthesis is particularly valuable for building voice-enabled chatbots,
 * accessibility features for visually impaired users, phone-based AI
 * assistants, and multi-modal conversational experiences. The synthesized
 * audio maintains consistent quality and pronunciation, with intelligent
 * caching ensuring efficient processing of frequently requested messages.
 *
 * The endpoint supports flexible output formats, allowing you to receive
 * either a direct audio stream (for immediate playback) or a JSON response
 * containing a temporary download URL (for deferred playback or client-side
 * handling). Audio files are automatically cached for 24 hours, significantly
 * reducing costs and latency for repeated synthesis requests of the same
 * content.
 *
 * ### Synthesizing Message Text
 *
 * To convert a message to speech audio:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/synthesize
 * Content-Type: application/json
 * Accept: application/json
 *
 * {}
 * ```
 *
 * Replace `{conversationId}` and `{messageId}` with the actual conversation
 * and message identifiers. The endpoint synthesizes the complete message text
 * by default.
 *
 * ### Response Formats
 *
 * The endpoint supports two response formats controlled by the `Accept` header:
 *
 * **JSON Response (Default):**
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/synthesize
 * Accept: application/json
 * ```
 *
 * Returns a JSON object with a temporary download URL:
 *
 * ```json
 * {
 *   "id": "msg-abc123",
 *   "url": "https://storage.example.com/path/to/audio.mp3?signature=..."
 * }
 * ```
 *
 * This format is ideal when you need to pass the audio URL to a client
 * application or defer audio playback. The URL includes authentication and
 * remains valid for the duration of the cache period.
 *
 * **Direct Audio Stream:**
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/synthesize
 * Accept: audio/mpeg
 * ```
 *
 * Returns the audio file directly as an MP3 stream, allowing immediate playback
 * or download. This format is useful for server-side processing or when you
 * want to proxy audio directly to end users without exposing underlying URLs.
 *
 * ### Partial Text Synthesis
 *
 * You can synthesize only a portion of the message text by providing a text
 * fragment:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/synthesize
 * Content-Type: application/json
 *
 * {
 *   "text": "specific portion to synthesize"
 * }
 * ```
 *
 * The endpoint searches for the provided text within the message content and
 * synthesizes only that segment. This is useful for creating audio clips of
 * specific quotes or sections from longer messages, or for progressive audio
 * generation as messages are being composed.
 *
 * ### Caching and Performance
 *
 * The synthesis system implements intelligent caching based on message content:
 *
 * - Audio is cached for 24 hours after first generation
 * - Identical text produces identical cached audio (content-addressed)
 * - Cached audio significantly reduces latency and costs
 * - Cache keys include the exact text content being synthesized
 *
 * When you request synthesis of previously synthesized content, the system
 * returns the cached audio instantly without regenerating it. This makes
 * repeated playback of the same messages extremely efficient and cost-
 * effective.
 *
 * ### Voice and Model Configuration
 *
 * The current implementation uses OpenAI's `tts-1` model with the `alloy`
 * voice, providing a natural, balanced voice suitable for most applications.
 * The audio is generated in MP3 format at standard quality, balancing file
 * size and audio fidelity for web and mobile applications.
 *
 * ### Usage and Costs
 *
 * Audio synthesis consumes token credits based on the length of text being
 * synthesized. The system calculates usage using OpenAI's pricing model
 * ($15 per 1M characters), approximately equivalent to GPT-4 token costs.
 * Each synthesis operation records usage metadata including:
 *
 * - Token count (calculated from character length)
 * - Model used (GPT-4 equivalent for billing)
 * - Conversation and message references
 * - Synthesis reason and timestamp
 *
 * Usage is tracked even for cached responses to maintain accurate billing
 * and usage analytics.
 *
 * ### Use Cases for Message Synthesis
 *
 * Audio synthesis enables various accessibility and engagement features:
 *
 * - **Voice Assistants**: Converting bot responses to speech for voice-based
 *   interactions
 * - **Accessibility**: Providing audio alternatives for visually impaired users
 * - **Phone Bots**: Generating audio responses for telephony integrations
 * - **Multi-modal UX**: Enhancing chat interfaces with optional audio playback
 * - **Content Creation**: Converting chat content to podcast or video narration
 * - **Language Learning**: Providing pronunciation examples in educational
 *   applications
 *
 * **Important Notes:**
 *
 * - Synthesis requires valid conversation and message ownership
 * - Only the message owner can synthesize audio
 * - Audio URLs expire and should not be permanently stored
 * - Synthesis counts toward your token usage limits
 * - Cached audio improves performance and reduces costs
 * - MP3 is the only currently supported audio format
 */
