import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { getExternalFrontendHostURL } from '@/lib/host'
import type { Session } from '@/lib/session.handler'
import { getTempShortURL } from '@/lib/short'

import { createAvatarIntegrationRealtimeSession } from '@/pages/api/v1/integration/avatar/[avatarIntegrationId]/session/create'

import { z } from 'zod'

export const AVATAR_INTEGRATION_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/avatar'

export const GET_AVATAR_URL_HANDLER_NAME = 'getAvatarUrl'

const getAvatarUrlSchema = z.object({
  avatarIntegrationId: z
    .string()
    .min(1)
    .describe('The ID of the Avatar integration to use'),
})

export type GetAvatarUrlSchema = z.infer<typeof getAvatarUrlSchema>

async function getAvatarUrl(
  session: Session,
  parameters: GetAvatarUrlSchema,
  headers: Headers
) {
  debug('avatar/integration/url', { parameters })

  const avatarIntegration = await prisma.avatarIntegration.findUniqueByIdentifier(
    session.user,
    parameters.avatarIntegrationId,
    {
      select: {
        id: true,
        userId: true,
      },
    }
  )

  if (!avatarIntegration) {
    throw new UserInputError('Avatar integration not found')
  }

  if (avatarIntegration.userId !== session.user.id) {
    throw new UserInputError('Not authorized to use this Avatar integration')
  }

  const sessionResponse = await createAvatarIntegrationRealtimeSession({
    avatarIntegrationId: avatarIntegration.id,
    req: new Request('https://chatbotkit.local/avatar-session', {
      headers,
    }),
  })

  const sessionData = await sessionResponse.json()

  if (!sessionResponse.ok || !sessionData?.session) {
    throw new UserInputError(
      sessionData?.message || 'Unable to create Avatar session'
    )
  }

  const url = new URL(
    getExternalFrontendHostURL(
      `/integrations/avatar/${avatarIntegration.id}/frame`
    )
  )

  url.searchParams.set('session', sessionData.session)

  return {
    url: await getTempShortURL(url.toString(), ONE_HOUR_IN_SECONDS),
  }
}

export default authenticatedMultiHandler({
  [GET_AVATAR_URL_HANDLER_NAME]: {
    schema: getAvatarUrlSchema,
    fn: getAvatarUrl,
  },
})
