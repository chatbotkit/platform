import { Visibility } from '@/prisma/enums'

import { captureException } from '@/lib/error'
import { getRelatedUsers } from '@/lib/user.relation'

type AnamIntegrationAccess = {
  userId: string
  visibility: keyof typeof Visibility
}

export async function canUseAnamIntegration(
  userId: string | undefined | null,
  anamIntegration: AnamIntegrationAccess
): Promise<boolean> {
  if (!userId) {
    return false
  }

  if (anamIntegration.userId === userId) {
    return true
  }

  if (anamIntegration.visibility === Visibility.public) {
    return true
  }

  if (anamIntegration.visibility === Visibility.protected) {
    try {
      const relatedUsers = await getRelatedUsers({ id: userId })

      if (
        relatedUsers.some(
          (relatedUser) => relatedUser.id === anamIntegration.userId
        )
      ) {
        return true
      }
    } catch (error) {
      await captureException(error)
    }
  }

  return false
}

export async function canManipulateAnamIntegration(
  userId: string | undefined | null,
  anamIntegration: Pick<AnamIntegrationAccess, 'userId'>
): Promise<boolean> {
  if (anamIntegration.userId === userId) {
    return true
  }

  return false
}
