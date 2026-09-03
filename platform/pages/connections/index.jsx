import abilitiesData from '@/data/abilities/visible'

import { makeJsonSafe } from '@/lib/struct'

import Explore from '@/layouts/Explore'

import CategoryGrid, { CategoryItem } from '@/components/CategoryGrid'
import Hero from '@/components/Hero'
import Link from '@/components/Link'

export function Listing({ connections, mcpVariant = false }) {
  return (
    <CategoryGrid>
      <CategoryItem title={mcpVariant ? 'MCP Integrations' : 'Connections'}>
        {connections.map(({ slug }) => (
          <Link
            key={slug}
            className="default-link truncate"
            href={
              mcpVariant ? `/connections/${slug}/mcp` : `/connections/${slug}`
            }
          >
            {slug}
          </Link>
        ))}
      </CategoryItem>
    </CategoryGrid>
  )
}

export default function Page({ connections }) {
  return (
    <>
      <section className="section-white">
        <Hero
          title={['AI For Your', 'Platform']}
          description="Explore a comprehensive selection of AI-powered tools that connect your platform to other services for conversational AI and agentic workflows."
          compact="4xl"
        >
          {/* <Link
            className="default-button"
            href="https://github.com/orgs/chatbotkit/discussions/"
            target="_blank"
          >
            Request New Connections
          </Link> */}
        </Hero>
        <div className="main-page main-page-4xl">
          <Listing connections={connections} />
        </div>
      </section>
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Explore
      breadcrumbs={['Connections', 'ChatBotKit']}
      title={`Connect with ChatBotKit`}
      description={`Connect your platform to ChatBotKit`}
    >
      {children}
    </Explore>
  )
}

export async function getServerSideProps() {
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

  return {
    props: makeJsonSafe({
      connections,
    }),
  }
}
