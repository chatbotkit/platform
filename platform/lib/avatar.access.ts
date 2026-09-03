import { Visibility } from '@/prisma/enums'

import { captureException } from '@/lib/error'
import { getRelatedUsers } from '@/lib/user.relation'

type AvatarIntegrationAccess = {
  userId: string
  visibility: keyof typeof Visibility
}

export async function canUseAvatarIntegration(
  userId: string | undefined | null,
  avatarIntegration: AvatarIntegrationAccess
): Promise<boolean> {
  if (!userId) {
    return false
  }

  if (avatarIntegration.userId === userId) {
    return true
  }

  if (avatarIntegration.visibility === Visibility.public) {
    return true
  }

  if (avatarIntegration.visibility === Visibility.protected) {
    try {
      const relatedUsers = await getRelatedUsers({ id: userId })

      if (
        relatedUsers.some(
          (relatedUser) => relatedUser.id === avatarIntegration.userId
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

export async function canManipulateAvatarIntegration(
  userId: string | undefined | null,
  avatarIntegration: Pick<AvatarIntegrationAccess, 'userId'>
): Promise<boolean> {
  if (avatarIntegration.userId === userId) {
    return true
  }

  return false
}
