import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

import { playgrounds } from '@/pages/playground/index'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const page = playgrounds[context.params.slug] || {
    emoji: '🤖 🕹 🎮️',
    title: 'Learn and experiment in the chatbot playground',
    description:
      'Experience the fun and excitement of learning and experimenting with conversational AI technology in the chatbot playground.',
  }

  if (!page) {
    return
  }

  const image = await generateContentCard({
    category: 'Playground',
    title: page.title,
    description: page.description,
  })

  return image
})
