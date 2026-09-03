import abilitiesData from '@/data/abilities/visible'

import { tryGetRegistrableName } from '@/lib/domain'
import { toTitleCase } from '@/lib/string'
import { makeJsonSafe } from '@/lib/struct'

import Explore from '@/layouts/Explore'

import CategoryGrid from '@/components/CategoryGrid'
import DynamicIcon from '@/components/DynamicIcon'
import Hero from '@/components/Hero'
import ItemsDisplay from '@/components/ItemsDisplay'
import Link from '@/components/Link'
import List from '@/components/List'

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

export default function Page({ slug, name, items, connections }) {
  return (
    <>
      <section className="section-white">
        <Hero
          title={[getBrandName(name), 'MCP']}
          description={
            <>
              Connect {getBrandName(name)} to your AI agents using the{' '}
              <Link
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                Model Context Protocol (MCP)
              </Link>
              , enabling seamless integration with{' '}
              <Link href={`https://${slug}`} target="_blank">
                {slug}
              </Link>
              &apos;s services through standardized interfaces.
            </>
          }
          compact="4xl"
        >
          {/* <Link
            className="default-button"
            href="https://github.com/orgs/chatbotkit/discussions/"
            target="_blank"
          >
            Request New {getBrandName(name)} MCP Features
          </Link> */}
        </Hero>
        <div className="main-page main-page-4xl">
          <Listing items={items} />
        </div>
      </section>
      <section className="section-black grad-bar-rose">
        <div className="main-page main-page-4xl">
          <div className="prose prose-lg prose-invert">
            <h2 className="mega-title text-white">
              What is {getBrandName(name)} MCP?
            </h2>
            <div className="text-white space-y-6">
              <p className="text-xl">
                The Model Context Protocol (MCP) is an open standard that
                provides a unified way for AI applications to connect with
                external tools and data sources. Instead of building custom
                integrations for every service, MCP provides a standardized
                interface that allows AI models to discover available tools,
                understand their capabilities, and execute them safely and
                securely.
              </p>
              <p>With {getBrandName(name)} MCP integration, you can:</p>
              <ul className="marker:text-white">
                <li>
                  <strong>Dynamically discover tools:</strong> Your AI agents
                  automatically find and understand {getBrandName(name)}&apos;s
                  available capabilities through the MCP server
                </li>
                <li>
                  <strong>Standardized integration:</strong> Use a consistent
                  protocol instead of learning platform-specific APIs
                </li>
                <li>
                  <strong>Real-time capabilities:</strong> Tools are loaded and
                  executed on-demand during conversations
                </li>
                <li>
                  <strong>Secure execution:</strong> Maintain proper
                  authentication and isolation through ChatBotKit&apos;s MCP
                  implementation
                </li>
                <li>
                  <strong>No custom coding:</strong> Leverage{' '}
                  {getBrandName(name)}&apos;s functionality without writing
                  integration code
                </li>
              </ul>
            </div>
          </div>
          <div>
            <Link className="hud-button" href="/overview">
              Start Building {getBrandName(name)} MCP Integrations
            </Link>
          </div>
        </div>
      </section>
      <section className="section-white">
        <div className="main-page main-page-4xl">
          <div className="mx-auto max-w-3xl text-center px-5 sm:px-0">
            <h2 className="mega-title text-center mt-16">
              How {getBrandName(name)} MCP Works
            </h2>
            <p className="mx-auto mt-3 md:mt-5 max-w-md md:max-w-4xl text-base sm:text-lg md:text-xl text-gray-500 dark:text-gray-500">
              ChatBotKit&apos;s MCP action provides a powerful way to
              dynamically extend your AI agent&apos;s capabilities by loading
              tools from {getBrandName(name)}&apos;s MCP server.
            </p>
          </div>
          <div>
            <ItemsDisplay
              cols={4}
              items={[
                {
                  name: 'Connect to MCP Server',
                  description: `ChatBotKit establishes a connection to ${getBrandName(
                    name
                  )} API endpoints, initiating secure communication.`,
                },
                {
                  name: 'Discover Available Tools',
                  description: `The system automatically discovers all available ${getBrandName(
                    name
                  )} tools and their schemas through the MCP protocol.`,
                },
                {
                  name: 'Load Tool Definitions',
                  description:
                    'Tool definitions are loaded into your conversation context, making them available to your AI agent.',
                },
                {
                  name: 'Execute Securely',
                  description:
                    'Your AI uses these tools as if they were native abilities, with secure execution and proper authentication.',
                },
              ]}
            />
          </div>
        </div>
      </section>
      <section className="section-white">
        <div className="main-page main-page-4xl">
          <LListing connections={connections} mcpVariant={true} />
        </div>
      </section>
    </>
  )
}

Page.getLayout = function (children, { slug, name }) {
  return (
    <Explore
      breadcrumbs={[slug, 'MCP', 'Connections', 'ChatBotKit']}
      title={`${getBrandName(name)} MCP - Model Context Protocol Integration`}
      description={`Connect ${slug} to AI agents using Model Context Protocol (MCP) for seamless, standardized integration with ChatBotKit`}
      image={`/connections/${slug}/card`}
    >
      {children}
    </Explore>
  )
}

export async function getServerSideProps(context) {
  const slug = context.params.slug

  const name = tryGetRegistrableName(slug) || slug

  const items = Object.entries(abilitiesData)
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

  return {
    props: makeJsonSafe({
      slug,
      name,
      items,
      connections,
    }),
  }
}
