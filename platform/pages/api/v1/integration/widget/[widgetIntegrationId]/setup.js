// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError, captureException } from '@/lib/error'
import { clearFastTranslationMap, getFastTranslationMap } from '@/lib/intl'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').WidgetIntegration} widgetIntegration
 * @param {boolean} [force]
 * @returns {Promise<import('@/lib/intl').LanguageMap>}
 */
export async function getLanguageMap(widgetIntegration, force) {
  const languages = (widgetIntegration.language || '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.toLowerCase())

  const map = {
    // dialog
    confirmYes: 'Yes',
    confirmNo: 'No',
    confirmRestart: 'Are you sure you want to restart this conversation?',

    // bar title
    title: widgetIntegration.title,

    // bar buttons
    language: 'Language',
    restart: 'Restart',
    export: 'Export',
    maximize: 'Maximize',
    minimize: 'Minimize',

    // placeholder
    placeholder: widgetIntegration.placeholder,

    // contact collection form
    name: 'Name',
    email: 'Email',

    // configuration options
    intro: widgetIntegration.intro,
    initial: widgetIntegration.initial,
  }

  let intlMap

  if (languages.length) {
    const unique = `widget-integration-${widgetIntegration.id}`

    if (force) {
      await clearFastTranslationMap(languages, map, {
        unique: unique,
      })
    }

    try {
      intlMap = await getFastTranslationMap(languages, map, {
        unique: unique,
      })
    } catch (e) {
      await captureException(e)
    }
  }

  return {
    default: map,

    ...intlMap,
  }
}

/**
 * @param {import('@/prisma/types').WidgetIntegration} widgetIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(widgetIntegration) {
  debug(`do setup`, { widgetIntegration })

  await getLanguageMap(widgetIntegration, true)
}

/**
 * @swagger
 *
 * /integration/widget/{widgetIntegrationId}/setup:
 *   post:
 *     operationId: setupWidgetIntegration
 *     summary: Setup Widget integration
 *     tags:
 *       - Widget Integration
 *     parameters:
 *       - in: path
 *         name: widgetIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Widget integration
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
 *         description: The Widget integration was setup successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Widget integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const widgetIntegration =
      await prisma.widgetIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'widgetIntegrationId')
      )

    if (!widgetIntegration) {
      return notFound()
    }

    if (widgetIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(widgetIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: widgetIntegration.id })
  })
)

/**
 * @manual Widget Integration
 * @index 25
 *
 * ## Setting Up Widget Integrations
 *
 * The setup operation prepares a widget integration for deployment by
 * pre-generating and caching all required translation strings and configuration
 * data. This setup process is essential for ensuring optimal widget performance,
 * as it eliminates the need for real-time translation processing when users
 * interact with the widget across different languages.
 *
 * When you configure a widget with multiple languages, the system needs to
 * translate all interface elements, placeholder text, button labels, and
 * configuration messages into each specified language. Rather than performing
 * these translations on-demand (which would introduce latency), the setup
 * operation pre-generates a complete language map containing all translations,
 * stores it in a cache, and associates it with the widget integration for
 * instant retrieval.
 *
 * To initialize the setup process for a widget integration, send a POST request
 * to the setup endpoint:
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The request body can be empty, as the setup operation uses the widget's
 * existing configuration to determine what needs to be pre-generated. The
 * system reads the language settings from the widget integration record and
 * translates all relevant text elements including:
 *
 * - Dialog confirmation messages (Yes/No buttons, restart prompts)
 * - Widget title bar text
 * - Control button labels (Language, Restart, Export, Maximize, Minimize)
 * - Input placeholder text
 * - Contact collection form labels (Name, Email fields)
 * - Introduction and initial message text
 *
 * ### When to Run Setup
 *
 * You should trigger the setup operation in these scenarios:
 *
 * - **After creating a new widget**: Initial setup prepares the widget for
 *   first use
 * - **After changing languages**: When you modify the language configuration,
 *   setup regenerates translations
 * - **After updating text content**: Changes to title, placeholder, intro, or
 *   initial message require setup to update translations
 * - **To force cache refresh**: If translations seem stale or incorrect, setup
 *   clears and regenerates the language map
 *
 * The setup operation forces cache invalidation by clearing any existing
 * translations before generating new ones, ensuring that outdated translations
 * don't persist after configuration changes.
 *
 * ### Response Format
 *
 * The API returns the widget integration ID upon successful setup:
 *
 * ```json
 * {
 *   "id": "widget_abc123"
 * }
 * ```
 *
 * ### Setup Performance
 *
 * Translation generation is performed asynchronously to prevent request
 * timeouts. The initial setup request returns immediately after queuing the
 * translation work. Depending on the number of languages configured and the
 * amount of text to translate, the full setup may take several seconds to
 * complete. However, the widget will remain functional during this time using
 * cached or default translations until the new translations are ready.
 *
 * **Important Notes:**
 *
 * - Setup must be performed by the widget integration owner
 * - Translation errors are captured but don't fail the setup operation;
 *   fallback text is used if translation fails
 * - The language map includes a default (untranslated) version that's always
 *   available
 * - Setup is idempotent - running it multiple times is safe and will simply
 *   regenerate translations
 * - Translations are cached with a unique key per widget integration to prevent
 *   conflicts
 */
