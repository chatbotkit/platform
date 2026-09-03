import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'

export default function Index() {
  return null
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const ability = await prisma.ability.findUnique({
    where: {
      id: context.query.abilityId,
    },
  })

  if (!ability) {
    return {
      notFound: true,
    }
  }

  if (ability.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  if (!ability.skillsetId) {
    return {
      notFound: true,
    }
  }

  return {
    redirect: {
      destination: `/skillsets/${ability.skillsetId}/abilities/${ability.id}`,
      permanent: false,
    },
  }
}
