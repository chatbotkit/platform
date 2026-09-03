import { definitions } from '@/lib/action.definition'
import { ActionName } from '@/lib/action.name'
import { makeJsonSafe } from '@/lib/struct'

import Platform from '@/layouts/Platform'

import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import List, { ListItem } from '@/components/List'

import faq from '@/content/faqs/platform-actions.yaml'

export default function Index({ actions }) {
  return (
    <section className="section-white">
      <div className="main-page">
        <List>
          {Object.entries(actions).map(([name, { description, examples }]) => {
            const hasExamples = examples && examples.length > 0

            return (
              <ListItem
                key={name}
                title={name}
                body={
                  description || (
                    <span className="italic">
                      An action without description
                    </span>
                  )
                }
              >
                <div className="space-y-2 flex-1">
                  {hasExamples ? (
                    <Expando
                      titleClassName="default-link text-sm"
                      title="Examples"
                    >
                      <div className="text-xs space-y-1">
                        {examples.map((example, idx) => (
                          <div
                            key={idx}
                            className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded"
                          >
                            {example}
                          </div>
                        ))}
                      </div>
                    </Expando>
                  ) : null}
                  {hasExamples ? (
                    <div className="space-x-2">
                      <div className="tag">examples</div>
                    </div>
                  ) : null}
                </div>
              </ListItem>
            )
          })}
        </List>
      </div>
    </section>
  )
}

Index.getLayout = function (pageContent) {
  return (
    <Platform
      breadcrumbs={['ChatBotKit']}
      title="Explore Platform Actions for AI Development"
      description="Discover the full range of actions available in ChatBotKit. Actions are executable components within skillset abilities that perform specific tasks like fetching data, generating images, managing files, and more."
      keywords="ChatBotKit actions, skillset abilities, AI actions, fetch action, image generation, file management, conversation actions, AI development tools"
    >
      <section className="section-white">
        <PageHero />
      </section>
      {pageContent}
      <FAQ faq={faq} />
    </Platform>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Platform Actions', 'Building Blocks for AI Abilities']}
      description="Actions are the executable components within skillset abilities that perform specific tasks. Each action is specified using a markdown-style code block, where you specify the action name after the first 3 backticks."
      compact="2xl"
    />
  )
}

export async function getStaticProps() {
  // Build actions object from ActionName enum and definitions
  const actions = Object.fromEntries(
    Object.values(ActionName).map((name) => {
      const definition = definitions[name]

      return [
        name,
        {
          description: definition?.description || '',
          examples: definition?.examples || [],
        },
      ]
    })
  )

  return {
    props: makeJsonSafe({
      actions,
    }),
  }
}
