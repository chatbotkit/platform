import prisma from '@/prisma/client'

import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const page = (await prisma.hubSkillsetPage.findFirst({
    where: {
      OR: [
        { id: context.params.skillsetId },
        { slug: context.params.skillsetId },
      ],
    },

    select: {
      name: true,
      description: true,
      icon: true,
    },
  })) || {
    name: 'Hub Skillsets',
    description:
      'Embark on a journey of innovation with ChatBotKit Hub - your collaborative nexus for discovering, sharing, and evolving the frontier of conversational AI technology.',
    icon: '🤖',
  }

  if (!page) {
    return
  }

  const image = await generateContentCard({
    category: 'Skillsets',
    title: page.name,
    description: page.description,
  })

  return image
})
