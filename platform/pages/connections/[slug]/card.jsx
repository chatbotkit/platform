import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'
import { toTitleCase } from '@/lib/string'

import connectionsData from '@/content/other/connections.yaml'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const slug = context.params.slug

  const page = connectionsData[slug] || {
    title: toTitleCase(slug.split('.')[0]),
  }

  const image = await generateContentCard({
    category: 'Connections',
    title: page.title,
    description: page.description,
  })

  return image
})
