import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

async function moveResource(crud, { id }, userId) {
  if (!id) {
    throw new Error(`Invalid id ${id}`)
  }

  if (!userId) {
    throw new Error(`Invalid userId ${userId}`)
  }

  const op = {
    where: {
      id: id,
    },

    data: {
      userId: userId,
    },
  }

  log('performing op', crud.name, 'UPDATE', op)

  if (process.env.DRY || process.env.DRY_RUN) {
    log('the operation will affect', {
      records: await crud.count({
        where: op.where,
      }),
    })

    return
  }

  await crud.update(op)
}

/**
 * Move a dataset to a different user.
 *
 * Usage:
 * ```bash
 * pnpm script:move-dataset                           # Interactive mode
 * pnpm script:move-dataset -d ds123 -u user456       # CLI mode
 * DRY_RUN=1 pnpm script:move-dataset -d ds123        # Dry run mode
 * ```
 *
 * This script moves the dataset and all related resources including:
 * - Sitemap integrations
 * - Notion integrations
 * - Files
 */
runScript({
  name: 'move-dataset',
  description: 'Move a dataset to a different user',
  options: {
    datasetId: {
      type: 'string',
      short: 'd',
      description: 'Dataset ID to move',
      message: 'What is the id of the dataset you want to move?',
      required: true,
    },
    userId: {
      type: 'string',
      short: 'u',
      description: 'User ID to move the dataset to',
      message: 'What is the id of the user you want to move the dataset to?',
      required: true,
    },
  },
  handler: async ({ datasetId, userId }) => {
    if (process.env.DRY || process.env.DRY_RUN) {
      log('running in dry mode')
    }

    const dataset = await prisma.dataset.findUnique({
      where: {
        id: datasetId,
      },

      include: {
        sitemapIntegrations: true,
        notionIntegrations: true,

        files: {
          include: {
            file: true,
          },
        },
      },
    })

    if (!dataset) {
      log(`invalid dataset ${datasetId}`)

      return
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    })

    if (!user) {
      log(`invalid user ${userId}`)

      return
    }

    // move the dataset
    {
      log(`moving dataset`, { name: dataset.name })

      await moveResource(prisma.dataset, { id: datasetId }, user.id)
    }

    // moving dataset sitemap integrations
    if (dataset.sitemapIntegrations.length) {
      log(`moving dataset sitemap integrations`)

      for (const sitemapIntegration of dataset.sitemapIntegrations) {
        log(`moving dataset sitemap integration`, {
          name: sitemapIntegration.name,
        })

        await moveResource(
          prisma.sitemapIntegration,
          sitemapIntegration,
          user.id
        )
      }
    }

    // moving dataset notion integrations
    if (dataset.notionIntegrations.length) {
      log(`moving dataset notion integrations`)

      for (const notionIntegration of dataset.notionIntegrations) {
        log(`moving dataset notion integration`, {
          name: notionIntegration.name,
        })

        await moveResource(prisma.notionIntegration, notionIntegration, user.id)
      }
    }

    // moving dataset files
    if (dataset.files.length) {
      log(`moving dataset files`)

      for (const fileAttachment of dataset.files) {
        log(`moving dataset file`, {
          name: fileAttachment.file.name,
        })

        await moveResource(prisma.file, fileAttachment.file, user.id)
      }
    }

    log(`done`)
  },
})
