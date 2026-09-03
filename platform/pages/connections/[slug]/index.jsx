import { organization as organizationStructure } from '@/config/structures'

import abilitiesData from '@/data/abilities/visible'

import { tryGetRegistrableName } from '@/lib/domain'
import { findExamplesByKeywords } from '@/lib/example.fetch'
import { toTitleCase } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'

import Explore from '@/layouts/Explore'

import { Examples } from '@/components/AgentsScreen'
import CategoryGrid from '@/components/CategoryGrid'
import DynamicIcon from '@/components/DynamicIcon'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List from '@/components/List'
import PageDown from '@/components/Pagedown'
import StructuredData from '@/components/StructuredData'

import connectionsData from '@/content/other/connections.yaml'

import { Listing as LListing } from '../index'

import clsx from 'clsx'

export function getBrandName(name) {
  return (
    {
      chatbotkit: 'ChatBotKit',
    }[name.toLowerCase()] || toTitleCase(name)
  )
}

export function Listing({ items }) {
  return (
    <CategoryGrid>
      <CategoryGrid.Content className="sm:!grid-cols-2">
        {items.map(({ icon, name, description, tags, categories }, index) => (
          <List.Item
            key={index}
            className={clsx('!gap-4 hover:rounded-xl', 'cursor-default')}
            icon={
              <DynamicIcon
                key={`${icon}-${name}-${description}`}
                className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl"
                icon={icon}
                fallbackIcon="@heroicons/puzzle-piece"
              />
            }
            title={name}
            body={description}
          >
            {categories?.map((category, index) => {
              return (
                <div key={index} className="tag">
                  {category}
                </div>
              )
            })}
            {tags?.map((tag, index) => {
              return (
                <div key={index} className="tag">
                  {tag}
                </div>
              )
            })}
          </List.Item>
        ))}
      </CategoryGrid.Content>
    </CategoryGrid>
  )
}

export default function Page({
  slug,
  name,
  items,
  page,
  connections,
  examples,
}) {
  return (
    <>
      {/* SoftwareApplication with feature list */}
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: `${getBrandName(name)} AI Agents`,
          applicationCategory: 'BusinessApplication',
          description: `Build powerful AI agents that integrate with ${getBrandName(
            name
          )}. Create conversational AI solutions for ${slug} using ChatBotKit.`,
          operatingSystem: 'Web',
          featureList: items.map((item) => item.name),
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            description: 'Free tier available',
          },
          provider: {
            '@type': 'Organization',
            ...organizationStructure,
          },
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'ChatBotKit',
              item: '/',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Connections',
              item: '/connections',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: getBrandName(name),
              item: `/connections/${slug}`,
            },
          ],
        }}
      />
      {/* ItemList with detailed Service entries for each ability */}
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `${getBrandName(name)} AI Agent Capabilities`,
          description: `Available AI agent abilities for ${getBrandName(
            name
          )} integration`,
          numberOfItems: items.length,
          itemListElement: items.slice(0, 10).map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Service',
              name: item.name,
              description: item.description,
              provider: {
                '@type': 'Organization',
                name: 'ChatBotKit',
              },
              serviceType: 'AI Agent Capability',
              ...(item.tags?.length > 0 && {
                keywords: item.tags.join(', '),
              }),
              ...(item.categories?.length > 0 && {
                category: item.categories.join(', '),
              }),
            },
          })),
        }}
      />

      {/* HowTo schema for actionable abilities - helps with rich snippets */}
      {items.length > 0 && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: `How to Build AI Agents with ${getBrandName(name)}`,
            description: `Learn how to create AI agents that integrate with ${getBrandName(
              name
            )} using ChatBotKit's capabilities.`,
            totalTime: 'PT15M',
            tool: [
              {
                '@type': 'HowToTool',
                name: 'ChatBotKit Account',
              },
              {
                '@type': 'HowToTool',
                name: `${getBrandName(name)} API Access`,
              },
            ],
            step: [
              {
                '@type': 'HowToStep',
                position: 1,
                name: 'Create a ChatBotKit Account',
                text: 'Sign up for a free ChatBotKit account to get started building AI agents.',
                url: '/signup',
              },
              {
                '@type': 'HowToStep',
                position: 2,
                name: `Connect ${getBrandName(name)}`,
                text: `Configure your ${getBrandName(
                  name
                )} integration by providing the necessary API credentials.`,
                url: `/connections/${slug}`,
              },
              ...items.slice(0, 5).map((item, index) => ({
                '@type': 'HowToStep',
                position: index + 3,
                name: `Enable: ${item.name}`,
                text: item.description,
              })),
            ],
          }}
        />
      )}
      {/* FAQPage schema for common questions about the integration */}
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What can I do with ${getBrandName(name)} and ChatBotKit?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `With ChatBotKit's ${getBrandName(
                  name
                )} integration, you can: ${items
                  .slice(0, 5)
                  .map((item) => item.name.toLowerCase())
                  .join(
                    ', '
                  )}, and more. These capabilities allow you to build powerful AI agents that seamlessly work with ${getBrandName(
                  name
                )}'s services.`,
              },
            },
            {
              '@type': 'Question',
              name: `How many ${getBrandName(
                name
              )} capabilities does ChatBotKit support?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `ChatBotKit currently supports ${
                  items.length
                } ${getBrandName(name)} capabilities, including ${items
                  .slice(0, 3)
                  .map((item) => item.name)
                  .join(', ')}.`,
              },
            },
            {
              '@type': 'Question',
              name: `Is the ${getBrandName(name)} integration free to use?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Yes, ChatBotKit offers a free tier that includes access to ${getBrandName(
                  name
                )} integration capabilities. You can get started without any upfront costs and upgrade as your needs grow.`,
              },
            },
          ],
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `Build ${getBrandName(name)} AI bots and agents`,
          description: `Connect ${slug} to ChatBotKit and create powerful agentic AI solutions.`,
          url: `/connections/${slug}`,
          isPartOf: {
            '@type': 'WebSite',
            name: 'ChatBotKit',
            url: '/',
          },
          about: {
            '@type': 'Thing',
            name: getBrandName(name),
            url: `https://${slug}`,
          },
          mainEntity: {
            '@type': 'SoftwareApplication',
            name: `${getBrandName(name)} AI Agents`,
            applicationCategory: 'BusinessApplication',
          },
        }}
      />
      <section className="section-white">
        <Hero
          title={
            slug === 'mcps'
              ? ['Model Context Protocol']
              : ['AI Agents for', getBrandName(name)]
          }
          description={
            <>
              {slug === 'mcps' ? (
                <>
                  Leverage Model Context Protocol (MCP) to build AI agents that
                  can dynamically discover and use tools from a wide range of
                  external services.
                </>
              ) : (
                <>
                  Create powerful agentic AI solutions that seamlessly integrate
                  with{' '}
                  <Link href={`https://${slug}`} target="_blank">
                    {slug}
                  </Link>
                  &apos;s services.
                </>
              )}
            </>
          }
          compact="4xl"
        >
          {/* <Link
            className="default-button"
            href="https://github.com/orgs/chatbotkit/discussions/"
            target="_blank"
          >
            Request New {getBrandName(name)} Agent Features
          </Link> */}
        </Hero>
        <div className="main-page main-page-4xl">
          <Listing items={items} />
        </div>
      </section>
      {examples?.length > 0 && (
        <section className="section-white">
          <div className="main-page main-page-4xl">
            <div className="mx-auto max-w-3xl text-center px-5 sm:px-0 mb-12">
              <h2 className="mega-title text-center">
                Example <span className="heading-highlight">Blueprints</span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Explore our collection of pre-built {getBrandName(name)} AI
                agent blueprints to get started quickly.
              </p>
            </div>
            <Examples shadow={false} examples={examples} />
          </div>
        </section>
      )}
      {page ? (
        <section className="section-black grad-bar-rose">
          <div className="main-page main-page-4xl">
            <div className="prose prose-lg prose-invert">
              <h2 className="mega-title text-white">{page.title}</h2>
              <PageDown className="text-white">{page.content}</PageDown>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                className="hud-button"
                href={page.start ? page.start : '/overview'}
              >
                Start Build AI Agents with {page.title}
              </Link>
              <Link className="hud-button" href={`/connections/${slug}/mcp`}>
                Explore {getBrandName(name)} MCP Integration
              </Link>
            </div>
          </div>
        </section>
      ) : null}
      <section className="section-white">
        <div className="main-page main-page-4xl">
          <LListing connections={connections} />
        </div>
      </section>
    </>
  )
}

