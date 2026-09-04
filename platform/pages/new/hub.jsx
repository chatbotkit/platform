import { useContext, useEffect } from 'react'

import demos from '@/data/demos.yaml'

import prisma from '@/prisma/client'

import { makeJsonSafe } from '@/lib/struct'
import { buildTheme } from '@/lib/theme'

import Wizard, { wizardContext } from '@/layouts/Wizard'
import { Heading, NavigationButtons } from '@/layouts/Wizard'

import DynamicIcon from '@/components/DynamicIcon'
import List, { ListItem } from '@/components/List'

export default function Page({ instance }) {
  const { setOptions } = useContext(wizardContext)

  useEffect(() => {
    setOptions((prev) => {
      return {
        ...prev,

        instance: {
          type: instance.type,
          ref: instance.ref,
        },
      }
    })
  }, [instance, setOptions])

  return (
    <>
      <Heading
        title="Select a hub resource"
        description="We use this information to tailor your chatbot capabilities and look and feel."
      />
      <div>
        <List>
          <ListItem
            className="cursor-default"
            icon={
              <DynamicIcon
                className="w-16 h-16 text-6xl pt-2"
                icon={instance.icon || '🤖'}
              />
            }
            title={instance.title}
            body={instance.description}
          />
        </List>
      </div>
      <NavigationButtons />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Create Solution"
      title="Hub"
      description="We use this information to tailor your chatbot capabilities and look and feel."
    >
      {children}
    </Wizard>
  )
}

export async function getServerSideProps(context) {
  let instance

  if (context.query.botId) {
    const page = await prisma.hubBotPage.findFirst({
      where: {
        OR: [{ id: context.query.botId }, { slug: context.query.botId }],
      },

      select: {
        name: true,
        description: true,

        slug: true,
        icon: true,

        bot: {
          select: {
            backstory: true,

            model: true,

            privacy: true,
            moderation: true,

            widgetIntegrations: {
              select: {
                title: true,

                intro: true,

                theme: true,

                // @todo add more options here
              },

              take: 1,
            },
          },
        },
      },
    })

    if (page) {
      if (page.bot) {
        page.bot.widget = page.bot.widgetIntegrations[0]

        delete page.bot.widgetIntegrations

        if (page.bot.widget?.theme) {
          page.bot.widget.theme =
            typeof page.bot.widget.theme === 'string'
              ? page.bot.widget.theme
              : buildTheme(
                  page.bot.widget.theme.name,
                  page.bot.widget.theme.config
                )
        }

        instance = {
          type: 'bot',

          icon: page.icon,
          title: page.name,
          description: page.description,

          // @note the bot itself carries no name - it is the hub page that is
          // named, and the clone (and the project wrapping it) inherits that
          ref: {
            name: page.name,
            description: page.description,

            ...page.bot,
          },
        }
      }
    }
  }

  if (context.query.blueprintId) {
    const page = await prisma.hubBlueprintPage.findFirst({
      where: {
        OR: [
          { id: context.query.blueprintId },
          { slug: context.query.blueprintId },
        ],
      },

      select: {
        name: true,
        description: true,

        icon: true,

        blueprint: {
          select: {
            id: true,

            name: true,
            description: true,
          },
        },
      },
    })

    if (page?.blueprint) {
      instance = {
        type: 'blueprint',

        icon: page.icon,
        title: page.name,
        description: page.description,

        ref: page.blueprint,
      }
    }
  }

  if (context.query.widgetId) {
    const page = await prisma.hubWidgetPage.findFirst({
      where: {
        OR: [{ id: context.query.widgetId }, { slug: context.query.widgetId }],
      },

      select: {
        name: true,
        description: true,

        icon: true,

        widget: {
          select: {
            title: true,
            intro: true,
            initial: true,
            theme: true,
          },
        },
      },
    })

    if (page?.widget) {
      // @note the hub page renders the widget over the default demo, so the
      // clone has to start from the same merge to reproduce what was shown
      const widget = { ...demos.default, ...page.widget }

      instance = {
        type: 'widget',

        icon: page.icon,
        title: page.name,
        description: page.description,

        ref: {
          name: page.name,
          description: page.description,

          title: widget.title,
          intro: widget.intro,
          initial: widget.initial,
          theme: widget.theme,
        },
      }
    }
  }

  if (context.query.datasetId) {
    const page = await prisma.hubDatasetPage.findFirst({
      where: {
        OR: [
          { id: context.query.datasetId },
          { slug: context.query.datasetId },
        ],
      },

      select: {
        name: true,
        description: true,

        icon: true,

        dataset: {
          select: {
            id: true,
          },
        },
      },
    })

    if (page?.dataset) {
      instance = {
        type: 'dataset',

        icon: page.icon,
        title: page.name,
        description: page.description,

        ref: {
          name: page.name,
          description: page.description,
        },
      }
    }
  }

  if (context.query.skillsetId) {
    const page = await prisma.hubSkillsetPage.findFirst({
      where: {
        OR: [
          { id: context.query.skillsetId },
          { slug: context.query.skillsetId },
        ],
      },

      select: {
        name: true,
        description: true,

        icon: true,

        skillset: {
          select: {
            abilities: {
              select: {
                name: true,
                description: true,

                instruction: true,
              },
            },
          },
        },
      },
    })

    if (page?.skillset) {
      instance = {
        type: 'skillset',

        icon: page.icon,
        title: page.name,
        description: page.description,

        ref: {
          name: page.name,
          description: page.description,

          abilities: page.skillset.abilities,
        },
      }
    }
  }

  if (!instance) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      instance,
    }),
  }
}
