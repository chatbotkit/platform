import limits from '@/config/limits'

import { formatPlanLabel } from '@/lib/plan.label'
import { makeJsonSafe } from '@/lib/struct'

import Platform from '@/layouts/Platform'

import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import List, { ListItem } from '@/components/List'
import ObjectView from '@/components/ObjectView'

import faq from '@/content/faqs/platform-models.yaml'

export default function Index({ limits }) {
  return (
    <section className="section-white">
      <div className="main-page">
        <List>
          {Object.entries(limits).map(([name, details]) => {
            const tags = []

            return (
              <ListItem
                key={name}
                title={formatPlanLabel(name)}
                body="The limits and entitlements this plan grants."
              >
                <div className="space-y-2 flex-1">
                  <Expando
                    titleClassName="default-link text-sm"
                    title="Technical Details"
                  >
                    <ObjectView className="text-xs" object={details} />
                  </Expando>
                  <div className="space-x-2">
                    {tags.map((tag) => {
                      return (
                        <div key={tag} className="tag">
                          {tag}
                        </div>
                      )
                    })}
                  </div>
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
      title="Limits and Tiers"
      description="Find out what limits and tiers are available for ChatBotKit."
      keywords="chatbotkit, subscription, limits, tiers"
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
      title={['Limits', 'And Tiers']}
      description="Find out which limits and tiers are available for your account."
      compact="2xl"
    />
  )
}

export async function getStaticProps() {
  return {
    props: makeJsonSafe({
      limits,
    }),
  }
}
