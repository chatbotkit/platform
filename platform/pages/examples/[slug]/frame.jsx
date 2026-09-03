/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- used inside getServerSideProps only */
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { siteHostname } from '@/config/site'
import { exampleWidgetUserId } from '@/config/widget'

import { getConversationDetails } from '@/lib/bot.conversation'
import { setupRequestContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { isProduction } from '@/lib/env'
import { getExampleBySlug } from '@/lib/example.fetch'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import useIsTop from '@/hooks/useIsTop'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'
import WidgetFrame from '@/pages/integrations/widget/[widgetIntegrationId]/frame'

export default function Frame(props) {
  const isTop = useIsTop(null)

  return isProduction && isTop ? null : <WidgetFrame {...props} />
}

Frame.theme = 'none'

export async function getServerSideProps(context) {
  return executeInContext(async () => {
    setupRequestContext(context.req)

    const frontendHost =
      getContextFrontendHost() || getContextRequestHost() || siteHostname

    const example = getExampleBySlug(context.params.slug)

    if (!example) {
      return {
        notFound: true,
      }
    }

    if (!example.live && !example.demo) {
      return {
        notFound: true,
      }
    }

    const widgetIntegration = {
      id: example.slug,

      name: example.title,
      description: example.description,

      backstory:
        example.liveBackstory ||
        example.demoBackstory ||
        [example.backstory, example.backstoryExtra]
          .filter(Boolean)
          .join('\n\n'),

      model: example.model,

      title: example.title,
      intro: example.intro,
      theme: example.theme,

      layout: context.query.layout,

      autoFocus: false, // @note if on, it will scroll the parent to the iframe embed
      autoScroll: true,

      // @note no need to set the session as this is going to be based from the
      // example id

      ...example.widget,
    }

    if (context.req.method === 'POST') {
      // @note use the configured example widget user (EXAMPLE_WIDGET_USER_ID)
      // and, when that is unset, fall back to the session user; with neither
      // available the request fails closed below

      const session = await getSoftSession(context.req, context.res)

      const userId =
        exampleWidgetUserId || session?.user?.parentId || session?.user?.id

      context.res.setHeader('Content-Type', 'application/json')

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

      const details = getConversationDetails({
        backstory: widgetIntegration.backstory,
        model: widgetIntegration.model,
      })

      const { id: conversationId } = await createConversation(userId, {
        ...details,

        meta: {
          app: 'examples',
          example: example.slug,
        },
      })

      const durationInSeconds = ONE_HOUR_IN_SECONDS

      const token = await createConversationSessionToken({
        conversationId,
        userId,
        durationInSeconds,
        extra: {
          options: {
            engine: {
              features:
                /** @type {import('@/lib/conversation.engine').Feature[]} */ ([
                  { name: 'buttons' },

                  ...(widgetIntegration.math ? [{ name: 'math' }] : []),
                  ...(widgetIntegration.carousel ? [{ name: 'carousel' }] : []),
                  ...(widgetIntegration.form ? [{ name: 'form' }] : []),
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

    let contact

    {
      const session = await getSoftSession(context.req, context.res)

      if (session) {
        contact = {
          name:
            (session.name && !/@/.test(session.name) ? session.name : null) ||
            session.user.displayName ||
            session.user.name,
          email:
            (session.name && /@/.test(session.name) ? session.name : null) ||
            session.user.displayEmail ||
            session.user.email,
        }

        widgetIntegration.contactCollection = true
      }
    }

    context.res.setHeader(
      'Content-Security-Policy',
      `frame-ancestors 'self' https://${frontendHost}`
    )

    return {
      props: makeJsonSafe({
        integration: widgetIntegration,

        contact,

        // @todo integrate a secret parameter for extra validation

        getTokenRoute: `!/examples/${example.slug}/frame`,
      }),
    }
  })
}
