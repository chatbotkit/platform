import prisma from '@/prisma/client'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { joinMeeting as joinRecallMeeting } from '@/lib/recall.bot'
import type { Session } from '@/lib/session.handler'

import { z } from 'zod'

// --- Path and Handler Constants ---

export const RECALL_MEETING_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/recall'

export const JOIN_MEETING_HANDLER_NAME = 'joinMeeting'

// --- Schemas ---

const joinMeetingSchema = z.object({
  recallIntegrationId: z
    .string()
    .min(1)
    .describe('The ID of the Recall integration to use'),
  meetingUrl: z.string().url().describe('The meeting URL to join'),
  text: z
    .string()
    .min(1)
    .describe('The initial instruction to use when joining the meeting'),
  botName: z
    .string()
    .max(100)
    .optional()
    .describe('Optional display name for the Recall bot'),
  joinAt: z
    .string()
    .datetime()
    .optional()
    .describe(
      'Optional ISO 8601 date-time for joining a future meeting. Use this for future meetings only, not meetings to join now.'
    ),
})

export type JoinMeetingSchema = z.infer<typeof joinMeetingSchema>

// --- Handlers ---

async function joinMeeting(
  session: Session,
  parameters: JoinMeetingSchema,
  _headers: Headers
) {
  debug('recall/meeting/join', { parameters })

  const { recallIntegrationId, meetingUrl, text, joinAt } = parameters

  const recallIntegration =
    await prisma.recallIntegration.findUniqueByIdentifier(
      session.user,
      recallIntegrationId,
      {
        include: {
          bot: {
            select: {
              name: true,
            },
          },
        },
      }
    )

  if (!recallIntegration) {
    throw new UserInputError('Recall integration not found')
  }

  if (recallIntegration.userId !== session.user.id) {
    throw new UserInputError('Not authorized to use this Recall integration')
  }

  if (!recallIntegration.botId) {
    throw new UserInputError(
      'Recall integration does not have a bot configured'
    )
  }

  if (!recallIntegration.apiKey) {
    throw new UserInputError(
      'Recall integration does not have an API key configured'
    )
  }

  const botName = parameters.botName?.trim() || recallIntegration.bot?.name

  try {
    await joinRecallMeeting({
      recallIntegration: {
        id: recallIntegration.id,
        apiKey: recallIntegration.apiKey,
        region: recallIntegration.region,
        userId: recallIntegration.userId,
      },
      meetingUrl,
      text,
      botName,
      joinAt,
    })
  } catch (error) {
    throw new UserInputError(
      error instanceof Error ? error.message : 'Failed to join meeting'
    )
  }

  return {
    success: true,
  }
}

export default authenticatedMultiHandler({
  [JOIN_MEETING_HANDLER_NAME]: {
    schema: joinMeetingSchema,
    fn: joinMeeting,
  },
})
