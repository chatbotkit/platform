import { useEffect } from 'react'

import { isBillingConfigured, isSellable } from '@/lib/billing.core'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { joinPathsAndGetPathname } from '@/lib/url'

import CodeAction from '@/components/CodeAction'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

let isRunning = false

/**
 * A utility page that redirects the user to the checkout process.
 */
export default function Checkout({ plan, trial, referer }) {
  const router = useRouter()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  useEffect(() => {
    async function goToCheckout() {
      if (isRunning) {
        return
      }

      isRunning = true

      try {
        const { error, data } = await fetch(`/api/billing/checkout`, {
          data: {
            plan: plan,
            trial: trial === 'true' ? true : false,
          },
        })

        if (error) {
          setTimeout(() => {
            router.replace(referer) // we don't want to add a history entry
          }, 5000)
        } else {
          router.replace(data.redirectUrl) // we don't want to add a history entry
        }
      } finally {
        isRunning = false
      }
    }

    goToCheckout()
  }, [])

  return (
    <>
      <CodeAction key={code} code={code} />
      {/* @todo display a logo or loading screen or something similar */}
    </>
  )
}

/**
 * Get query parameters and validate them before rendering the page.
 */
export async function getServerSideProps(context) {
  // @note billing pages exist only in deployments that have billing: without
  // a plan catalogue and a configured payment provider the page is absent,
  // not present-and-broken.

  if (!isSellable || !isBillingConfigured()) {
    return { notFound: true }
  }

  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const referer = joinPathsAndGetPathname(
    (context.query.referer || '/billing').trim() || '/billing'
  )

  if (!context.query.plan) {
    return {
      redirect: {
        destination: referer,
        permanent: false,
      },
    }
  }

  // @note a blank or whitespace plan is a malformed link, not a request for
  // some default tier - send it back rather than guessing a plan name
  const plan = String(context.query.plan).trim()

  if (!plan) {
    return {
      redirect: {
        destination: referer,
        permanent: false,
      },
    }
  }

  const trial = context.query.trial === 'true' ? true : false

  return {
    props: makeJsonSafe({
      plan,
      trial,

      referer,
    }),
  }
}
