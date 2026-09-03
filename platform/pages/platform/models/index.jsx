import { useEffect } from 'react'

import { visibleModels } from '@/config/models'

import { generateMarkdownTable } from '@/lib/md.table'
import { makeJsonSafe } from '@/lib/struct'

import Platform from '@/layouts/Platform'

import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import List, { ListItem } from '@/components/List'
import ObjectView from '@/components/ObjectView'

import faq from '@/content/faqs/platform-models.yaml'

export default function Index({ models }) {
  useEffect(() => {
    const headers = ['Model Name', 'Short Description', 'Token Ratio']

    const data = Object.entries(models)
      .filter(([name, { description, pricing }]) => {
        return name && description && pricing
      })
      .map(([name, { description, pricing }]) => {
        return [name, description, pricing.tokenRatio]
      })

    window.modelTable = generateMarkdownTable(headers, data)
  }, [models])

  return (
    <section className="section-white">
      <div className="main-page">
        <List>
          {Object.entries(models).map(
            ([name, { description, features, tags, ...config }]) => {
              const tagItems = [].concat(
                tags || [],
                features || [],
                config.deprecated ? ['deprecated'] : []
              )

              return (
                <ListItem
                  key={name}
                  link={`/platform/models/${name}`}
                  title={name}
                  body={
                    description || (
                      <span className="italic">
                        A model without description
                      </span>
                    )
                  }
                >
                  <div className="space-y-2 flex-1">
                    <Expando
                      titleClassName="default-link text-sm"
                      title="Technical Details"
                    >
                      <ObjectView className="text-xs" object={config} />
                    </Expando>
                    <div className="space-x-2">
                      {tagItems.map((tag) => {
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
      title="Explore Advanced AI Models of ChatBotKit for Chatbot Development"
      description="Step into the innovative realm of ChatBotKit's AI models. Our platform showcases a diverse range of advanced AI technologies, each expertly crafted to address various facets of conversational AI and chatbot development. Discover models that bring sophistication and efficiency to your AI projects."
      keywords="ChatBotKit AI models, advanced chatbot technology, AI model development, machine learning for chatbots, NLP models in AI, natural language processing applications, sophisticated conversational AI, AI technology for chatbots, AI model innovation, machine learning models, AI development tools, ChatBotKit conversational AI"
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
      title={['Explore Models', 'For Conversational AI Development']}
      description="Explore a wide range of AI models designed for different aspects of conversational AI and chatbot development."
      compact="2xl"
    />
  )
}

export async function getStaticProps() {
  return {
    props: makeJsonSafe({
      models: Object.fromEntries(
        Object.entries(visibleModels).map(([name, value]) => {
          value = { ...value }

          delete value.deprecated
          delete value.visible
          delete value.proxyToModel

          return [name, value]
        })
      ),
    }),
  }
}

/**
 * @doc Models
 * @description Explore ChatBotKit's diverse range of conversational AI models from multiple providers, with details on token costs and custom model settings.
 * @category Concepts
 * @tags ChatBotKit, models, tokens, AI
 * @icon heroicons/sparkles
 * @index 100
 * @date Wed, Mar 25, 2026, 12:00 AM
 * @share Discover the various AI models available for creating engaging conversational AI experiences with insights on token usage and custom model settings.\n\nhttps://chatbotkit.com/docs/models
 *
 * ChatBotKit supports a wide range of models to create engaging conversational AI experiences. These include models from OpenAI, Anthropic, Google, Mistral, Perplexity, and other providers, along with ChatBotKit's own in-house models. We regularly add new models as they become available.
 *
 * For the complete, up-to-date list of supported models - including descriptions, token ratios, and pricing details - visit the [platform models page](https://chatbotkit.com/platform/models). You can also retrieve model information programmatically via the API.
 *
 * ## Understanding Token Costs
 *
 * Most models have separate **input token ratio** and **output token ratio** values that reflect the different costs of processing input versus generating output. The per-model input and output ratios are available on the [platform models page](https://chatbotkit.com/platform/models) and via the API.
 *
 * The formula for calculating CBK token consumption is:
 *
 * ```
 * CBK Tokens = (inputTokens x inputTokenRatio) + (outputTokens x outputTokenRatio)
 * ```
 *
 * For example, if a model has an input token ratio of 0.0893 and an output token ratio of 0.5556, and a request consumes 400 input tokens and 600 output tokens:
 *
 * ```
 * CBK Tokens = (400 x 0.0893) + (600 x 0.5556) = 35.72 + 333.36 = 369.08
 * ```
 *
 * A few important details about how token usage is recorded:
 *
 * - **Upstream provider usage**: ChatBotKit records the actual token counts reported by the upstream provider (e.g. OpenAI, Anthropic). If the provider reports 400 input tokens, that is what gets recorded and billed.
 * - **Cached tokens are not charged**: When a provider supports prompt caching, only non-cached input tokens are counted. You are not charged for cached tokens.
 * - **Usage log breakdown**: Each usage record contains a detailed line-item breakdown showing input tokens, output tokens, and other components. Adding up all line items will match the total recorded consumption.
 *
 * The input and output token ratios are derived from the market price of each model relative to one base token. A higher ratio corresponds to a more expensive model. You can retrieve the exact ratios for every model via the API or on the [platform models page](https://chatbotkit.com/platform/models).
 *
 * The context size refers to the maximum tokens (words or symbols) the model can consider when generating a response. A larger context size allows for more information to be taken into account, potentially leading to more accurate and relevant responses.
 *
 * When choosing a model, it's essential to evaluate not just its capabilities, but also its cost and context size. Larger and more expensive models aren't always the best choice for every task. Often, a smaller model can perform equally well or even better for your specific use case. Consider starting with a cost-efficient model and scaling up only if needed.
 *
 * ## FAQ
 *
 * <details>
 *   <summary>Can I get regional access to some models?</summary>
 *
 * Yes. Some models such as Claude can be accessed within your own designated region. Please contact us for more information.
 *
 *   </details>
 *
 * <details>
 *   <summary>Can I bring my own model?</summary>
 *
 * Our models are designed to scale no matter the circumstances. However, customers that wish to bring their own model can do so on some of our higher-tier plans such as Pro, Pro Plus and Team.
 *
 *   </details>
 *
 * <details>
 *   <summary>How is token usage calculated?</summary>
 *
 * Each model has an input token ratio and an output token ratio. When a request completes, ChatBotKit records the actual token counts reported by the upstream provider and applies the formula:
 *
 * `CBK Tokens = (inputTokens x inputTokenRatio) + (outputTokens x outputTokenRatio)`
 *
 * Cached tokens are excluded from the input count, so you are only charged for tokens the provider actually processes. The usage log for each conversation provides a detailed line-item breakdown of all token consumption. You can find the exact input and output ratios for every model on the [platform models page](https://chatbotkit.com/platform/models) or via the API. Other factors such as the number of datasets, skillsets, and their types may also affect overall usage.
 *
 *   </details>
 */
