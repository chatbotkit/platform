import 'dotenv/config'

import { timePlusDays } from '@chatbotkit-dev/time'

import { emptyConversationRetentionDays } from '@/config/conversations'

import prisma from '@/prisma/client'

import { deleteConversation } from '@/lib/conversation.delete'
import { error } from '@/lib/debug'
import { runTasksEach } from '@/lib/job'
import { confirm, log, runScript } from '@/lib/script'

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_MAX_WORKERS = 10
const MAX_BATCH_SIZE = 1000
const MAX_WORKERS = 50

/**
 * Delete expired and/or empty conversations in bounded chunks.
 *
 * Usage:
 * ```bash
 * pnpm script:cleanup-conversations
 * pnpm script:cleanup-conversations --kind expired
 * pnpm script:cleanup-conversations --kind empty --batchSize 250 --workers 20
 * pnpm script:cleanup-conversations --kind both --dryRun
 * ```
 *
 * Notes:
 * - `expired` conversations are selected by `expiresAt <= now()`.
 * - `empty` conversations are selected by `createdAt <= retention cutoff` and
 *   `messages.none({})`.
 * - The script reads a fixed chunk at a time and deletes each chunk before
 *   fetching the next one. This avoids loading the entire cleanup set into
 *   memory and works safely with conversation deletion side effects.
 * - `dryRun` previews the first chunk for each selected cleanup mode without
 *   deleting anything.
 */
runScript({
  name: 'cleanup-conversations',
  description: 'Delete expired and/or empty conversations in chunks',
  options: {
    kind: {
      type: 'string',
      short: 'k',
      description: 'Cleanup mode: expired, empty, or both',
      default: 'both',
    },
    batchSize: {
      type: 'string',
      short: 'b',
      description: 'Number of conversations to fetch per chunk',
      default: String(DEFAULT_BATCH_SIZE),
    },
    workers: {
      type: 'string',
      short: 'w',
      description: 'Maximum number of concurrent deletions per chunk',
      default: String(DEFAULT_MAX_WORKERS),
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview the first chunk without deleting anything',
    },
  },
  handler: async ({ kind, batchSize, workers, dryRun }) => {
    const cleanupKind = parseCleanupKind(kind)
    const chunkSize = parseBoundedInteger(
      batchSize,
      'batchSize',
      MAX_BATCH_SIZE
    )
    const maxWorkers = parseBoundedInteger(workers, 'workers', MAX_WORKERS)

    const emptyConversationCutoff = timePlusDays(
      -emptyConversationRetentionDays
    )

    assertCutoffInPast(emptyConversationCutoff)

    const plans = {
      expired: {
        label: 'expired',
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
        orderBy: [
          {
            expiresAt: 'asc',
          },
        ],
        select: {
          id: true,
          expiresAt: true,
        },
        assertConversation: (conversation) => {
          if (!conversation.expiresAt || conversation.expiresAt > new Date()) {
            throw new Error(
              `conversation ${conversation.id} expiresAt must be before current date`
            )
          }
        },
      },
      empty: {
        label: 'empty',
        where: {
          createdAt: {
            lte: emptyConversationCutoff,
          },
          messages: {
            none: {},
          },
        },
        orderBy: [
          {
            createdAt: 'asc',
          },
        ],
        select: {
          id: true,
          createdAt: true,
        },
        assertConversation: (conversation) => {
          if (conversation.createdAt > emptyConversationCutoff) {
            throw new Error(
              `conversation ${conversation.id} createdAt must be before cutoff`
            )
          }
        },
      },
    }

    const selectedPlans =
      cleanupKind === 'both'
        ? [plans.expired, plans.empty]
        : [plans[cleanupKind]]

    const previews = await Promise.all(
      selectedPlans.map(async (plan) => {
        const conversations = await prisma.conversation.findMany({
          where: plan.where,
          orderBy: plan.orderBy,
          select: plan.select,
          take: chunkSize,
        })

        return {
          ...plan,
          conversations,
        }
      })
    )

    const previewedTotal = previews.reduce(
      (sum, item) => sum + item.conversations.length,
      0
    )

    for (const item of previews) {
      if (item.conversations.length === 0) {
        continue
      }

      log(
        `found ${item.conversations.length} ${item.label} conversations ready for cleanup in the first chunk`
      )
    }

    if (cleanupKind === 'empty' || cleanupKind === 'both') {
      log(`empty conversation cutoff: ${emptyConversationCutoff.toISOString()}`)
    }

    if (previewedTotal === 0) {
      log('no conversations found for cleanup')

      return
    }

    if (dryRun) {
      log('dry run enabled, no conversations were deleted')

      return
    }

    const confirmed = await confirm(
      `Do you really want to start deleting ${describeCleanupTarget(cleanupKind)} using ${chunkSize}-item chunks and ${maxWorkers} workers?`
    )

    if (!confirmed) {
      log('aborted')

      return
    }

    let deletedTotal = 0

    for (const item of previews) {
      if (item.conversations.length === 0) {
        continue
      }

      const deleted = await cleanupConversations({
        label: item.label,
        where: item.where,
        orderBy: item.orderBy,
        select: item.select,
        assertConversation: item.assertConversation,
        chunkSize,
        maxWorkers,
        initialConversations: item.conversations,
      })

      deletedTotal += deleted

      log(`deleted ${deleted} ${item.label} conversations`)
    }

    log(`deleted ${deletedTotal} conversations in total`)
  },
})

function parseCleanupKind(value) {
  const normalized = String(value || 'both')
    .trim()
    .toLowerCase()

  if (
    normalized === 'expired' ||
    normalized === 'empty' ||
    normalized === 'both'
  ) {
    return normalized
  }

  throw new Error(`Invalid kind: ${value}. Expected expired, empty, or both.`)
}

function parseBoundedInteger(value, name, max) {
  const parsed = Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  if (parsed > max) {
    throw new Error(`${name} must not exceed ${max}`)
  }

  return parsed
}

function assertCutoffInPast(cutoff) {
  if (cutoff >= new Date()) {
    throw new Error(
      `Empty conversation cutoff ${cutoff.toISOString()} is not in the past, aborting`
    )
  }
}

async function cleanupConversations({
  label,
  where,
  orderBy,
  select,
  assertConversation,
  chunkSize,
  maxWorkers,
  initialConversations,
}) {
  let deleted = 0
  let conversations = initialConversations || []

  while (true) {
    if (conversations.length === 0) {
      conversations = await prisma.conversation.findMany({
        where,
        orderBy,
        select,
        take: chunkSize,
      })
    }

    if (conversations.length === 0) {
      break
    }

    log(
      `processing ${conversations.length} ${label} conversations starting with ${conversations[0].id}`
    )

    let deletedInChunk = 0
    let failedInChunk = 0

    await runTasksEach(maxWorkers, conversations, async (conversation) => {
      try {
        assertConversation(conversation)

        await deleteConversation(conversation.id)

        deletedInChunk += 1
      } catch (e) {
        failedInChunk += 1

        error(`cannot delete conversation ${conversation.id}`, e)
      }
    })

    deleted += deletedInChunk

    if (failedInChunk > 0) {
      log(
        `${failedInChunk} ${label} conversations failed to delete in this chunk`
      )
    }

    log(`deleted ${deleted} ${label} conversations so far`)

    if (conversations.length < chunkSize) {
      break
    }

    conversations = []
  }

  return deleted
}

function describeCleanupTarget(cleanupKind) {
  if (cleanupKind === 'both') {
    return 'expired and empty conversations'
  }

  return `${cleanupKind} conversations`
}
