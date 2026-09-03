import { type Dataset, DatasetVisibility } from '@/prisma/types'

import { captureException } from '@/lib/error'
import { getRelatedUsers } from '@/lib/user.relation'

export async function canUseDataset(
  userId: string,
  dataset: Pick<Dataset, 'userId' | 'visibility'>
): Promise<boolean> {
  // the user is the owner of the dataset

  if (dataset.userId === userId) {
    return true
  }

  // the dataset is public

  if (dataset.visibility === DatasetVisibility.public) {
    return true
  }

  // the dataset is protected

  if (dataset.visibility === DatasetVisibility.protected) {
    try {
      const relatedUsers = await getRelatedUsers({ id: userId })

      if (
        relatedUsers.some((relatedUser) => relatedUser.id === dataset.userId)
      ) {
        return true
      }
    } catch (error) {
      await captureException(error)
    }
  }

  return false
}

export async function canManipulateDataset(
  userId: string | undefined | null,
  dataset: Pick<Dataset, 'userId'>
): Promise<boolean> {
  // the user is the owner of the dataset

  if (dataset.userId === userId) {
    return true
  }

  return false
}
