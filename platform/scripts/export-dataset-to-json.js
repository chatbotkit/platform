import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'
import { getStore } from '@/lib/store.types'

import fs from 'fs/promises'

/**
 * Export dataset records to JSON.
 *
 * Usage:
 * ```bash
 * pnpm script:export-dataset-to-json                      # Interactive mode
 * pnpm script:export-dataset-to-json --datasetId ds123    # CLI mode
 * ```
 */
runScript({
  name: 'export-dataset-to-json',
  description: 'Export dataset records to JSON',
  options: {
    datasetId: {
      type: 'string',
      short: 'd',
      description: 'Dataset ID to export',
      message: 'What is the dataset id you want to export?',
      required: true,
    },
  },
  handler: async ({ datasetId }) => {
    log(`locating dataset ${datasetId}`)

    const dataset = await prisma.dataset.findUnique({
      where: {
        id: datasetId,
      },
    })

    if (!dataset) {
      log(`dataset not found`)

      return
    }

    log(`dataset found`)

    const store = await getStore()

    const records = []

    let cursor = undefined

    while (true) {
      const result = await store.listRecords({
        datasetId: dataset.id,
        cursor,
        limit: 100,
      })

      for (const record of result.records) {
        records.push({
          recordId: record.id,

          text: record.text,

          createdAt: record.createdAt,
          updatedAt: record.updatedAt,

          meta: record.meta,
        })
      }

      if (!result.nextCursor) {
        break
      }

      cursor = result.nextCursor
    }

    await fs.writeFile(
      `${datasetId}.json`,
      JSON.stringify(
        {
          userId: dataset.userId,
          datasetId: dataset.id,

          name: dataset.name,
          description: dataset.description,

          meta: dataset.meta,

          records,
        },
        null,
        2
      )
    )
  },
})
