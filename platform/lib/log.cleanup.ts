import { timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { batchAsync } from '@/lib/it'

export async function cleanupOldEventLogs(options?: {
  cutoffDays?: number
  onProgress?: (progress: { deleted: number; total: number }) => Promise<void>
}) {
  const cutoff = timePlusDays(-(options?.cutoffDays ?? 365))

  if (cutoff > new Date()) {
    throw new Error('Cutoff date must be in the past')
  }

  const total = await prisma.eventLog.count({
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

  const it = prisma.eventLog.paginate({
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

    await prisma.eventLog.deleteMany({
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

export async function cleanupOldEventMetrics(options?: {
  cutoffDays?: number
  onProgress?: (progress: { deleted: number; total: number }) => Promise<void>
}) {
  const cutoff = timePlusDays(-(options?.cutoffDays ?? 90))

  if (cutoff > new Date()) {
    throw new Error('Cutoff date must be in the past')
  }

  const total = await prisma.eventMetric.count({
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

  const it = prisma.eventMetric.paginate({
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

    await prisma.eventMetric.deleteMany({
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

export async function cleanupOldAuditLogs(options?: {
  cutoffDays?: number
  onProgress?: (progress: { deleted: number; total: number }) => Promise<void>
}) {
  const cutoff = timePlusDays(-(options?.cutoffDays ?? 2555)) // @note audit logs typically need longer retention for compliance (7 years)

  if (cutoff > new Date()) {
    throw new Error('Cutoff date must be in the past')
  }

  const total = await prisma.auditLog.count({
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

  const it = prisma.auditLog.paginate({
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

    await prisma.auditLog.deleteMany({
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
