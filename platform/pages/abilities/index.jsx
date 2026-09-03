import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

export default function Index() {
  return null
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      props: makeJsonSafe({
        authenticated: false,
      }),
    }
  }

  return {
    redirect: {
      destination: '/skillsets',
      permanent: false,
    },
  }
}
