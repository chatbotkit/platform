// @ts-check
import { buf2str, concatBufs, hex2buf, str2buf } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { getHeader } from '@/lib/header'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  CONFLICT_STATUS,
  NOT_AUTHORIZED_STATUS,
  badRequest,
  conflict,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'

import { sendEvent } from '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue'

import tweetnacl from 'tweetnacl'

// @see https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-types

export const INTERACTION_TYPE_PING = 1
export const INTERACTION_TYPE_APPLICATION_COMMAND = 2

export const RESPONSE_TYPE_PONG = 1
export const RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5

/**
 * We use the re-setup routine to fix common issues.
 *
 * @param {string} discordIntegrationId
 * @returns {Promise<void>}
 */
export async function setup(discordIntegrationId) {
  await sendEvent(discordIntegrationId, {
    type: 'setup',
    payload: {},
  })
}

/**
 * The following method handles all interactions from discord. Keep in mind that
 * the method needs to complete within 3 seconds. This is why we cannot simply
 * generate any response inline. The only way is to return immediately and carry
 * the conversation through a queue.
 *
 * Unfortunately not even a streaming event queue will help in this case. This
 * is because for the stream to continue we need to keep the connection open
 * which does not work well with the notion of returning the response no later
 * than 3 seconds after initiation. This is the also the reason why the queue
 * is not on edge.
 *
 * The only way using streaming queue is to also use qstash which is subject to
 * some delays - so answers will not be instantaneous.
 */
export default withAny(async function (req) {
  const signature = getHeader(req, 'x-signature-ed25519')
  const timestamp = getHeader(req, 'x-signature-timestamp')

  if (typeof signature !== 'string' || typeof timestamp !== 'string') {
    return notAuthorized()
  }

  const discordIntegrationId = requiredUrlParam(req, 'discordIntegrationId')

  const discordIntegration = await prisma.discordIntegration.findUnique({
    where: {
      id: discordIntegrationId,
    },
  })

  if (!discordIntegration) {
    return notFound()
  }

  const { userId, publicKey, ephemeral } = discordIntegration

  if (!publicKey) {
    await logEvent({
      user: { id: userId },
      type: 'integration.discord.configuration.error',
      relations: {
        discordIntegrationId,
      },
      meta: {
        status: CONFLICT_STATUS,
        reason: 'The public key is missing.',
      },
    })

    return conflict()
  }

  const rawBody = await req.arrayBuffer()

  // validate request
  {
    let isVerified

    try {
      isVerified = tweetnacl.sign.detached.verify(
        new Uint8Array(concatBufs(str2buf(timestamp), rawBody)),
        hex2buf(signature),
        hex2buf(publicKey)
      )
    } catch {
      await logEvent({
        user: { id: userId },
        type: 'integration.discord.configuration.error',
        relations: {
          discordIntegrationId,
        },
        meta: {
          status: NOT_AUTHORIZED_STATUS,
          reason: 'There is a signature verification error.',
        },
      })

      return notAuthorized()
    }

    if (!isVerified) {
      await logEvent({
        user: { id: userId },
        type: 'integration.discord.configuration.error',
        relations: {
          discordIntegrationId,
        },
        meta: {
          status: NOT_AUTHORIZED_STATUS,
          reason: 'The signature fails verification.',
        },
      })

      return notAuthorized()
    }
  }

  let payload

  try {
    payload = JSON.parse(buf2str(rawBody))
  } catch {
    await setup(discordIntegrationId)

    return notAuthorized()
  }

  debug(`discord payload`, { payload }).log(
    'integration.discord.discordIntegrationId.interact'
  )

  // @note keep in mind that we can only handle slash commands - not mentions
  // or other types of interactions

  switch (payload.type) {
    case INTERACTION_TYPE_PING: {
      return ok({ type: RESPONSE_TYPE_PONG })
    }

    case INTERACTION_TYPE_APPLICATION_COMMAND: {
      const interactionId = payload.id
      const applicationId = payload.application_id

      // @note in DMs the user is at payload.user; in guilds it is at payload.member.user
      const user = payload.member?.user || payload.user

      const token = payload.token

      const message = payload.data?.options?.find(
        ({ name }) => name === 'message'
      )?.value

      if (!interactionId || !applicationId || !user || !token || !message) {
        return badRequest()
      }

      await sendEvent(discordIntegrationId, {
        type: 'interact',
        payload: {
          interactionId: interactionId,
          applicationId: applicationId,
          userId: user.id,
          username: user.username,
          token: token,
          message: message,
        },
      })

      const data = {}

      if (ephemeral) {
        data.flags = 1 << 6
      }

      return ok({
        type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: data,
      })
    }
  }

  return ok()
})