Page.getLayout = function (children, { slug, name }) {
  return (
    <Explore
      breadcrumbs={[slug, 'Connections', 'ChatBotKit']}
      title={`Build ${getBrandName(name)} AI bots and agents`}
      description={`Connect ${slug} to ChatBotKit`}
      image={`/connections/${slug}/card`}
    >
      {children}
    </Explore>
  )
}

export async function getServerSideProps(context) {
  const slug = context.params.slug

  const name = tryGetRegistrableName(slug) || slug

  const mcpAbilities = Object.fromEntries(
    Object.entries(abilitiesData)
      .filter(([, { tags }]) => tags?.includes('mcp'))
      .map(([id, ability]) => [
        `mcps/${id}`,
        { ...ability, icon: '@logo/mcps' },
      ])
  )

  const extendedAbilitiesData = {
    ...abilitiesData,
    ...mcpAbilities,
  }

  const items = Object.entries(extendedAbilitiesData)
    .filter(([, { icon }]) => {
      return icon.includes(`/${slug}`)
    })
    .map(([id, { icon, name, description, tags }]) => {
      return {
        icon,

        name,
        description,

        tags,

        ...(/\[.*?\]/.test(id)
          ? { categories: [id.match(/\[(.*?)\]/)[1].replace(/\W+/g, ' ')] }
          : undefined),
      }
    })

  if (!items.length) {
    return {
      notFound: true,
    }
  }

  const page = connectionsData[slug]

  const connections = Array.from(
    new Set(Object.values(abilitiesData).map(({ icon }) => icon))
  ).map((icon) => {
    let slug = icon.replace(/^@.+?\//, '')

    if (slug.startsWith('https://')) {
      slug = new URL(slug).hostname
    }

    return {
      slug,
    }
  })

  connections.unshift({
    slug: 'mcps',
  })

  const examples = findExamplesByKeywords(
    [name, ...name.split(/-/g)].filter(Boolean)
  )
    .filter((example) => !!example.blueprint)
    .slice(0, 5)
    .map((example) => ({
      icon: example.icon,
      name: example.title,
      description: example.description,
      src: `/examples/${example.slug}/designer?controls=false`,
    }))

  return {
    props: makeJsonSafe({
      slug,
      name,
      items,
      page,
      connections,
      examples,
    }),
  }
}
