import type { Space } from '@/prisma/types'

export function canUseSpace(
  userId: string | undefined | null,
  space: Pick<Space, 'userId'>
): boolean {
  return space.userId === userId
}
