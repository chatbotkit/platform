/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- used inside getServerSideProps only */
import { template as t } from '@chatbotkit-dev/template'
import { ONE_DAY_IN_SECONDS, getStartOfDay } from '@chatbotkit-dev/time'

import { siteHostname } from '@/config/site'
import { autoWidgetModel, autoWidgetUserId } from '@/config/widget'

import { getConversationDetails } from '@/lib/bot.conversation'
import { setupRequestContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { isProduction } from '@/lib/env'
import { getPartnerByHostname } from '@/lib/partner.helpers'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { isEffectivePartnerAccount } from '@/lib/user.type'

import useIsTop from '@/hooks/useIsTop'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'
import WidgetFrame from '@/pages/integrations/widget/[widgetIntegrationId]/frame'
import blueprintAssistantPrompt from '@/prompts/blueprint_assistant_v1.yaml'
import dashboardAssistantPrompt from '@/prompts/dashboard_assistant_v1.yaml'
import websiteAssistantPrompt from '@/prompts/website_assistant_v1.yaml'

// @note assistant types that are available to unauthenticated visitors. Every
// other type requires a session. Public assistants must not expose private
// account data and require an explicitly configured service-account owner.
const PUBLIC_TYPES = new Set(['website-assistant'])

export default function Frame(props) {
  const isTop = useIsTop(null)

  return isProduction && isTop ? null : <WidgetFrame {...props} />
}

Frame.getLayout = WidgetFrame.getLayout

Frame.theme = WidgetFrame.theme

export async function getServerSideProps(context) {
  return executeInContext(async () => {
    setupRequestContext(context.req)

    if (!autoWidgetModel) {
      return {
        notFound: true,
      }
    }

    const frontendHost =
      getContextFrontendHost() || getContextRequestHost() || siteHostname

    const session = await getSoftSession(context.req, context.res)

    const isPublicType =
      !!autoWidgetUserId && PUBLIC_TYPES.has(context.query.type)

    if (!session && !isPublicType) {
      if (context.req.method === 'POST') {
        context.res.setHeader('Content-Type', 'application/json')

        context.res.statusCode = 401

        context.res.write(
          JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' })
        )

        context.res.end()

        return {
          props: makeJsonSafe({}),
        }
      } else {
        return {
          props: makeJsonSafe({
            authenticated: false,
          }),
        }
      }
    }

    // @note the Auto assistant renders in two contexts that must be identical in
    // structure (sizing, spacing, message style) and differ ONLY in color scheme:
    //   - 'dashboard-assistant' -> website / dashboard -> dark scheme
    //   - 'blueprint-assistant' -> blueprint designer (light canvas) -> light scheme
    // So shared layout lives once in `autoTheme.config`; the two palettes
    // (`darkColors` / `lightColors`) are merged in via `themeWith`.
    //
    // Ported from the "concierge" example (Intercom-style) but recolored to our
    // design-system palette: zinc grays for surfaces, indigo (--color-accent)
    // reserved for the one rule-compliant accent - message links (navigate =
    // indigo). User bubble / input focus / send / buttons stay neutral; the user
    // bubble is distinguished by position + value, not hue.

    const ACCENT = '#6366f1' // indigo-500 (links on light surfaces)
    const ACCENT_LIGHT = '#818cf8' // indigo-400 (links on dark surfaces)

    // @note single rounding source shared by buttons and message bubbles so they
    // match. Mirrors globals.css `.core-button` (`@apply rounded-lg`), i.e.
    // Tailwind's `borderRadius.lg` / `--rounding-lg` = 0.5rem.
    const ROUNDING = '0.5rem'

    // shared structure / sizing - color-agnostic
    const autoTheme = {
      name: 'default',
      config: {
        version: 'v2',

        fontSize: '14px',
        lineHeight: '20px',

        buttonSize: '56px',
        buttonRounding: ROUNDING,
        buttonFeatures: 'hide-on-open',

        popupRounding: '12px',

        barBorderSize: '1px',
        barPadding: '16px 18px',

        messageStyle: 'bubble',
        messageRounding: ROUNDING,
        messagesPadding: '18px',
        messageSpacing: '1.75rem',
        messagePadding: '0.75rem 1.1rem',

        messageButtonBorderSize: '0px',
        messageButtonRounding: ROUNDING,
        messageButtonPadding: '8px 14px 8px 14px',

        actionsPadding: '16px',
        actionsBorderPrimary: 'transparent',

        inputRounding: '16px',
        inputPadding: '12px 16px',

        popoverWidth: '420px',
        popoverHeight: '720px',
      },
    }

    // dark color scheme - website / dashboard
    const darkColors = {
      previewPrimary: '#0a0a0a',
      previewText: '#fafafa',

      buttonPrimary: '#0a0a0a',
      buttonSecondary: '#0a0a0a',
      buttonText: '#fafafa',

      popupBorderPrimary: '#27272a',

      conversationPrimary: '#0a0a0a',
      conversationText: '#fafafa',

      barPrimary: '#0a0a0a',
      barText: '#fafafa',
      barBorderPrimary: '#27272a',

      botMessagePrimary: '#27272a',
      botMessageText: '#fafafa',

      userMessagePrimary: '#fafafa', // neutral; distinguished by position + value
      userMessageText: '#0a0a0a',

      messageLinkPrimary: ACCENT_LIGHT,
      messageLinkSecondary: '#d4d4d8',

      messageButtonPrimary: '#18181b',
      messageButtonSecondary: '#27272a',
      messageButtonText: '#fafafa',

      botMessageButtonPrimary: '#18181b',
      botMessageButtonSecondary: '#27272a',
      botMessageButtonText: '#fafafa',

      introMessageButtonPrimary: '#18181b',
      introMessageButtonSecondary: '#27272a',
      introMessageButtonText: '#fafafa',
      introMessageButtonBorderPrimary: '#3f3f46',
      introMessageButtonBorderSecondary: '#52525b',

      inputPrimary: '#0a0a0a',
      inputSecondary: '#0a0a0a',
      inputText: '#fafafa',
      inputBorderPrimary: '#27272a',
      inputBorderSecondary: '#ffffff', // focus = neutral emphasis

      tapText: '#a1a1aa',
      sendText: '#fafafa',
    }

    // light color scheme - blueprint designer
    const lightColors = {
      previewPrimary: '#ffffff',
      previewText: '#0a0a0a',

      buttonPrimary: '#0a0a0a',
      buttonSecondary: '#0a0a0a',
      buttonText: '#fafafa',

      popupBorderPrimary: '#e4e4e7',

      conversationPrimary: '#ffffff',
      conversationText: '#0a0a0a',

      barPrimary: '#ffffff',
      barText: '#0a0a0a',
      barBorderPrimary: '#e4e4e7',

      botMessagePrimary: '#f4f4f5',
      botMessageText: '#0a0a0a',

      userMessagePrimary: '#0a0a0a', // neutral; distinguished by position + value
      userMessageText: '#fafafa',

      messageLinkPrimary: ACCENT,
      messageLinkSecondary: '#52525b',

      messageButtonPrimary: '#f4f4f5',
      messageButtonSecondary: '#e4e4e7',
      messageButtonText: '#0a0a0a',

      botMessageButtonPrimary: '#f4f4f5',
      botMessageButtonSecondary: '#e4e4e7',
      botMessageButtonText: '#0a0a0a',

      introMessageButtonPrimary: '#f4f4f5',
      introMessageButtonSecondary: '#e4e4e7',
      introMessageButtonText: '#0a0a0a',
      introMessageButtonBorderPrimary: '#e4e4e7',
      introMessageButtonBorderSecondary: '#d4d4d8',

      inputPrimary: '#ffffff',
      inputSecondary: '#ffffff',
      inputText: '#0a0a0a',
      inputBorderPrimary: '#e4e4e7',
      inputBorderSecondary: '#0a0a0a', // focus = neutral emphasis

      tapText: '#71717a',
      sendText: '#0a0a0a',
    }

    const themeWith = (colors) => ({
      ...autoTheme,
      config: { ...autoTheme.config, ...colors },
    })

    const darkTheme = themeWith(darkColors)
    const lightTheme = themeWith(lightColors)

    const specificIntegration = {
      // @note load specific widget integration based on query

      'dashboard-assistant': {
        id: 'dashboard-assistant',

        title: 'Auto',

        backstory: dashboardAssistantPrompt.prompt,
        model: autoWidgetModel,

        intro: t`
        **The AI troubleshooting assistant is currently in beta.**
      `,

        initial: t`
        I can help you troubleshoot and understand your resources.

        [Diagnose an issue...]() [Explain a configuration...]() [Check my setup...]()
      `,

        placeholder: '...',

        // website / dashboard context -> dark scheme
        theme: darkTheme,
      },

      'blueprint-assistant': {
        id: 'blueprint-assistant',

        title: 'Auto',

        backstory: blueprintAssistantPrompt.prompt,
        model: autoWidgetModel,

        intro: t`
        **I'm your assistant.** I can help you design and build solutions. \
        Just describe what you need and I'll help you create it.
      `,

        placeholder: '...',

        // designer (light canvas) context -> light scheme
        theme: lightTheme,
      },

      // public assistant for unauthenticated visitors on the website
      'website-assistant': {
        id: 'website-assistant',

        title: 'Auto',

        backstory: websiteAssistantPrompt.prompt,
        model: autoWidgetModel,

        intro: t`
        **Hi there!** I'm here to help you explore ChatBotKit.
      `,

        initial: t`
        Ask me anything about ChatBotKit and what you can build with it.

        [What is ChatBotKit?]() [How do I get started?]() [Show me what's possible...]()
      `,

        placeholder: '...',

        // website context -> dark scheme
        theme: darkTheme,
      },
    }[context.query.type]

    const widgetIntegration = {
      id: '',

      name: '',
      description: '',

      backstory: t``,
      model: autoWidgetModel,

      title: 'Auto',

      placeholder: '...',

      theme: darkTheme,

      layout: context.query.layout,

      autoFocus: false, // @note if on, it will scroll the parent to the iframe embed
      autoScroll: true,

      attachments: false,

      poweredBy: false,

      verbose: true,

      ...specificIntegration,
    }

    const widgetConfig = {
      hideBar: context.query.hideBar === 'true',
      hideButton: context.query.hideButton === 'true',
    }

    if (context.req.method === 'POST') {
      // @note use the session user id if they are a partner (direct partner or
      // user of a partner), otherwise fall back to the configured auto
      // widget user (AUTO_WIDGET_USER_ID) and, when that is unset, the session
      // user; with neither available the request fails closed below

      const userId =
        session && (await isEffectivePartnerAccount(session.user))
          ? session.user.parentId || session.user.id
          : autoWidgetUserId || session?.user?.parentId || session?.user?.id

      if (!userId) {
        context.res.statusCode = 401
        context.res.write(
          JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' })
        )
        context.res.end()

        return {
          props: makeJsonSafe({}),
        }
      }

      context.res.setHeader('Content-Type', 'application/json')

      const model = widgetIntegration.model

      let backstory = widgetIntegration.backstory

      {
        const partner = await getPartnerByHostname(frontendHost)

        if (partner) {
          const origin = `https://${frontendHost}`

          backstory = t`
          ${backstory}

          # Partner white-label instructions

          This assistant is being used through the ${partner.name} partner experience.

          - In user-facing explanations, refer to the platform as "${partner.name}" instead of "ChatBotKit".
          - When showing URLs, examples, embed snippets, API examples, or generated code that references the platform host, use the current partner origin: ${origin}.
          - Rewrite examples that would normally point to chatbotkit.com so they use ${origin} instead.
          - Do not rename npm packages, import paths, API object names, SDK identifiers, or protocol fields that must remain unchanged for code to work.
        `
        }
      }

      const details = getConversationDetails({
        model,
        backstory,
      })

      const { id: conversationId } = await createConversation(userId, {
        ...details,

        meta: {
          app: 'auto',
          blueprintId: context.query.instance || undefined,
        },
      })

      const durationInSeconds = ONE_DAY_IN_SECONDS

      const token = await createConversationSessionToken({
        conversationId,
        userId,
        durationInSeconds,
        extra: {
          options: {
            engine: {
              features:
                /** @type {import('@/lib/conversation.engine').Feature[]} */ ([
                  // @note added in order to fill the prompt with specific
                  // instructions how to render buttons
                  { name: 'buttons' },

                  // @note added in order to have better display of verbose mode
                  // when rendering the assistant messages
                  { name: 'justification' },

                  // @note disabled because we don't want it to confuse with internal routes
                  // { name: 'web', options: { search: true, fetch: true } },
                ]),
            },
          },
        },
      })

      const expiresAt = Date.now() + durationInSeconds * 1000

      context.res.write(JSON.stringify({ conversationId, token, expiresAt }))
      context.res.end()

      return {
        props: makeJsonSafe({}),
      }
    }

    context.res.setHeader(
      'Content-Security-Policy',
      `frame-ancestors 'self' https://${frontendHost}`
    )

    return {
      props: makeJsonSafe({
        ...widgetConfig,

        integration: widgetIntegration,

        getTokenRoute: `!/auto/widget/frame?type=${encodeURIComponent(
          context.query.type || ''
        )}&instance=${encodeURIComponent(context.query.instance || '')}`,

        session: [
          widgetIntegration.id,
          context.query.instance,
          getStartOfDay().getTime(),
        ]
          .filter(Boolean)
          .join('-'),
      }),
    }
  })
}
