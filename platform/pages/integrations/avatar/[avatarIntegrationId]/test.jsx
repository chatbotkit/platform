import prisma from '@/prisma/client'

import { makeJsonSafe } from '@/lib/struct'

export default function Test({ avatarIntegrationId }) {
  return (
    <>
      <style jsx global>{`
        html,
        body,
        #__next {
          width: 100%;
          height: 100%;
          margin: 0;
          overflow: hidden;
          background: #111827;
        }
      `}</style>
      <iframe
        className="absolute inset-0 w-screen h-screen border-0"
        src={`/integrations/avatar/${avatarIntegrationId}/frame`}
        allow="microphone; camera; autoplay; fullscreen"
      />
    </>
  )
}

Test.theme = 'none'

Test.getLayout = function (children) {
  return children
}

export async function getServerSideProps(context) {
  const integration = await prisma.avatarIntegration.findUnique({
    where: {
      id: context.query.avatarIntegrationId,
    },
    select: {
      id: true,
    },
  })

  if (!integration) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      avatarIntegrationId: integration.id,
    }),
  }
}
