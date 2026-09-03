import prisma from '@/prisma/client'
import type { Skillset } from '@/prisma/types'

export async function deleteSkillset(skillset: Pick<Skillset, 'id'>) {
  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { skillsetId: skillset.id },
      data: { skillsetId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.skillset.delete({
      where: { id: skillset.id },
    })
  })

  // @todo record audit log
}

export async function deleteManySkillsets(skillsets: Pick<Skillset, 'id'>[]) {
  if (skillsets.length === 0) {
    return
  }

  const skillsetIds = skillsets.map((skillset) => skillset.id)

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { skillsetId: { in: skillsetIds } },
      data: { skillsetId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.skillset.deleteMany({
      where: { id: { in: skillsetIds } },
    })
  })

  // @todo record audit log
}
