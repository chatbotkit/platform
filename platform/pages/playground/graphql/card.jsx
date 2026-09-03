import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const image = await generateContentCard({
    category: 'Playground',
    title: 'GraphQL',
    description:
      'Test GraphQL queries and mutations against the ChatBotKit API with a clean, intuitive interface.',
  })

  return image
})
