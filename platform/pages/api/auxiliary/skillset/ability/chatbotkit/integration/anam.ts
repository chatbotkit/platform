import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { getExternalFrontendHostURL } from '@/lib/host'
import type { Session } from '@/lib/session.handler'
import { getTempShortURL } from '@/lib/short'

import { createAnamIntegrationSession } from '@/pages/api/v1/integration/anam/[anamIntegrationId]/session/create'

import { z } from 'zod'

export const ANAM_AVATAR_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/anam'

export const GET_AVATAR_URL_HANDLER_NAME = 'getAvatarUrl'

const getAvatarUrlSchema = z.object({
  anamIntegrationId: z
    .string()
    .min(1)
    .describe('The ID of the Anam integration to use'),
})

export type GetAvatarUrlSchema = z.infer<typeof getAvatarUrlSchema>

async function getAvatarUrl(
  session: Session,
  parameters: GetAvatarUrlSchema,
  headers: Headers
) {
  debug('anam/avatar/url', { parameters })

  const anamIntegration = await prisma.anamIntegration.findUniqueByIdentifier(
    session.user,
    parameters.anamIntegrationId,
    {
      select: {
        id: true,
        userId: true,
      },
    }
  )

  if (!anamIntegration) {
    throw new UserInputError('Anam integration not found')
  }

  if (anamIntegration.userId !== session.user.id) {
    throw new UserInputError('Not authorized to use this Anam integration')
  }

  const sessionResponse = await createAnamIntegrationSession({
    anamIntegrationId: anamIntegration.id,
    req: new Request('https://chatbotkit.local/anam-session', {
      headers,
    }),
  })

  const sessionData = await sessionResponse.json()

  if (!sessionResponse.ok || !sessionData?.session) {
    throw new UserInputError(
      sessionData?.message || 'Unable to create Anam session'
    )
  }

  const url = new URL(
    getExternalFrontendHostURL(`/integrations/anam/${anamIntegration.id}/frame`)
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
