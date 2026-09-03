import 'dotenv/config'

import prisma from '@/prisma/client'

import { deleteDataset } from '@/lib/dataset.delete'
import { assert } from '@/lib/debug'
import { confirm, log, runScript } from '@/lib/script'

/**
 * Delete a dataset by ID.
 *
 * Usage:
 * ```bash
 * pnpm script:delete-dataset                    # Interactive mode
 * pnpm script:delete-dataset --datasetId ds123  # CLI mode (still prompts for confirmation)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'delete-dataset',
  description: 'Delete a dataset by ID',
  options: {
    datasetId: {
      type: 'string',
      short: 'd',
      description: 'Dataset ID to delete',
      message: 'What is the datasetId?',
      required: true,
    },
  },
  handler: async ({ datasetId }) => {
    log(`locating dataset ${datasetId}`)

    const dataset = await prisma.dataset.findUnique({
      where: {
        id: datasetId,
      },

      include: {
        _count: {
          include: {
            conversations: true,
          },
        },
      },
    })

    if (dataset) {
      log(`dataset found`, { dataset })
    } else {
      log(`dataset not found`)

      return
    }

    const confirmed = await confirm(
      `Do you really want to delete dataset ${datasetId}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    assert(dataset.id, 'dataset id is not empty')

    await deleteDataset(dataset)
  },
})
