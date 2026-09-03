// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'

/**
 * Locate a user by various identifiers. This method should be only used for
 * admin purposes.
 */
export async function findUser(identifier) {
  identifier = identifier.replace(/\s+/g, '').trim()

  debug(`locating ${identifier}`)

  let foundUser

  switch (true) {
    case identifier.startsWith('user@'): {
      debug(`locating by user`)

      const user = await prisma.user.findUnique({
        where: {
          id: identifier.substring('user@'.length),
        },
      })

      debug(`found user`, foundUser)

      foundUser = user

      break
    }

    case identifier.startsWith('bot@'): {
      debug(`locating by bot`)

      const bot = await prisma.bot.findUnique({
        where: {
          id: identifier.substring('bot@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found bot`, bot)

      foundUser = bot?.user

      break
    }

    case identifier.startsWith('dataset@'): {
      debug(`locating by dataset`)

      const dataset = await prisma.dataset.findUnique({
        where: {
          id: identifier.substring('dataset@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found dataset`, dataset)

      foundUser = dataset?.user

      break
    }

    case identifier.startsWith('record@'): {
      // @note record lookup is no longer supported since records are now stored
      // in the vector service and not in the database
      throw new Error(
        `Record lookup by ID is no longer supported. Use dataset@ prefix instead.`
      )
    }

    case identifier.startsWith('skillset@'): {
      debug(`locating by skillset`)

      const skillset = await prisma.skillset.findUnique({
        where: {
          id: identifier.substring('skillset@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found skillset`, skillset)

      foundUser = skillset?.user

      break
    }

    case identifier.startsWith('ability@'): {
      debug(`locating by ability`)

      const ability = await prisma.ability.findUnique({
        where: {
          id: identifier.substring('ability@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found ability`, ability)

      foundUser = ability?.user

      break
    }

    case identifier.startsWith('file@'): {
      debug(`locating by file`)

      const file = await prisma.file.findUnique({
        where: {
          id: identifier.substring('file@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found file`, file)

      foundUser = file?.user

      break
    }

    case identifier.startsWith('secret@'): {
      debug(`locating by secret`)

      const secret = await prisma.secret.findUnique({
        where: {
          id: identifier.substring('secret@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found secret`, secret)

      foundUser = secret?.user

      break
    }

    case identifier.startsWith('blueprint@'): {
      debug(`locating by blueprint`)

      const blueprint = await prisma.blueprint.findUnique({
        where: {
          id: identifier.substring('blueprint@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found blueprint`, blueprint)

      foundUser = blueprint?.user

      break
    }

    case identifier.startsWith('portal@'): {
      debug(`locating by portal`)

      const portal = await prisma.portal.findUnique({
        where: {
          id: identifier.substring('portal@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found portal`, portal)

      foundUser = portal?.user

      break
    }

    case identifier.startsWith('sitemapIntegration@'): {
      debug(`locating by sitemapIntegration`)

      const sitemapIntegration = await prisma.sitemapIntegration.findUnique({
        where: {
          id: identifier.substring('sitemapIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`sitemapIntegration`, sitemapIntegration)

      foundUser = sitemapIntegration?.user

      break
    }

    case identifier.startsWith('notionIntegration@'): {
      debug(`locating by notionIntegration`)

      const notionIntegration = await prisma.notionIntegration.findUnique({
        where: {
          id: identifier.substring('notionIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found notionIntegration`, notionIntegration)

      foundUser = notionIntegration?.user

      break
    }

    case identifier.startsWith('widgetIntegration@'): {
      debug(`locating by widgetIntegration`)

      const widgetIntegration = await prisma.widgetIntegration.findUnique({
        where: {
          id: identifier.substring('widgetIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found widgetIntegration`, widgetIntegration)

      foundUser = widgetIntegration?.user

      break
    }

    case identifier.startsWith('slackIntegration@'): {
      debug(`locating by slackIntegration`)

      const slackIntegration = await prisma.slackIntegration.findUnique({
        where: {
          id: identifier.substring('slackIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found slackIntegration`, slackIntegration)

      foundUser = slackIntegration?.user

      break
    }

    case identifier.startsWith('discordIntegration@'): {
      debug(`locating by discordIntegration`)

      const discordIntegration = await prisma.discordIntegration.findUnique({
        where: {
          id: identifier.substring('discordIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found discordIntegration`, discordIntegration)

      foundUser = discordIntegration?.user

      break
    }

    case identifier.startsWith('whatsappIntegration@'): {
      debug(`locating by whatsappIntegration`)

      const whatsappIntegration = await prisma.whatsappIntegration.findUnique({
        where: {
          id: identifier.substring('whatsappIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found whatsappIntegration`, whatsappIntegration)

      foundUser = whatsappIntegration?.user

      break
    }

    case identifier.startsWith('messengerIntegration@'): {
      debug(`locating by messengerIntegration`)

      const messengerIntegration = await prisma.messengerIntegration.findUnique(
        {
          where: {
            id: identifier.substring('messengerIntegration@'.length),
          },

          include: {
            user: true,
          },
        }
      )

      debug(`found messengerIntegration`, messengerIntegration)

      foundUser = messengerIntegration?.user

      break
    }

    case identifier.startsWith('telegramIntegration@'): {
      debug(`locating by telegramIntegration`)

      const telegramIntegration = await prisma.telegramIntegration.findUnique({
        where: {
          id: identifier.substring('telegramIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found telegramIntegration`, telegramIntegration)

      foundUser = telegramIntegration?.user

      break
    }

    case identifier.startsWith('emailIntegration@'): {
      debug(`locating by emailIntegration`)

      const emailIntegration = await prisma.emailIntegration.findUnique({
        where: {
          id: identifier.substring('emailIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found emailIntegration`, emailIntegration)

      foundUser = emailIntegration?.user

      break
    }

    case identifier.startsWith('triggerIntegration@'): {
      debug(`locating by triggerIntegration`)

      const triggerIntegration = await prisma.triggerIntegration.findUnique({
        where: {
          id: identifier.substring('triggerIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found triggerIntegration`, triggerIntegration)

      foundUser = triggerIntegration?.user

      break
    }

    case identifier.startsWith('supportIntegration@'): {
      debug(`locating by supportIntegration`)

      const supportIntegration = await prisma.supportIntegration.findUnique({
        where: {
          id: identifier.substring('supportIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found supportIntegration`, supportIntegration)

      foundUser = supportIntegration?.user

      break
    }

    case identifier.startsWith('extractIntegration@'): {
      debug(`locating by extractIntegration`)

      const extractIntegration = await prisma.extractIntegration.findUnique({
        where: {
          id: identifier.substring('extractIntegration@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found extractIntegration`, extractIntegration)

      foundUser = extractIntegration?.user

      break
    }

    case identifier.startsWith('contact@'): {
      debug(`locating by contact`)

      const contact = await prisma.contact.findUnique({
        where: {
          id: identifier.substring('contact@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found contact`, contact)

      foundUser = contact?.user

      break
    }

    case identifier.startsWith('task@'): {
      debug(`locating by task`)

      const task = await prisma.task.findUnique({
        where: {
          id: identifier.substring('task@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found task`, task)

      foundUser = task?.user

      break
    }

    case identifier.startsWith('conversation@'): {
      debug(`locating by conversation`)

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: identifier.substring('conversation@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found conversation`, conversation)

      foundUser = conversation?.user

      break
    }

    case identifier.startsWith('message@'): {
      debug(`locating by message`)

      const message = await prisma.message.findUnique({
        where: {
          id: identifier.substring('message@'.length),
        },

        include: {
          conversation: {
            include: {
              user: true,
            },
          },
        },
      })

      debug(`found message`, message)

      foundUser = message?.conversation?.user

      break
    }

    case identifier.startsWith('rating@'): {
      debug(`locating by rating`)

      const rating = await prisma.rating.findUnique({
        where: {
          id: identifier.substring('rating@'.length),
        },

        include: {
          user: true,
        },
      })

      debug(`found rating`, rating)

      foundUser = rating?.user

      break
    }

    case identifier.includes('@'): {
      if (identifier.includes('*')) {
        foundUser = await prisma.user.findFirst({
          where: {
            email: {
              contains: identifier.replaceAll('*', '%'),
            },
          },
        })
      } else {
        foundUser = await prisma.user.findUnique({
          where: {
            email: identifier,
          },
        })
      }

      break
    }

    default: {
      foundUser = await prisma.user.findUnique({
        where: {
          id: identifier,
        },
      })

      break
    }
  }

  return foundUser
}
