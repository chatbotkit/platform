import { visibleModels } from '@/config/models'

import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const modelId = context.params.modelId

  const modelConfig = visibleModels[modelId]

  if (!modelConfig) {
    return null
  }

  const image = await generateContentCard({
    category: 'AI Models',
    title: modelId,
  })

  return image
})
