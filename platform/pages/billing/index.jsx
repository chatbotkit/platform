import limits, { PLAN_TRIAL } from '@/config/limits'

import { isBillingConfigured, isSellable } from '@/lib/billing.core'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { revealUserPlan } from '@/lib/user.plan'

import Dashboard from '@/layouts/Dashboard'

import BillingButtons from '@/components/BillingButtons'
import Link from '@/components/Link'

export default function Index({ plan, showPlan, upgradable }) {
  return (
    <>
      <div className="main-page">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Billing</h1>
        </div>
        <p className="mt-4 sm:text-sm">
          Welcome to your billing area! This is where you can manage your
          account subscription. If you want to upgrade or cancel your account,
          you can do so from here. However, if you need additional support,
          please reach out to our team. We are here to help.
        </p>
        {showPlan ? (
          <div className="space-y-2">
            <p>
              Your current plan is <span className="font-bold">{plan}</span>.
            </p>
            {plan === PLAN_TRIAL ? (
              <p className="text-sm">
                You will receive the full allowance of your plan at the end of
                your trial period.
              </p>
            ) : null}
          </div>
        ) : null}
        <BillingButtons plan={plan} upgradable={upgradable}>
          <Link className="default-button" href="/usage">
            See Usage
          </Link>
        </BillingButtons>
      </div>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Billing"
      description=""
      keywords=""
    >
      {children}
    </Dashboard>
  )
}

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
      plan,

      showPlan: isSellable,

      // @note whether this plan has somewhere to go - drives the upgrade and
      // booster affordances; the top of the ladder sets upgradable false
      upgradable: limits[plan]?.upgradable === true,
    }),
  }
}
