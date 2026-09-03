import { useCallback, useEffect } from 'react'

import {
  LIMITS_REACHED_CODE,
  NOT_AUTHENTICATED_CODE,
  NO_SUBSCRIPTION_CODE,
} from '@/lib/response'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'

type CodeActionProps = {
  code: string | null | undefined

  clickToSubscribe?: boolean
  clickToUpgrade?: boolean

  trial?: boolean
  plan?: string

  returnTo?: string
}

export default function CodeAction({
  code,

  clickToSubscribe,
  clickToUpgrade,

  plan,

  trial,

  returnTo,
}: CodeActionProps) {
  const router = useRouter()

  const { data: session } = useSession()

  const billingAvailable = session?.billing?.available === true

  // @note the trial is only valid on a plan that offers one - checkout
  // rejects any other pairing - so the plan comes first and the trial follows
  // from it. `session.billing.trialPlan` does two things at once: its
  // presence means a trial is available to this user, its value is the plan
  // it runs on. Without it (trials disabled, or already consumed) there is
  // no default plan, and the actions fall back to browsing the plans.

  const trialPlan = session?.billing?.trialPlan

  const resolvedPlan = plan ?? trialPlan

  const resolvedTrial =
    trial ?? (resolvedPlan !== undefined && resolvedPlan === trialPlan)

  const { fetch } = useFetch({ loadingMessage: true, failureMessage: true })

  const { popup, openPopup } = usePopup({})

  // @note when embedded in an iframe, break in-app navigation out to a new tab
  // rather than trapping the destination inside the (usually small) embedded
  // surface. Evaluated at click time so the embedded state is always accurate.
  const navigate = useCallback(
    (url: string) => {
      if (typeof window !== 'undefined' && window.top !== window.self) {
        window.open(url, '_blank')
      } else {
        router.push(url)
      }
    },
    [router]
  )

  useEffect(() => {
    switch (code) {
      case NOT_AUTHENTICATED_CODE: {
        openPopup(<></>, {
          title: 'Login',
          description:
            'You are not authenticated. In order to access this feature, you must be logged in. Please log in and try again.',
          type: 'alert',
          actions: {
            Login: {
              default: true,
              fn: () => {
                navigate(`/signin?callbackUrl=${router.asPath}`)
              },
            },
          },
        })

        break
      }

      case NO_SUBSCRIPTION_CODE: {
        openPopup(<></>, {
          title: 'Subscribe',
          description:
            'You do not have an active subscription. In order to access all features, you will need to start a subscription.',
          type: 'alert',
          actions: {
            ...(clickToSubscribe && billingAvailable && resolvedPlan
              ? {
                  [resolvedTrial ? 'Start Trial' : 'Subscribe']: {
                    default: true,
                    fn: async () => {
                      const { data, error } = await fetch(
                        `/api/billing/checkout`,
                        {
                          data: {
                            trial: resolvedTrial,
                            plan: resolvedPlan,
                            returnTo: returnTo || router.asPath,
                          },
                        }
                      )

                      if (!error) {
                        router.push(data.redirectUrl)
                      }
                    },
                  },
                }
              : billingAvailable
                ? {
                    Plans: {
                      default: true,
                      fn: () => {
                        navigate('/pricing')
                      },
                    },
                  }
                : {}),
          },
        })

        break
      }

      case LIMITS_REACHED_CODE: {
        openPopup(<></>, {
          title: 'Upgrade',
          description:
            'You have exceeded the limits of your current plan. In order to access all features, you will need to upgrade your subscription.',
          type: 'alert',
          actions: {
            ...(clickToUpgrade && billingAvailable && resolvedPlan
              ? {
                  [resolvedTrial ? 'Start Trial' : 'Upgrade']: {
                    default: true,
                    fn: async () => {
                      const { data, error } = await fetch(
                        `/api/billing/checkout`,
                        {
                          data: {
                            trial: resolvedTrial,
                            plan: resolvedPlan,
                            returnTo: returnTo || router.asPath,
                          },
                        }
                      )

                      if (!error) {
                        router.push(data.redirectUrl)
                      }
                    },
                  },
                }
              : clickToUpgrade && billingAvailable
                ? {
                    Upgrade: {
                      default: true,
                      fn: () => {
                        navigate('/billing/upgrade')
                      },
                    },
                  }
                : {
                    ['See Your Usage']: {
                      default: true,
                      fn: () => {
                        navigate('/usage')
                      },
                    },
                  }),
          },
        })

        break
      }
    }
  }, [
    code,
    clickToSubscribe,
    clickToUpgrade,
    billingAvailable,
    resolvedTrial,
    resolvedPlan,
    returnTo,
    router,
    fetch,
    openPopup,
    navigate,
  ])

  return <>{popup}</>
}
