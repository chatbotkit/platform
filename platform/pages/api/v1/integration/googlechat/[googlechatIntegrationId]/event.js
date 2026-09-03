// @ts-check
import prisma from '@/prisma/client'

import {
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import debug, { warn } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { verifyGoogleChatToken } from '@/lib/googlechat.auth'
import { normaliseChatEventBody } from '@/lib/googlechat.event'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { parseRequestJson } from '@/lib/request'
import {
  NOT_AUTHORIZED_STATUS,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'

import { sendEvent } from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/queue'

/**
 * @param {unknown} input
 * @returns {string}
 */
function makeGoogleChatCommandPromptName(input) {
  const value = typeof input === 'string' ? input.trim() : ''

  if (!value) {
    return ''
  }

  if (value.startsWith('/')) {
    return value
  }

  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug ? `/${slug}` : ''
}

/**
 * @param {unknown} meta
 * @param {string|number|undefined} commandId
 * @returns {{ name?: string, description?: string, prompt?: string }}
 */
function getGoogleChatCommandMeta(meta, commandId) {
  if (!meta || typeof meta !== 'object' || commandId == null) {
    return {}
  }

  const meta_ = /** @type {Record<string, any>} */ (meta)
  const commands =
    meta_?.googlechat?.commands ||
    meta_?.googleChat?.commands ||
    meta_?.commands

  if (!commands) {
    return {}
  }

  const commandIdString = String(commandId)

  const command = Array.isArray(commands)
    ? commands.find((item) => {
        if (!item || typeof item !== 'object') {
          return false
        }

        return (
          String(item.id ?? item.commandId ?? item.appCommandId) ===
          commandIdString
        )
      })
    : commands[commandIdString]

  if (!command || typeof command !== 'object') {
    return {}
  }

  return {
    name: command.name || command.commandName,
    description: command.description,
    prompt: command.prompt,
  }
}

/**
 * The event endpoint receives interaction events from Google Chat. Google
 * Chat posts JSON payloads to this HTTPS endpoint when users interact with
 * the Chat app in spaces or direct messages.
 *
 * The endpoint must respond within 30 seconds for synchronous responses.
 * For longer operations, events are queued for asynchronous processing.
 *
 * Configure this URL as the "HTTP endpoint URL" in Google Cloud Console. The
 * Google Chat API must first be enabled via APIs & Services → Library (search
 * "Google Chat API" → Enable); until then it does not appear elsewhere in the
 * console. Once enabled, the setting lives under APIs & Services → Enabled
 * APIs & services → Google Chat API → Configuration → Connection settings.
 */
export default withAny(async function (req) {
  const googlechatIntegrationId = requiredUrlParam(
    req,
    'googlechatIntegrationId'
  )

  const googlechatIntegration = await prisma.googlechatIntegration.findUnique({
    where: {
      id: googlechatIntegrationId,
    },
  })

  if (!googlechatIntegration) {
    return notFound()
  }

  // @note verify the Bearer JWT sent by Google Chat when a projectNumber is
  // configured; skip verification if not to ease development/testing.
  // Google Chat signs requests in one of two modes depending on the Chat
  // app's Authentication Audience setting:
  //   - Project Number → JWT signed by chat@system.gserviceaccount.com,
  //     aud contains the project number
  //   - HTTP endpoint URL → OIDC ID token from accounts.google.com,
  //     aud equals the exact URL Google was told to POST to
  // verifyGoogleChatToken auto-detects from the `iss` claim. We pass both
  // possible expected audiences so whichever mode is in use can be checked.

  const authHeader =
    req.headers?.get?.('authorization') || req.headers?.['authorization'] || ''

  // @note reconstruct the URL Google hit so OIDC `aud` can be compared
  // against it. Trust the request's own host/path: Google only signs OIDC
  // tokens with `aud` equal to the URL that was explicitly registered in
  // the Chat API configuration, so an attacker cannot get Google to mint a
  // token whose audience matches a URL they don't already control. We strip
  // any query string since the registered URL never includes one.
  /** @type {string|null} */
  let expectedEndpointUrl = null

  if (typeof req.url === 'string' && req.url.startsWith('http')) {
    try {
      const u = new URL(req.url)

      expectedEndpointUrl = `${u.protocol}//${u.host}${u.pathname}`
    } catch {
      // @note fall through to the request-context reconstruction below
    }
  }

  if (!expectedEndpointUrl) {
    const reqHost = getContextRequestHost()
    const reqProto = getContextRequestProtocol() || 'https'

    if (reqHost) {
      expectedEndpointUrl = `${reqProto}://${reqHost}/api/v1/integration/googlechat/${googlechatIntegrationId}/event`
    }
  }

  if (googlechatIntegration.projectNumber) {
    try {
      await verifyGoogleChatToken(authHeader, {
        projectNumber: googlechatIntegration.projectNumber,
        expectedEndpointUrl,
      })

      debug(`JWT verification passed`).log(
        'integration.googlechat.event.withAny'
      )
    } catch (error) {
      warn(`JWT verification failed`, { error: error.message }).log(
        'integration.googlechat.event.withAny'
      )

      await logEvent({
        user: { id: googlechatIntegration.userId },
        type: 'integration.googlechat.configuration.error',
        relations: {
          googlechatIntegrationId,
        },
        meta: {
          status: NOT_AUTHORIZED_STATUS,
          reason: `JWT verification failed: ${error.message}`,
        },
      })

      return notAuthorized()
    }
  } else {
    warn(`no projectNumber configured - skipping JWT verification`).log(
      'integration.googlechat.event.withAny'
    )
  }

  let body

  try {
    body = await parseRequestJson(req)
  } catch (e) {
    await captureException(e)

    return notAuthorized()
  }

  debug(`received google chat event`, { body }).log(
    'integration.googlechat.event.withAny'
  )

  // @note Google Chat sends events in one of two payload shapes depending on
  // whether the Chat app is built as a classic Chat app or as a Workspace
  // add-on. Classic shape puts `type`, `message` and `space` at the top
  // level. Workspace-add-on shape wraps everything under `chat.*Payload`
  // with the event type implied by which payload key is present. Normalise
  // to the classic shape so the switch below works for both.
  const body_ = normaliseChatEventBody(body)

  const eventType = body_?.type

  switch (eventType) {
    case 'APP_COMMAND':
    case 'MESSAGE': {
      const message = body_.message
      const space = body_.space
      const sender = message?.sender || body_.user

      // @note ignore messages from bots (prevents recursion when our own bot
      // sends a message and Google Chat echoes it back)

      if (sender?.type === 'BOT') {
        debug(`ignoring bot message to prevent recursion`).log(
          'integration.googlechat.event.withAny'
        )

        return ok()
      }

      const senderName = sender?.name || ''
      const senderDisplayName = sender?.displayName || ''
      const spaceName = space?.name || ''
      const spaceDisplayName = space?.displayName || ''
      const spaceType = space?.type || 'ROOM'
      const spaceThreadingState = space?.spaceThreadingState || ''

      const annotationCommand = Array.isArray(message?.annotations)
        ? message.annotations.find((annotation) => annotation?.slashCommand)
            ?.slashCommand
        : undefined
      const appCommandMetadata = body_.appCommandMetadata
      const appCommand =
        message?.slashCommand || annotationCommand || appCommandMetadata
          ? {
              commandId:
                message?.slashCommand?.commandId ||
                annotationCommand?.commandId ||
                appCommandMetadata?.appCommandId,
              commandName:
                message?.slashCommand?.commandName ||
                annotationCommand?.commandName,
              type:
                message?.slashCommand?.type ||
                annotationCommand?.type ||
                appCommandMetadata?.appCommandType,
            }
          : undefined

      // @note `argumentText` has user @mentions and slash command names
      // stripped. Fall back to `text` when it is empty so slash commands with
      // no arguments still reach the queue.
      const argumentText =
        typeof message?.argumentText === 'string'
          ? message.argumentText.trim()
          : ''
      const rawText =
        typeof message?.text === 'string' ? message.text.trim() : ''
      const commandMeta = getGoogleChatCommandMeta(
        googlechatIntegration.meta,
        appCommand?.commandId
      )
      const commandName =
        appCommand?.commandName ||
        commandMeta.name ||
        (rawText.startsWith('/') ? rawText.split(/\s+/)[0] : '')
      const fallbackCommandName = appCommand?.commandId
        ? `/googlechat-${(appCommand.type || 'app-command')
            .toLowerCase()
            .replace(/_/g, '-')}-${appCommand.commandId}`
        : '/googlechat-app-command'
      const promptCommandName =
        makeGoogleChatCommandPromptName(commandName) || fallbackCommandName
      const commandInput =
        argumentText ||
        (rawText && rawText !== promptCommandName ? rawText : '')
      const text = appCommand
        ? [
            [promptCommandName, commandInput].filter(Boolean).join(' '),
            commandMeta.name && !commandMeta.name.startsWith('/')
              ? `Command name: ${commandMeta.name}`
              : null,
            commandMeta.description
              ? `Command description: ${commandMeta.description}`
              : null,
            commandMeta.prompt
              ? `Command instructions: ${commandMeta.prompt}`
              : null,
          ]
            .filter(Boolean)
            .join('\n\n')
        : argumentText || rawText
      const messageName = message?.name || ''
      const eventTime =
        typeof body_?.eventTime === 'string'
          ? body_.eventTime
          : typeof message?.createTime === 'string'
            ? message.createTime
            : ''
      const attachments = Array.isArray(message?.attachment)
        ? message.attachment
        : Array.isArray(message?.attachments)
          ? message.attachments
          : []

      // @note keep Google's thread identifier on the payload; the queue
      // decides whether that thread is a stable conversation surface for
      // the specific space threading mode.

      const threadName = message?.thread?.name || undefined

      if (!text && attachments.length === 0 && !appCommand) {
        debug(`ignoring empty message`).log(
          'integration.googlechat.event.withAny'
        )

        return ok()
      }

      debug(`queuing message`, {
        senderName,
        spaceName,
        attachments: attachments.length,
        spaceThreadingState,
        appCommand,
        slashCommand: appCommand
          ? {
              commandId: appCommand.commandId,
              commandName: promptCommandName,
              type: appCommand.type,
            }
          : undefined,
        text: text.substring(0, 100),
      }).log('integration.googlechat.event.withAny')

      const interactPayload = {
        senderName,
        senderDisplayName,
        spaceName,
        spaceDisplayName,
        spaceType,
        spaceThreadingState,
        messageName,
        eventTime,
        threadName,
        privateMessageViewerName: appCommand ? senderName : undefined,
        slashCommand: appCommand
          ? {
              commandId: appCommand.commandId,
              commandName: promptCommandName,
              type: appCommand.type,
            }
          : undefined,
        attachments,
        text,
      }

      await sendEvent(googlechatIntegrationId, {
        type: 'interact',
        payload: interactPayload,
      })

      // @note return an empty JSON object - Google Chat ignores it but the
      // endpoint must return a valid JSON response

      return ok()
    }

    case 'ADDED_TO_SPACE': {
      const space = body_.space

      debug(`added to space`, { space }).log(
        'integration.googlechat.event.withAny'
      )

      await logEvent({
        user: { id: googlechatIntegration.userId },
        type: 'integration.googlechat.addedToSpace',
        relations: {
          googlechatIntegrationId,
        },
        meta: {
          spaceName: space?.name,
          spaceDisplayName: space?.displayName,
          spaceType: space?.type,
        },
      })

      // @note respond with a welcome message synchronously

      return ok({
        text: "Hello! I'm your AI assistant. Send me a message to get started.",
      })
    }

    case 'REMOVED_FROM_SPACE': {
      const space = body_.space

      debug(`removed from space`, { space }).log(
        'integration.googlechat.event.withAny'
      )

      await logEvent({
        user: { id: googlechatIntegration.userId },
        type: 'integration.googlechat.removed_from_space',
        relations: {
          googlechatIntegrationId,
        },
        meta: {
          spaceName: space?.name,
          spaceDisplayName: space?.displayName,
        },
      })

      // @note Google Chat does not expect a response body for REMOVED_FROM_SPACE

      return ok()
    }

    default: {
      debug(`unhandled event type`, { eventType }).log(
        'integration.googlechat.event.withAny'
      )

      return ok()
    }
  }
})

/**
 * @manual Google Chat Integration
 *
 * ## Event Webhook Endpoint
 *
 * Handle real-time events from Google Chat including messages and space
 * membership changes. This webhook endpoint is the core of the Google Chat
 * integration, receiving and processing all events that trigger bot responses.
 *
 * The event endpoint must be configured as the HTTP endpoint URL in your
 * Google Cloud Console Chat API settings under "Connection settings".
 *
 * ### Webhook URL Configuration
 *
 * The endpoint URL has the form:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/googlechat/{googlechatIntegrationId}/event
 * ```
 *
 * Replace `{googlechatIntegrationId}` with your actual integration ID.
 *
 * To register it in Google Cloud Console:
 *
 * 1. Enable the Google Chat API via APIs & Services → Library (search
 *    "Google Chat API" → Enable). Until the API is enabled it does not appear
 *    anywhere else in the console.
 * 2. Go to APIs & Services → Enabled APIs & services → Google Chat API →
 *    Configuration tab.
 * 3. Under **Application info**, fill in the required fields: **App name**
 *    (display name shown to users in Chat), **Avatar URL** (a publicly
 *    reachable `https://` image URL - Google Drive sharing links do not
 *    work), and **Description**. The configuration page cannot be saved
 *    while any of these are empty. The **Project number (App ID)** shown
 *    here is also the value to paste into the Project Number field on the
 *    ChatBotKit integration page.
 * 4. Under **Connection settings**, set the endpoint type to **HTTP endpoint
 *    URL** (the other option is Apps Script - you want HTTP).
 * 5. Select **Use a common HTTP endpoint URL for all triggers** so that a
 *    single URL field appears, then paste the endpoint URL above into it.
 * 6. Under **Functionality**, enable **Join spaces and group conversations**
 *    if you want the bot to operate in multi-user spaces in addition to
 *    direct messages.
 * 7. Optional: under **Commands**, add slash commands, quick commands, or message
 *    actions. Slash commands include the command text and any arguments. Quick
 *    commands and message actions are delivered by command ID, so add bot
 *    instructions for the generated command token, such as
 *    `/googlechat-quick-command-444`. Command responses are sent privately to the
 *    user who invoked them.
 * 8. Under **Visibility**, either select **Make this Chat app available to
 *    specific people and groups in your domain** and enter at least one
 *    email address (the configuration cannot be saved while this list is
 *    empty), or choose to make it available to everyone in your Workspace
 *    domain.
 * 9. Save the configuration.
 * 10. In Google Chat, add the app to each space where you want it to respond:
 *    open the space, choose **Manage members** or **Add people & apps**, search
 *    for the app's **App name**, and add it. For direct messages, start a new
 *    chat with the app instead.
 *
 * Google Chat only sends space interactions after the Chat app has been added
 * to that specific space. The **Join spaces and group conversations** setting
 * allows the app to be added to spaces, but it does not add the app for you.
 *
 * > ⚠️ **Gotcha - if you cannot find the bot when searching in Google
 * > Chat:** Google Chat **Visibility is deny-by-default**. If no one is on
 * > the allowlist, nobody can discover or add the app. Go back to the
 * > Visibility section and make sure either (a) the "specific people and
 * > groups" option is ticked with at least your own email in the list, or
 * > (b) the "available to everyone in your domain" option is ticked.
 * > Toggling the specific-people option off without enabling the
 * > domain-wide option makes the bot completely undiscoverable - searching
 * > by its App name in `+ New chat` or "Add people & apps" will return no
 * > results. You must also be signed into Google Chat as a user **in the
 * > same Workspace domain** as the project; personal `@gmail.com` accounts
 * > cannot see Chat apps hosted in a Workspace project.
 *
 * > ⚠️ **Gotcha - if the "available to everyone in your domain" option is
 * > missing:** If your Workspace admin has enabled the Marketplace
 * > allowlisting policy, Google Chat hides the domain-wide visibility
 * > option entirely and shows a notice beginning "Your admin's Google
 * > Workspace Marketplace setting requires app allowlisting." In that
 * > case the **specific people and groups** list is capped at **5 email
 * > addresses** (intended for development/testing); group/domain visibility
 * > has no effect until either the app is **published to the Google
 * > Workspace Marketplace** (see Google's "Publish Google Chat apps"
 * > guide) or your Workspace admin **allowlists the app** in Workspace
 * > Marketplace admin settings. For internal-only bots, asking the admin
 * > to allowlist the app is usually simpler than publishing it.
 * >
 * > Also check **Admin Console → Apps → Google Workspace Marketplace apps →
 * > Settings → Manage access to apps**. If **Don't allow users to install
 * > and run apps from the Marketplace** is enabled, turn on **Allow
 * > exception for internal apps. Users can install and run any internal
 * > app.** Without that exception, internal Chat apps can receive mention
 * > events but asynchronous replies may fail with `403 PERMISSION_DENIED`:
 * > "This organization's administrator must allow users to install this
 * > Chat app."
 *
 * > ⚠️ **Gotcha - spaces must explicitly include the app:**
 * > If direct messages work but the bot does not respond in a space, confirm
 * > that the Chat app has been added to that exact space. The Google Cloud
 * > **Join spaces and group conversations** checkbox is required for space
 * > support, but it only controls whether the app can be added. It does not
 * > automatically place the app into existing spaces.
 *
 * ### Event Types
 *
 * **MESSAGE**: Sent when a user sends a message to the Chat app. The bot
 * processes the message asynchronously and replies in the same space/thread.
 *
 * **ADDED_TO_SPACE**: Sent when the Chat app is added to a space or a direct
 * message is initiated. The bot immediately responds with a welcome message.
 *
 * **REMOVED_FROM_SPACE**: Sent when the Chat app is removed from a space.
 * The event is logged and no response is sent.
 *
 * ### JWT Verification
 *
 * Google Chat signs webhook requests sent to this endpoint. Configure the
 * integration with the Google Cloud Project Number from the same project as
 * your Chat app so ChatBotKit can verify incoming requests. Leaving the Project
 * Number empty disables request verification and should only be used for local
 * development or manual testing.
 *
 * ### Space Message Delivery
 *
 * Google Chat interaction webhooks only deliver direct messages and explicit
 * app interactions in spaces, such as @mentions, slash commands, or other
 * configured app interactions. They do not deliver every message posted in a
 * space.
 *
 * The integration can't make Google Chat send messages that this interaction
 * webhook doesn't receive. Reacting to every message in a space would require
 * a separate Google Workspace Events API subscription flow.
 *
 * ### Commands
 *
 * Google Chat supports slash commands, quick commands, and message actions.
 * ChatBotKit can receive all three command types through the same interaction
 * endpoint and routes command responses privately to the user who invoked them.
 *
 * Slash commands include the command name and argument text in the message that
 * ChatBotKit sends to the bot. For example, a slash command such as `/support`
 * with the text `billing question` is handled as `/support billing question`.
 * Configure the bot with instructions for each slash command that should
 * trigger a specific workflow.
 *
 * Quick commands and message actions are different: Google Chat sends the
 * command ID and command type, but not the display name or description from the
 * Google Cloud configuration. ChatBotKit therefore passes a stable command token
 * to the bot, such as `/googlechat-quick-command-444` or
 * `/googlechat-message-action-444`. Add bot instructions that map each token to
 * the intended behavior. For message actions, selected message text is included
 * after the command token when Google provides it.
 *
 * ### Context Security
 *
 * Google Chat direct messages are treated as trusted 1:1 conversation surfaces.
 * This lets private, account-specific actions continue in a direct message when
 * a user has connected the required credentials.
 *
 * Multi-user spaces and group conversations are treated as shared surfaces. The
 * bot can still answer messages there, but private user context is not used for
 * actions that require user-specific credentials, and contacts are not attached
 * to conversations created in those shared surfaces. If an action needs a user's
 * private credentials, the user should continue the flow in a direct message.
 *
 * Unknown or missing Google Chat space types are handled conservatively and are
 * treated like shared spaces rather than trusted direct messages.
 *
 * ### File Attachments
 *
 * When `attachments` is enabled, uploaded files included in Google Chat
 * messages are downloaded and stored as conversation attachments before the bot
 * receives the user's text. This makes documents, images, and other uploaded
 * files available to attachment-aware bot workflows.
 *
 * Media-only messages are processed for attachments but do not trigger a bot
 * reply unless the user also sends text. This avoids unsolicited responses when
 * a user uploads a file without a prompt.
 *
 * Google Drive-backed attachments are not downloaded by this flow. Google
 * exposes those through Drive-specific references rather than Chat uploaded
 * media, so they are skipped safely.
 *
 * ### Session Management
 *
 * Each unique sender within a space maintains their own conversation session.
 * Sessions expire based on the configured `sessionDuration` (default: 1 day).
 * Users can reset their session by sending `///restart`, `///reset`, or
 * `///new`.
 */
