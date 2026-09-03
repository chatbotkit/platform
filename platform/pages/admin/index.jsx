import { isAdmin } from '@/lib/admin'
import { getSoftSession } from '@/lib/session.get'

import { rootUrl } from '@/layouts/Admin'

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

  if (!isAdmin(session.user)) {
    return {
      notFound: true,
    }
  }

  return {
    redirect: {
      destination: rootUrl,
      permanent: false,
    },
  }
}