/**
 * @manual Discord Integration
 * @index 60
 *
 * ## Using the Interaction Webhook
 *
 * The Interactions Endpoint URL is the webhook that Discord uses to send user
 * commands to your bot. After creating your Discord integration in ChatBotKit,
 * copy the Interactions Endpoint URL from your integration settings and paste
 * it into your Discord application's "Interactions Endpoint URL" field in the
 * General Information section.
 *
 * Discord will send a verification request to this endpoint when you first save
 * it. The endpoint automatically handles this verification, responding to Discord's
 * PING with a PONG to confirm it's working correctly. Once verified, Discord will
 * start sending your bot's slash command interactions to this endpoint.
 *
 * When users invoke your bot's slash command (e.g., `/support Hello`), Discord
 * sends the interaction to this endpoint. The endpoint queues the message for
 * processing and immediately responds to Discord within the required 3-second
 * window. Your bot then processes the conversation in the background and sends
 * the response back to Discord when ready.
 *
 * ## Common Issues
 *
 * If you see "Invalid Interactions Endpoint URL" errors in Discord:
 *
 * - Verify you've copied the complete URL from your ChatBotKit integration settings
 * - Ensure the Public Key in ChatBotKit matches your Discord application's Public Key
 * - Make sure you haven't modified the URL or added extra characters
 * - Try clicking the Setup button in your ChatBotKit integration to re-register commands
 *
 * If slash commands aren't appearing in Discord:
 *
 * - Run the Setup operation in your ChatBotKit integration settings
 * - Restart your Discord client or refresh your browser
 * - Wait a few minutes for Discord to update its command cache
 * - Check that your bot has the `applications.commands` scope enabled
 *
 * **Note:** This endpoint only handles slash commands. Direct bot mentions in
 * messages won't trigger responses. Users must use the slash command format
 * like `/chatbotkit message` or your custom handle like `/support message`.
 *
 * ## Direct Message (DM) Support
 *
 * Slash commands work in both Discord server channels and in direct messages
 * (DMs) with the bot. When a user invokes the slash command in a DM, Discord
 * sends the interaction with the user object at the root level of the payload
 * rather than inside `member.user` (which is used for guild/server interactions).
 * ChatBotKit handles both formats automatically, so your bot responds correctly
 * regardless of whether the user is in a server channel or a private DM.
 *
 * To allow users to interact via DM, ensure your Discord application has the
 * `bot` scope added and that users can find and message your bot directly. No
 * additional configuration in ChatBotKit is required - DM interactions use the
 * same integration settings, session management, and conversation flow as server
 * channel interactions.
 *
 * ## Typing Indicator
 *
 * When a slash command interaction includes a `channel_id` in the payload (which
 * Discord provides for guild channel interactions), the integration uses the
 * channel ID to send a typing indicator before generating a response. This shows
 * users the "... is typing" animation while the bot processes their request.
 * The typing indicator requires a `botToken` to be configured on your integration
 * and is not shown in ephemeral mode. See your integration's Queue Processing
 * section for more details on typing indicator behavior.
 *
 * For detailed error information, check the Event Log in your Discord integration
 * settings. The log shows all webhook interactions and any errors that occurred,
 * which is helpful for troubleshooting configuration issues.
 */
