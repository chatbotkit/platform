import prisma from '@/prisma/client'

import { generateContentCard } from '@/lib/card'
import { withImageResponse } from '@/lib/card.response'

export default function Page() {
  return null
}

export const getServerSideProps = withImageResponse(async function (context) {
  // @todo it needs better rendering

  const page = (await prisma.user.findFirst({
    where: {
      id: context.params.userId,
    },

    select: {
      name: true,
    },
  })) || {
    name: 'Hub Users',
  }

  if (!page) {
    return
  }

  const image = await generateContentCard({
    category: 'Users',
    title: page.name,
    description:
      'Connect with a vibrant community of AI enthusiasts, developers, and innovators.',
  })

  return image
})
