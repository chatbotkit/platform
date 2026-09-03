import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'
import { getExampleBySlug, getTotalExamples } from '@/lib/example.fetch'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const page = (await getExampleBySlug(context.params.slug)) || {
    emoji: '🤖 💭 🚀️',
    title: `Unlock your imagination with ${getTotalExamples()} chatbot examples`,
    description:
      'Explore the possibilities of conversational AI technology with our collection of chatbot examples. Let your imagination run wild and discover new ideas as you learn and experiment in our virtual environment.',
  }

  if (!page) {
    return
  }

  const image = await generateContentCard({
    category: 'Examples',
    title: page.title,
    description: page.description,
  })

  return image
})
