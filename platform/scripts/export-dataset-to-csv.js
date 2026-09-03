import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'
import { getStore } from '@/lib/store.types'

import { stringify } from 'csv-stringify'
import fs from 'node:fs'

/**
 * Export dataset records to CSV.
 *
 * Usage:
 * ```bash
 * pnpm script:export-dataset-to-csv                     # Interactive mode
 * pnpm script:export-dataset-to-csv --datasetId ds123   # CLI mode
 * ```
 */
runScript({
  name: 'export-dataset-to-csv',
  description: 'Export dataset records to CSV',
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

    const stringifier = stringify({
      delimiter: ',',
    })

    stringifier.pipe(fs.createWriteStream(`${datasetId}.csv`))

    stringifier.write([
      'userId',
      'datasetId',
      'recordId',
      'text',
      'createdAt',
      'updatedAt',
      'meta',
    ])

    let cursor = undefined

    while (true) {
      const result = await store.listRecords({
        datasetId: dataset.id,
        cursor,
        limit: 100,
      })

      for (const record of result.records) {
        stringifier.write([
          dataset.userId,
          dataset.id,
          record.id,
          record.text,
          record.createdAt,
          record.updatedAt,
          JSON.stringify(record.meta),
        ])
      }

      if (!result.nextCursor) {
        break
      }

      cursor = result.nextCursor
    }

    stringifier.end()

    await new Promise(function (resolve) {
      stringifier.on('finish', () => {
        resolve(null)
      })
    })
  },
})
