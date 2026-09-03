import { PLAN_FREE, PLAN_TRIAL } from '@/config/limits'

import { isSellable } from '@/lib/billing.core'
import { getUserDisplayLimits } from '@/lib/limit.core'
import {
  getApproximateTotalAbilities,
  getApproximateTotalBots,
  getApproximateTotalDatasets,
  getApproximateTotalFiles,
  getApproximateTotalPortals,
  getApproximateTotalRecords,
  getApproximateTotalSkillsets,
  getApproximateTotalTeams,
  getApproximateTotalUsers,
} from '@/lib/limit.estimate'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import {
  getUsage,
  getUsageSeries,
  getUsageSeriesFromDate,
} from '@/lib/usage.get'
import { getUsagePeriodFromUsage } from '@/lib/usage.period'
import { revealUserPlan } from '@/lib/user.plan'

import Dashboard from '@/layouts/Dashboard'

import Expando from '@/components/Expando'
import ExportLink from '@/components/ExportLink'
import FAQ from '@/components/FAQ'
import { GlobalRootPortal } from '@/components/GlobalRoot'
import Link from '@/components/Link'
import ObjectView from '@/components/ObjectView'
import UsageList from '@/components/UsageList'
import UsageView, { hasExceededUsageLimit } from '@/components/UsageView'

import usePartner from '@/hooks/usePartner'
import usePopup from '@/hooks/usePopup'

import faq from '@/content/faqs/platform-usage.yaml'

export default function Index({
  plan,
  showPlan,

  upgradeAvailable,

  limits,

  usage,

  usagePeriod,

  usageSeries,
  usageSeriesThisPeriod,

  otherUsage,
}) {
  const { popup, openPopup } = usePopup()

  const partner = usePartner()

  const exceededLimit = hasExceededUsageLimit(usage, otherUsage, limits)

  // @note whitelabel partners run their own billing, so never surface our
  // upgrade prompts on their domains
  // @note upgradeAvailable is false in a deployment without billing, where
  // /billing/upgrade does not exist
  const showUpgrade =
    upgradeAvailable &&
    !partner?.whitelabel &&
    (plan === PLAN_FREE || exceededLimit)

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div className="main-page">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Usage</h1>
        </div>
        <div className="space-y-2">
          <p>
            {showPlan ? (
              <>
                Your current plan is <span className="font-bold">{plan}</span>.
                For more information about your plan official limits see the
                platform{' '}
              </>
            ) : (
              <>
                For more information about the official limits see the
                platform{' '}
              </>
            )}
            <Link
              className="default-link"
              href="/platform/limits"
              target="_blank"
            >
              limits
            </Link>{' '}
            page. Also review your personal limits below.
          </p>
          {plan === PLAN_TRIAL ? (
            <p className="text-sm">
              You will receive the full allowance of your plan at the end of
              your trial period.
            </p>
          ) : null}
        </div>
        <div className="flex flex-row gap-2">
          {showUpgrade ? (
            <Link className="primary-button" href="/billing/upgrade">
              Upgrade
            </Link>
          ) : null}
          <button
            type="button"
            className="default-button"
            onClick={() =>
              openPopup(<UsageList export={false} />, {
                title: 'Usage Log',
                description: 'Browse your detailed usage records.',
                cancelButtonCaption: 'Close',
                dialogClassName: 'sm:max-w-3xl max-h-[80svh]',
                dialogInnerClassName: 'overflow-y-auto',
                animateContentHeight: false,
              })
            }
          >
            View Usage
          </button>
          <ExportLink
            className="default-button"
            path="/api/v1/usage/export"
            title="Export Usage"
            description="Export your usage data for the last 90 days."
          />
        </div>
        <UsageView
          usage={usage}
          otherUsage={otherUsage}
          usageSeries={usageSeries}
          usageSeriesThisPeriod={usageSeriesThisPeriod}
          usagePeriod={usagePeriod}
          limits={limits}
        />
        <Expando titleClassName="default-link text-sm" title="Plan Limits">
          <ObjectView className="text-xs" object={limits} />
        </Expando>
      </div>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Usage"
      description="View your platform usage metrics including tokens, conversations, messages, and other resources. Monitor your consumption against plan limits."
      keywords="usage, metrics, tokens, conversations, messages, plan limits, consumption, analytics"
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
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

  const { plan } = await revealUserPlan(session.user)

  const limits = await getUserDisplayLimits(session.user)

  const [usage, usageSeries, otherUsage] = await Promise.all([
    getUsage(session.user.id),

    getUsageSeries(session.user.id),

    (async () => {
      const [tb, td, tr, ts, ta, fa, tm, us, pa] = await Promise.all([
        getApproximateTotalBots(session.user),

        getApproximateTotalDatasets(session.user),

        getApproximateTotalRecords(session.user),

        getApproximateTotalSkillsets(session.user),

        getApproximateTotalAbilities(session.user),

        getApproximateTotalFiles(session.user),

        getApproximateTotalTeams(session.user),

        getApproximateTotalUsers(session.user),

        getApproximateTotalPortals(session.user),
      ])

      return {
        'database/bots': tb,
        'database/datasets': td,
        'database/records': tr,
        'database/skillsets': ts,
        'database/abilities': ta,
        'database/files': fa,
        'database/teams': tm,
        'database/users': us,
        'database/portals': pa,
      }
    })(),
  ])

  // @note when no counter exists there is no active period and the "this
  // period" slice would misleadingly show usage from the trailing 31 days
  const usagePeriod = getUsagePeriodFromUsage(usage)

  const usageSeriesThisPeriod = usagePeriod
    ? getUsageSeriesFromDate(usageSeries, usagePeriod.start)
    : null

  return {
    props: makeJsonSafe({
      plan,

      showPlan: isSellable,

      upgradeAvailable: session.billing?.upgradeAvailable ?? false,

      limits,

      usage,

      usagePeriod,

      usageSeries,
      usageSeriesThisPeriod,

      otherUsage,
    }),
  }
}
