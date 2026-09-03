import { visibleModels } from '@/config/models'

import { withGeneration, withRevalidation } from '@/lib/static'
import { makeJsonSafe } from '@/lib/struct'

import Platform from '@/layouts/Platform'

import BackLink from '@/components/BackLink'
import Hero from '@/components/Hero'
import ObjectView from '@/components/ObjectView'

export default function Page({ model: _model, modelConfig }) {
  return (
    <section className="section-white">
      <div className="main-page">
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold auto-text-gray-900">
              Technical Details
            </h2>
            <ObjectView className="text-xs" object={modelConfig} />
          </div>
          {modelConfig.features?.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold auto-text-gray-900">
                Supported Features
              </h2>
              <div className="flex flex-wrap gap-2">
                {modelConfig.features.map((feature) => (
                  <span key={feature} className="tag">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
          {modelConfig.tags?.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold auto-text-gray-900">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {modelConfig.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

Page.getLayout = function (pageContent, { model }) {
  const title = model
  const description = `Learn about ${model}, a language model available on the platform.`
  const keywords = ['AI model', 'language model', model]

  return (
    <Platform
      breadcrumbs={['ChatBotKit', 'Models']}
      title={`${title} - ChatBotKit Models`}
      description={description}
      keywords={keywords}
      image={`/platform/models/${model}/card`}
    >
      <section className="section-white">
        <Hero title={[title]} description={description} compact="2xl">
          <BackLink className="default-button" href="/platform/models">
            Back To Models
          </BackLink>
        </Hero>
      </section>
      {pageContent}
    </Platform>
  )
}

export const getStaticProps = withRevalidation(async function (context) {
  const modelId = context.params.modelId

  const modelConfig = visibleModels[modelId]

  if (!modelConfig) {
    return {
      notFound: true,
    }
  }

  // Clean up config for display
  const cleanConfig = { ...modelConfig }

  delete cleanConfig.visible
  delete cleanConfig.deprecated
  delete cleanConfig.proxyToModel

  return {
    props: makeJsonSafe({
      model: modelId,
      modelConfig: cleanConfig,
    }),
  }
})

export const getStaticPaths = withGeneration(async function () {
  const paths = Object.keys(visibleModels).map((modelId) => ({
    params: { modelId },
  }))

  return {
    paths,
    fallback: 'blocking',
  }
})
