import prisma from '@/prisma/client'

import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  const page = (await prisma.hubWidgetPage.findFirst({
    where: {
      OR: [{ id: context.params.widgetId }, { slug: context.params.widgetId }],
    },

    select: {
      name: true,
      description: true,
      icon: true,
    },
  })) || {
    name: 'Hub Widgets',
    description:
      'Create and share beautiful AI widgets that enhance your website and application functionality.',
    icon: '🎨',
  }

  if (!page) {
    return
  }

  const image = await generateContentCard({
    category: 'Widgets',
    title: page.name,
    description: page.description,
  })

  return image
})
