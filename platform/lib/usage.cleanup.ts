import { timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { batchAsync } from '@/lib/it'

export async function cleanupOldUsageRecords(options?: {
  cutoffDays?: number
  onProgress?: (progress: { deleted: number; total: number }) => Promise<void>
}) {
  const cutoff = timePlusDays(-(options?.cutoffDays ?? 180))

  if (cutoff > new Date()) {
    throw new Error('Cutoff date must be in the past')
  }

  const total = await prisma.usage.count({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  })

  if (total === 0) {
    return
  }

  let deleted = 0

  if (options?.onProgress) {
    await options.onProgress({ deleted, total })
  }

  const it = prisma.usage.paginate({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },

    select: {
      id: true,
    },

    take: 1000,
  })

  for await (const batch of batchAsync(it, 500)) {
    const idsToDelete = batch.slice(0, -1).map(({ id }) => id) // @note we need to leave one record to keep the cursor valid

    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await prisma.usage.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    })

    deleted += batch.length

    if (options?.onProgress) {
      await options.onProgress({ deleted, total })
    }
  }
}
