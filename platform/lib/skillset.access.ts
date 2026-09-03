import { type Skillset, SkillsetVisibility } from '@/prisma/types'

import { captureException } from '@/lib/error'
import { getRelatedUsers } from '@/lib/user.relation'

export async function canUseSkillset(
  userId: string,
  skillset: Pick<Skillset, 'userId' | 'visibility'>
): Promise<boolean> {
  // the user is the owner of the skillset

  if (skillset.userId === userId) {
    return true
  }

  // the skillset is public

  if (skillset.visibility === SkillsetVisibility.public) {
    return true
  }

  // the skillset is protected

  if (skillset.visibility === SkillsetVisibility.protected) {
    try {
      const relatedUsers = await getRelatedUsers({ id: userId })

      if (
        relatedUsers.some((relatedUser) => relatedUser.id === skillset.userId)
      ) {
        return true
      }
    } catch (error) {
      await captureException(error)
    }
  }

  return false
}

export async function canManipulateSkillset(
  userId: string | undefined | null,
  skillset: Pick<Skillset, 'userId'>
): Promise<boolean> {
  // the user is the owner of the skillset

  if (skillset.userId === userId) {
    return true
  }

  return false
}
