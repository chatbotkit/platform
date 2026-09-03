import { registry } from '@/lib/report'
import { makeJsonSafe } from '@/lib/struct'

import Platform from '@/layouts/Platform'

import Expando from '@/components/Expando'
import Hero from '@/components/Hero'
import List, { ListItem } from '@/components/List'
import ObjectView from '@/components/ObjectView'

import zodToJsonSchema from 'zod-to-json-schema'

export default function Index({ reports }) {
  return (
    <section className="section-white">
      <div className="main-page">
        <List>
          {reports.map(
            ({ id, name, description, inputSchema, outputSchema }) => {
              return (
                <ListItem
                  key={id}
                  title={name}
                  body={
                    description || (
                      <span className="italic">
                        A report without description
                      </span>
                    )
                  }
                >
                  <div className="space-y-2 flex-1">
                    <Expando
                      titleClassName="default-link text-sm"
                      title="Input Schema"
                    >
                      <ObjectView className="text-xs" object={inputSchema} />
                    </Expando>
                    <Expando
                      titleClassName="default-link text-sm"
                      title="Output Schema"
                    >
                      <ObjectView className="text-xs" object={outputSchema} />
                    </Expando>
                  </div>
                </ListItem>
              )
            }
          )}
        </List>
      </div>
    </section>
  )
}

Index.getLayout = function (pageContent) {
  return (
    <Platform
      breadcrumbs={['ChatBotKit']}
      title="Platform Reports - ChatBotKit Analytics"
      description="Explore the full catalog of analytics reports available on the ChatBotKit platform. Each report provides structured data with defined input parameters and output schema for programmatic access."
      keywords="ChatBotKit reports, platform analytics, data reports, conversation analytics, usage reports, AI platform data"
    >
      <section className="section-white">
        <PageHero />
      </section>
      {pageContent}
    </Platform>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Platform Reports', 'Analytics & Insights']}
      description="Explore the full catalog of analytics reports available on the platform. Generate structured data with defined input parameters for conversations, ratings, contacts, and more."
      compact="2xl"
    />
  )
}

export async function getStaticProps() {
  const reports = Object.entries(registry).map(([id, report]) => ({
    id,
    name: report.name,
    description: report.description,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    inputSchema: zodToJsonSchema(report.input, { target: 'openApi3' }),
    outputSchema: zodToJsonSchema(report.output, { target: 'openApi3' }),
  }))

  return {
    props: makeJsonSafe({ reports }),
  }
}
