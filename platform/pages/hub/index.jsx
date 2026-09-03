import { getItems } from '@/lib/hub'
import { withRevalidation } from '@/lib/static'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import CategoryGrid from '@/components/CategoryGrid'
import DynamicIcon from '@/components/DynamicIcon'
import Hero from '@/components/Hero'
import List from '@/components/List'

import clsx from 'clsx'

export function HubListItem({
  className,

  type,

  id,

  slug,
  icon,

  name,
  description,

  ...props
}) {
  return (
    <List.Item
      {...props}
      className={clsx('!gap-4 hover:rounded-xl', className)}
      icon={
        <DynamicIcon
          className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl"
          icon={icon || name || description}
        />
      }
      link={`/hub/${type}s/${slug || id}`}
      title={name}
      body={description}
    />
  )
}

export default function Index({ items }) {
  return (
    <>
      <section className="section-white">
        <div className="mx-auto max-w-7xl pb-24 px-6 lg:px-8 space-y-20">
          <CategoryGrid>
            <CategoryGrid.Content>
              {items.map((item) => (
                <HubListItem {...item} key={item.id} as="article" />
              ))}
            </CategoryGrid.Content>
          </CategoryGrid>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Hub
      breadcrumbs={['ChatBotKit']}
      title="Hub"
      description="Embark on a journey of innovation with ChatBotKit Hub - your collaborative nexus for discovering, sharing, and evolving the frontier of conversational AI technology."
      image={`/hub/card`}
      rss={{ title: 'ChatBotKit Hub', href: '/hub/rss.xml' }}
    >
      <PageHero />
      {children}
    </Hub>
  )
}

export function PageHero() {
  return (
    <>
      <div className="bg-gray-white dark:bg-black">
        <Hero
          title={[
            'Discover Innovative',
            'Conversational AI Bots, Datasets, and Skillsets',
          ]}
          description="Discover, share, and improve conversational AI bots, datasets, and skillsets in a collaborative space."
        />
      </div>
    </>
  )
}

export const getStaticProps = withRevalidation(async function () {
  return {
    props: makeJsonSafe({
      items: await getItems(),
    }),
  }
})
