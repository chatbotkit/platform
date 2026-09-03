import prisma from '@/prisma/client'
import type { User } from '@/prisma/types'

import { setContextFrontendHost } from '@/lib/context.store'
import { captureException } from '@/lib/error'
import { getPortalFrontendHost } from '@/lib/portal.slug'

/**
 * Sets up frontend host context for integrations by finding the user's first
 * portal and setting the appropriate frontend host URL for context-based link
 * rewriting.
 *
 * @param userId - The user ID to find the portal for
 */
export async function setupFrontendHostContext(
  user: Pick<User, 'id' | 'email'>
): Promise<void> {
  // @note set frontend host from first portal URL for context-based link
  // rewriting
  // @todo perhaps allow for users to select their default portal and use that
  // instead

  try {
    const firstPortal = await prisma.portal.findFirst({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        slug: true,
        userId: true,
      },
      orderBy: {
        createdAt: 'asc', // @note get the first (oldest) portal
      },
    })

    if (firstPortal) {
      const frontendHost = await getPortalFrontendHost(firstPortal)

      setContextFrontendHost(frontendHost)
    }
  } catch (error) {
    await captureException(error)
  }
}
