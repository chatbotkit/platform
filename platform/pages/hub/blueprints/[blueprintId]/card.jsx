import prisma from '@/prisma/client'

import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const page = (await prisma.hubBlueprintPage.findFirst({
    where: {
      OR: [
        { id: context.params.blueprintId },
        { slug: context.params.blueprintId },
      ],
    },

    select: {
      name: true,
      description: true,
      icon: true,
    },
  })) || {
    name: 'Hub Blueprints',
    description: 'Create and share agentic AI blueprints.',
    icon: '📐',
  }

  if (!page) {
    return
  }

  const image = await generateContentCard({
    category: 'Blueprints',
    title: page.name,
    description: page.description,
  })

  return image
})
