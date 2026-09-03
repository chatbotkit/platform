import prisma from '@/prisma/client'
import type { Space } from '@/prisma/types'

export async function deleteSpace(space: Pick<Space, 'id'>) {
  // @todo delete the bucket

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { spaceId: space.id },
      data: { spaceId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.space.delete({
      where: { id: space.id },
    })
  })

  // @todo record audit log
}

export async function deleteManySpaces(spaces: Pick<Space, 'id'>[]) {
  // @todo delete the buckets

  if (spaces.length === 0) {
    return
  }

  const spaceIds = spaces.map((space) => space.id)

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { spaceId: { in: spaceIds } },
      data: { spaceId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.space.deleteMany({
      where: { id: { in: spaceIds } },
    })
  })

  // @todo record audit log
}
