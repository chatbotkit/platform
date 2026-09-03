import type { GetServerSidePropsContext } from 'next'
import type { ReactNode } from 'react'

import prisma from '@/prisma/client'

import { makeJsonSafe } from '@/lib/struct'

type ScreenshareProps = {
  url: string
}

export default function Screenshare({ url }: ScreenshareProps) {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <iframe
        className="w-screen h-screen border-0"
        src={url}
        allow="autoplay; camera; microphone; fullscreen"
        title="Meeting Screenshare"
      />
    </main>
  )
}

Screenshare.theme = 'dark'

Screenshare.getLayout = function (children: ReactNode) {
  return children
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const url = typeof context.query.url === 'string' ? context.query.url : ''

  if (typeof context.query.recallIntegrationId !== 'string') {
    return {
      notFound: true,
    }
  }

  const recallIntegrationId = context.query.recallIntegrationId

  try {
    const parsedUrl = new URL(url)

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        notFound: true,
      }
    }
  } catch {
    return {
      notFound: true,
    }
  }

  const integration = await prisma.recallIntegration.findUnique({
    where: {
      id: recallIntegrationId,
    },

    select: {
      id: true,
      apiKey: true,
      botId: true,
    },
  })

  if (!integration) {
    return {
      notFound: true,
    }
  }

  if (!integration.apiKey || !integration.botId) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      url,
    }),
  }
}
