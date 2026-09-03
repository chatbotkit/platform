import prisma from '@/prisma/client'

import { getSigninRedirect } from '@/lib/auth.signin'
import { getSoftSession } from '@/lib/session.get'

export default function Index() {
  return null
}

/**
 * The welcome page is the landing page for new users. It is also the landing
 * page when users sign in for the first time.
 */
export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: getSigninRedirect(context),
    }
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
  })

  if (!user) {
    return {
      redirect: getSigninRedirect(context),
    }
  }

  if (
    context.query.force !== 'true' &&
    ![
      user.organization,
      user.role,
      user.industry,
      user.channel,
      // @todo should we force the setup of the goals
      // @note goal is optional
      // user.goal,
    ].some((i) => i === null)
  ) {
    return {
      redirect: {
        destination: '/overview',
        permanent: false,
      },
    }
  }

  // The user have not completed their profile yet - send them to the user
  // onboarding flow.

  return {
    redirect: {
      destination: '/new?template=onboarding',
      permanent: false,
    },
  }
}
