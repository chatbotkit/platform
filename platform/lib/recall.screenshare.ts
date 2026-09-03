import prisma from '@/prisma/client'

import { requiredUrlParam } from '@/lib/query.get'
import {
  type RecallMeetingSession,
  getRecallMeetingSession,
} from '@/lib/recall.session'
import { conflict, notAuthenticated, notFound } from '@/lib/response'

type RecallSessionControlContext =
  | {
      ok: false
      response: Response
    }
  | {
      ok: true
      recallIntegration: {
        id: string
        userId: string
        apiKey: string
        region: string | null
      }
      recallSession: RecallMeetingSession & {
        recallBotId: string
      }
    }

export async function getRecallSessionControlContext(
  req: Request
): Promise<RecallSessionControlContext> {
  const recallIntegrationId = requiredUrlParam(req, 'recallIntegrationId')
  const sessionId = requiredUrlParam(req, 'sessionId')

  const recallSession = await getRecallMeetingSession(sessionId)

  if (
    !recallSession ||
    recallSession.recallIntegrationId !== recallIntegrationId
  ) {
    return {
      ok: false,
      response: notAuthenticated(),
    }
  }

  if (!recallSession.recallBotId) {
    return {
      ok: false,
      response: conflict('Recall session requires a bot'),
    }
  }

  const recallIntegration = await prisma.recallIntegration.findUnique({
    where: {
      id: recallIntegrationId,
    },

    select: {
      id: true,
      userId: true,
      apiKey: true,
      region: true,
    },
  })

  if (!recallIntegration) {
    return {
      ok: false,
      response: notFound(),
    }
  }

  if (recallSession.userId !== recallIntegration.userId) {
    return {
      ok: false,
      response: notAuthenticated(),
    }
  }

  if (!recallIntegration.apiKey) {
    return {
      ok: false,
      response: conflict('Recall integration requires an API key'),
    }
  }

  return {
    ok: true,
    recallIntegration: {
      id: recallIntegration.id,
      userId: recallIntegration.userId,
      apiKey: recallIntegration.apiKey,
      region: recallIntegration.region,
    },
    recallSession: {
      ...recallSession,
      recallBotId: recallSession.recallBotId,
    },
  }
}

export const getRecallScreenshareSessionContext =
  getRecallSessionControlContext
