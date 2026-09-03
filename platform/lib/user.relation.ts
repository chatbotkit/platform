import prisma from '@/prisma/client'
import type { User } from '@/prisma/types'

/**
 * Retrieves users related to the given user. A related user is defined as a
 * user who is a parent, child, or sibling of the given user.
 */
export async function getRelatedUsers(
  user: Pick<User, 'id'>
): Promise<Pick<User, 'id'>[]> {
  const foundUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },

    select: {
      id: true,

      parent: {
        select: {
          id: true,
          children: { select: { id: true } },
        },
      },

      children: { select: { id: true } },
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  return [
    ...(foundUser?.parent?.id ? [{ id: foundUser.parent.id }] : []),
    ...(foundUser?.parent?.children || []),
    ...(foundUser?.children || []),
  ].filter((u) => u.id !== user.id)
}
