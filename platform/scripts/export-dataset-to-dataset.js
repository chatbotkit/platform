import 'dotenv/config'

import prisma from '@/prisma/client'

import { createRecord } from '@/lib/record'
import { confirm, log, runScript } from '@/lib/script'
import { getStore } from '@/lib/store.types'

/**
 * Export records from one dataset to another.
 *
 * Usage:
 * ```bash
 * pnpm script:export-dataset-to-dataset                      # Interactive mode
 * pnpm script:export-dataset-to-dataset -s src123 -d dst456  # CLI mode
 * ```
 */
runScript({
  name: 'export-dataset-to-dataset',
  description: 'Export records from one dataset to another',
  options: {
    sourceDatasetId: {
      type: 'string',
      short: 's',
      description: 'Source dataset ID',
      message: 'What is the source dataset id?',
      required: true,
    },
    destinationDatasetId: {
      type: 'string',
      short: 'd',
      description: 'Destination dataset ID',
      message: 'What is the destination dataset id?',
      required: true,
    },
  },
  handler: async ({ sourceDatasetId, destinationDatasetId }) => {
    log(`locating source dataset ${sourceDatasetId}`)

    const sourceDataset = await prisma.dataset.findUnique({
      where: {
        id: sourceDatasetId,
      },
    })

    if (!sourceDataset) {
      log(`source dataset not found`)

      return
    }

    log(
      `source dataset ${sourceDataset.id} (${JSON.stringify(
        sourceDataset.name
      )}) found`
    )

    log(`locating destination dataset ${destinationDatasetId}`)

    const destinationDataset = await prisma.dataset.findUnique({
      where: {
        id: destinationDatasetId,
      },
    })

    if (!destinationDataset) {
      log(`destination dataset not found`)

      return
    }

    log(
      `destination dataset ${destinationDataset.id} (${JSON.stringify(
        destinationDataset.name
      )}) found`
    )

    const confirmed = await confirm(
      `Do you really want to export dataset ${
        sourceDataset.id
      } (${JSON.stringify(sourceDataset.name)}) to dataset ${
        destinationDataset.id
      } (${JSON.stringify(destinationDataset.name)})?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    const sourceStore = await getStore()
    const destStore = await getStore()

    let cursor = undefined

    while (true) {
      const result = await sourceStore.listRecords({
        datasetId: sourceDataset.id,
        cursor,
        limit: 100,
      })

      for (const record of result.records) {
        await createRecord({
          store: destStore,
          datasetId: destinationDataset.id,
          text: record.text,
          meta: record.meta,
        })
      }

      if (!result.nextCursor) {
        break
      }

      cursor = result.nextCursor
    }
  },
})
