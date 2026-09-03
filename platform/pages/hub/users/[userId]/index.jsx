import hubConfig from '@/config/hub'
import { organization as organizationStructure } from '@/config/structures'

import prisma from '@/prisma/client'

import { text2emoji } from '@/lib/emoji'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import Emoji from '@/components/Emoji'
import Hero from '@/components/Hero'
import List, { ListItem } from '@/components/List'
import StructuredData from '@/components/StructuredData'

import { UserCircleIcon } from '@heroicons/react/24/solid'

import pluralize from 'pluralize'

export function PageHero({ user }) {
  return (
    <>
      <div className="bg-gray-white dark:bg-black">
        <Hero
          icon={
            user.image ||
            ((props) => {
              return <UserCircleIcon {...props} />
            })
          }
          splitTitle={user.name || 'Anonymous'}
          description={user.description}
        />
      </div>
    </>
  )
}

export default function Index({ items }) {
  return (
    <>
      <section className="section-gray-50">
        <div className="main-page">
          <List>
            {items.map(
              ({ type, id, name, description, slug, icon, createdAt }) => {
                name = name?.trim() || ''
                description = description?.trim() || ''

                return (
                  <ListItem
                    key={id}
                    link={`/hub/${pluralize(type, 2)}/${slug || id}`}
                    icon={
                      <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                        {text2emoji(
                          [icon, name, description],
                          'A bot without description'
                        )}
                      </Emoji>
                    }
                    title={name || id}
                    body={
                      description || (
                        <span className="italic">
                          A bot without description
                        </span>
                      )
                    }
                    timestamp={createdAt}
                  >
                    <span className="tag">{type}</span>
                  </ListItem>
                )
              }
            )}
          </List>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children, { user }) {
  return (
    <Hub
      breadcrumbs={['Users', 'Hub', 'ChatBotKit']}
      title={user.name || user.id}
      description={user.name || user.id} // @todo add better description
      // keywords="" // @todo add keywords
      image={`/hub/users/${user.id}/card`}
    >
      <PageHero user={user} />
      {children}
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: user.name || user.id,
            image: user.image,
            url: `/hub/users/${user.id}`,
            affiliation: {
              '@type': 'Organization',
              ...organizationStructure,
            },
          },
        }}
      />
    </Hub>
  )
}

export async function getServerSideProps(context) {
  const user = await prisma.user.findUnique({
    where: {
      id: context.query.userId,
    },

    select: {
      id: true,

      name: true,
      image: true,

      hubBotPages: {
        orderBy: [
          {
            rank: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],

        take: hubConfig.limits.take,

        select: {
          id: true,

          name: true,
          description: true,

          slug: true,

          icon: true,

          // createdAt: true,
        },
      },

      hubDatasetPages: {
        orderBy: [
          {
            rank: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc', // @note important for deterministic ordering
          },
        ],

        take: hubConfig.limits.take,

        select: {
          id: true,

          name: true,
          description: true,

          slug: true,

          icon: true,

          // createdAt: true,
        },
      },

      hubSkillsetPages: {
        orderBy: [
          {
            rank: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc', // @note important for deterministic ordering
          },
        ],

        take: hubConfig.limits.take,

        select: {
          id: true,

          name: true,
          description: true,

          slug: true,

          icon: true,

          // createdAt: true,
        },
      },

      hubBlueprintPages: {
        orderBy: [
          {
            rank: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc', // @note important for deterministic ordering
          },
        ],

        take: hubConfig.limits.take,

        select: {
          id: true,

          name: true,
          description: true,

          slug: true,

          icon: true,

          // createdAt: true,
        },
      },

      hubWidgetPages: {
        orderBy: [
          {
            rank: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc', // @note important for deterministic ordering
          },
        ],

        take: hubConfig.limits.take,

        select: {
          id: true,

          name: true,
          description: true,

          slug: true,

          icon: true,

          // createdAt: true,
        },
      },
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  if (!user) {
    return {
      notFound: true,
    }
  }

  if (
    !user.hubBotPages?.length &&
    !user.hubDatasetPages?.length &&
    !user.hubSkillsetPages?.length &&
    !user.hubBlueprintPages?.length &&
    !user.hubWidgetPages?.length
  ) {
    return {
      notFound: true,
    }
  }

  const bots = user.hubBotPages.map((page) => ({ ...page, type: 'bot' }))

  const datasets = user.hubDatasetPages.map((page) => ({
    ...page,
    type: 'dataset',
  }))

  const skillsets = user.hubDatasetPages.map((page) => ({
    ...page,
    type: 'skillset',
  }))

  const blueprints = user.hubBlueprintPages.map((page) => ({
    ...page,
    type: 'blueprint',
  }))

  const widgets = user.hubWidgetPages.map((page) => ({
    ...page,
    type: 'widget',
  }))

  delete user.bots
  delete user.datasets
  delete user.skillsets
  delete user.hubBlueprintPages
  delete user.hubWidgetPages

  return {
    props: makeJsonSafe({
      user,

      items: []
        .concat(
          bots.map((b) => ({ ...b, type: 'bot' })),
          datasets.map((d) => ({ ...d, type: 'dataset' })),
          skillsets.map((s) => ({ ...s, type: 'skillset' })),
          blueprints.map((b) => ({ ...b, type: 'blueprint' })),
          widgets.map((w) => ({ ...w, type: 'widget' }))
        )
        .sort((a, b) => {
          if (a.rank !== b.rank) {
            return b.rank - a.rank
          }

          if (a.createdAt !== b.createdAt) {
            return b.createdAt - a.createdAt
          }

          return b.id.localeCompare(a.id)
        }),
      // .slice(0, hubConfig.limits.take),
    }),
  }
}
