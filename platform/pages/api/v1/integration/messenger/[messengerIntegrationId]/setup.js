/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Meta Graph) */
// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import fetch from '@/lib/fetch'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  notAuthorized,
  notFound,
  ok,
  respondFromError,
  throwConflict,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import { META_GRAPH_API_VERSION } from './queue'

/**
 * The function is responsible for setting up a persistent menu to perform
 * several actions such as handing over to a human agent. We use the integration
 * access token to perform the setup.
 *
 * @param {import('@/prisma/types').MessengerIntegration} messengerIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(messengerIntegration) {
  debug(`do setup`, { messengerIntegration })

  if (!messengerIntegration.accessToken) {
    return throwConflict('No access token found')
  }

  // setup the get started button
  {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messenger_profile?access_token=${messengerIntegration.accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          get_started: {
            payload: 'GET_STARTED',
          },
        }),
      }
    )

    if (!response.ok) {
      const data = await response.json()

      return throwConflict(data?.error?.message ?? `Facebook API error (${response.status})`)
    }
  }

  // setup the persistent menu
  {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messenger_profile?access_token=${messengerIntegration.accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          persistent_menu: [
            {
              locale: 'default',
              composer_input_disabled: false,
              call_to_actions: [
                {
                  type: 'postback',
                  title: 'Talk to a human',
                  payload: 'HUMAN_AGENT',
                },
              ],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const data = await response.json()

      return throwConflict(data?.error?.message ?? `Facebook API error (${response.status})`)
    }
  }
}

/**
 * @swagger
 *
 * /integration/messenger/{messengerIntegrationId}/setup:
 *   post:
 *     operationId: setupMessengerIntegration
 *     summary: Setup a Messenger integration
 *     tags:
 *       - Messenger Integration
 *     parameters:
 *       - in: path
 *         name: messengerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Messenger integration
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
 *         description: The Messenger integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Messenger Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const messengerIntegration =
      await prisma.messengerIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'messengerIntegrationId')
      )

    if (!messengerIntegration) {
      return notFound()
    }

    if (messengerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(messengerIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: messengerIntegration.id })
  })
)

/**
 * @manual Messenger Integration
 *
 * ## Setting Up Messenger Integration Features
 *
 * The setup endpoint configures essential Messenger features that enhance user
 * experience and provide seamless conversation management capabilities. This
 * includes setting up the Get Started button that greets new users when they
 * first interact with your page, and configuring the persistent menu that gives
 * users access to important actions like requesting human agent assistance.
 *
 * Calling this endpoint is a crucial step after creating your Messenger integration
 * and configuring the webhook in Facebook's Developer Portal. The setup process
 * uses your Facebook Page Access Token to communicate with Facebook's Graph API
 * and establish the conversation interface elements that users will interact with.
 * Without this setup, users may experience a basic, unenhanced chat interface
 * without guided entry points or quick action options.
 *
 * The Get Started button appears when a user first opens a conversation with
 * your page, providing a welcoming entry point and sending a standardized
 * payload that your bot can use to initiate an onboarding flow or greeting
 * sequence. The persistent menu appears as a hamburger icon in the composer
 * area, offering users quick access to predefined actions such as transferring
 * to a human agent, restarting the conversation, or accessing help resources.
 *
 * ```http
 * POST /api/v1/integration/messenger/{messengerIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 */
