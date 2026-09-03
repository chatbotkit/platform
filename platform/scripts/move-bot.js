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

async function moveResourceWhere(crud, where, userId) {
  if (Object.values(where).some((value) => !value)) {
    throw new Error(`Invalid where ${where}`)
  }

  if (!userId) {
    throw new Error(`Invalid userId ${userId}`)
  }

  const op = {
    where: where,

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

  await crud.updateMany(op)
}

/**
 * Move a bot and all its related resources to a different user.
 *
 * Usage:
 * ```bash
 * pnpm script:move-bot                           # Interactive mode
 * pnpm script:move-bot --botId bot123            # CLI mode (prompts for userId)
 * pnpm script:move-bot -b bot123 -u user456      # Full CLI mode
 * DRY_RUN=1 pnpm script:move-bot -b bot123       # Dry run mode
 * ```
 *
 * This script moves the bot and all related resources including:
 * - Dataset and its integrations (sitemap, notion)
 * - Skillset
 * - All integration types (widget, slack, discord, whatsapp, etc.)
 * - All conversations
 */
runScript({
  name: 'move-bot',
  description: 'Move a bot to a different user',
  options: {
    botId: {
      type: 'string',
      short: 'b',
      description: 'Bot ID to move',
      message: 'What is the id of the bot you want to move?',
      required: true,
    },
    userId: {
      type: 'string',
      short: 'u',
      description: 'User ID to move the bot to',
      message: 'What is the id of the user you want to move the bot to?',
      required: true,
    },
  },
  handler: async ({ botId, userId }) => {
    if (process.env.DRY || process.env.DRY_RUN) {
      log('running in dry mode')
    }

    const bot = await prisma.bot.findUnique({
      where: {
        id: botId,
      },

      include: {
        dataset: {
          include: {
            sitemapIntegrations: true,
            notionIntegrations: true,

            files: {
              include: {
                file: true,
              },
            },
          },
        },

        skillset: true,

        widgetIntegrations: {
          include: {
            files: {
              include: {
                file: true,
              },
            },
          },
        },

        slackIntegrations: true,
        discordIntegrations: true,
        whatsappIntegrations: true,
        messengerIntegrations: true,
        telegramIntegrations: true,
        supportIntegrations: true,
        extractIntegrations: true,
      },
    })

    if (!bot) {
      log(`invalid bot ${botId}`)

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

    // move the bot
    {
      log(`moving bot`, { name: bot.name })

      await moveResource(prisma.bot, { id: botId }, user.id)
    }

    // moving dataset
    if (bot.dataset) {
      log(`moving dataset`, { name: bot.dataset.name })

      await moveResource(prisma.dataset, bot.dataset, user.id)

      // moving dataset sitemap integrations
      if (bot.dataset.sitemapIntegrations.length) {
        log(`moving dataset sitemap integrations`)

        for (const sitemapIntegration of bot.dataset.sitemapIntegrations) {
          log(`moving dataset sitemap integration`, {
            name: sitemapIntegration.name,
          })

          await moveResource(
            prisma.sitemapIntegration,
            sitemapIntegration,
            userId
          )
        }
      }

      // moving dataset notion integrations
      if (bot.dataset.notionIntegrations.length) {
        log(`moving dataset notion integrations`)

        for (const notionIntegration of bot.dataset.notionIntegrations) {
          log(`moving dataset notion integration`, {
            name: notionIntegration.name,
          })

          await moveResource(
            prisma.notionIntegration,
            notionIntegration,
            user.id
          )
        }
      }

      // moving dataset files
      if (bot.dataset.files.length) {
        log(`moving dataset files`)

        for (const fileAttachment of bot.dataset.files) {
          log(`moving dataset file`, {
            name: fileAttachment.file.name,
          })

          await moveResource(prisma.file, fileAttachment.file, user.id)
        }
      }
    }

    // move skillset
    if (bot.skillset) {
      log(`moving skillset`, { name: bot.skillset.name })

      await moveResource(prisma.skillset, bot.skillset, user.id)
    }

    // move widget integrations
    if (bot.widgetIntegrations.length) {
      log(`moving widget integrations`)

      for (const widgetIntegration of bot.widgetIntegrations) {
        log(`moving widget integration`, { name: widgetIntegration.name })

        await moveResource(prisma.widgetIntegration, widgetIntegration, user.id)

        // moving widget integration files
        if (widgetIntegration.files.length) {
          log(`moving widget integration files`)

          for (const fileAttachment of widgetIntegration.files) {
            log(`moving widget integration file`, {
              name: fileAttachment.file.name,
            })

            await moveResource(prisma.file, fileAttachment.file, user.id)
          }
        }
      }
    }

    // moving slack integrations
    if (bot.slackIntegrations.length) {
      log(`moving slack integrations`)

      for (const slackIntegration of bot.slackIntegrations) {
        log(`moving slack integration`, { name: slackIntegration.name })

        await moveResource(prisma.slackIntegration, slackIntegration, user.id)
      }
    }

    // moving discord integrations
    if (bot.discordIntegrations.length) {
      log(`moving discord integrations`)

      for (const discordIntegration of bot.discordIntegrations) {
        log(`moving discord integration`, { name: discordIntegration.name })

        await moveResource(
          prisma.discordIntegration,
          discordIntegration,
          user.id
        )
      }
    }

    // moving whatsapp integrations
    if (bot.whatsappIntegrations.length) {
      log(`moving whatsapp integrations`)

      for (const whatsappIntegration of bot.whatsappIntegrations) {
        log(`moving whatsapp integration`, { name: whatsappIntegration.name })

        await moveResource(
          prisma.whatsappIntegration,
          whatsappIntegration,
          user.id
        )
      }
    }

    // moving messenger integrations
    if (bot.messengerIntegrations.length) {
      log(`moving messenger integrations`)

      for (const messengerIntegration of bot.messengerIntegrations) {
        log(`moving messenger integration`, {
          name: messengerIntegration.name,
        })

        await moveResource(
          prisma.messengerIntegration,
          messengerIntegration,
          user.id
        )
      }
    }

    // moving messenger integrations
    if (bot.telegramIntegrations.length) {
      log(`moving telegram integrations`)

      for (const telegramIntegration of bot.telegramIntegrations) {
        log(`moving telegram integration`, {
          name: telegramIntegration.name,
        })

        await moveResource(
          prisma.telegramIntegration,
          telegramIntegration,
          user.id
        )
      }
    }

    // moving support integrations
    if (bot.supportIntegrations.length) {
      log(`moving support integrations`)

      for (const supportIntegration of bot.supportIntegrations) {
        log(`moving support integration`, { name: supportIntegration.name })

        await moveResource(
          prisma.supportIntegration,
          supportIntegration,
          user.id
        )
      }
    }

    // moving extract integrations
    if (bot.extractIntegrations.length) {
      log(`moving extract integrations`)

      for (const extractIntegration of bot.extractIntegrations) {
        log(`moving extract integration`, { name: extractIntegration.name })

        await moveResource(
          prisma.extractIntegration,
          extractIntegration,
          user.id
        )
      }
    }

    // moving conversations
    {
      log(`moving conversations`)

      await moveResourceWhere(prisma.conversation, { botId: bot.id }, user.id)
    }

    log(`done`)
  },
})
