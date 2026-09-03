import limits from '@/config/limits'

import {
  isBillingConfigured,
  isSellable,
  subscriptionsConfig,
  trialPlans,
} from '@/lib/billing.core'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { revealUserPlan } from '@/lib/user.plan'

import Dashboard from '@/layouts/Dashboard'

import Link from '@/components/Link'
import UpgradePlans from '@/components/UpgradePlans'

export default function Index({ plan, limits, subscriptions, trialPlans }) {
  return (
    <>
      <div className="main-page main-page-6xl">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Upgrade</h1>
        </div>
        <p className="mt-4 sm:text-sm">
          Pick the plan that fits your work. Upgrades take effect immediately,
          and you can review or change your subscription at any time from the{' '}
          <Link href="/billing" className="underline">
            billing area
          </Link>
          .
        </p>
        <UpgradePlans
          currentPlan={plan}
          limits={limits}
          subscriptions={subscriptions}
          trialPlans={trialPlans}
        />
      </div>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Upgrade', 'ChatBotKit']}
      title="Upgrade"
      description=""
      keywords=""
    >
      {children}
    </Dashboard>
  )
}

// @note everything imported above that is server only must stay reachable from
// this function alone - a second export using those imports would keep them in
// the client bundle, where `@/lib/scope.server` throws on import

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

  const { plan } = await revealUserPlan(session.user)

  return {
    props: makeJsonSafe({
      // @note a trialing user resolves to the structural `trial` plan, which
      // is not a rung on the pricing ladder - the component anchors it to the
      // primary trial plan
      plan,

      // @note the catalogue reaches the component as a prop - the environment
      // it is read from does not exist in the client bundle. Guarded by
      // `hasPlans` above, so the serialized tables are always finite.
      limits: { ...limits },

      // @note the selling configuration also travels as props - the billing
      // module is server-only. A null price marks a plan that is not
      // self-serve: Infinity does not survive serialization.
      subscriptions: {
        trialDays: subscriptionsConfig.trialDays,

        pricing: Object.fromEntries(
          Object.entries(subscriptionsConfig.pricing).map(([name, price]) => [
            name,
            Number.isFinite(price) ? price : null,
          ])
        ),
      },

      trialPlans: [...trialPlans],
    }),
  }
}
