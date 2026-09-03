// @note the in-product upgrade surface. It replaced a hand-written catalogue
// of five hosted tiers - names, prices and feature copy written into the
// component - which crashed outright on any catalogue that did not define
// `pro` and `scale`, and advertised a business every self-hosted deployment
// inherited whether or not it was theirs.
//
// Everything here comes from the deployment's own configuration: which plans
// are sellable, what they cost, whether a trial is offered, and what each one
// grants. The marketing case for the hosted plans lives on the marketing site,
// which has its own pricing page; this answers the narrower question a
// signed-in user is actually asking - what do I get if I upgrade.
//
// The surface reads as a pricing page rather than a diff: cards lead with
// each plan's absolute entitlements, the user's own rung is on the ladder for
// scale, an unbounded plan renders as a conversation rather than vanishing,
// and the full limit tables land in a comparison matrix below the cards.
import { Fragment, useEffect, useRef, useState } from 'react'

import { PLAN_TRIAL } from '@/config/limits'

import { shortFormat } from '@/lib/number'
import {
  headlineEntitlements,
  limitMatrix,
  planLadder,
} from '@/lib/plan.compare'

import Link from '@/components/Link'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import clsx from 'clsx'
import { Check as CheckIcon } from 'lucide-react'

/**
 * Renders a limit value. The tables carry numbers, booleans and unbounded
 * values, and each reads differently.
 */
export function formatLimitValue(value) {
  if (value === undefined) {
    return '—'
  }

  if (value === true) {
    return 'Yes'
  }

  if (value === false) {
    return 'No'
  }

  if (value === Infinity || value === null) {
    return '∞'
  }

  if (typeof value === 'number') {
    return shortFormat(value)
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

/**
 * Renders a headline entitlement as a phrase - a capability reads as its own
 * name, a quantity leads with its size.
 */
export function formatEntitlement({ label, value }) {
  if (value === true) {
    return label
  }

  if (value === Infinity || value === null) {
    return `Unlimited ${label}`
  }

  if (typeof value === 'number') {
    return `${shortFormat(value)} ${label}`
  }

  return `${String(value)} ${label}`
}

function PlanBadge({ children }) {
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-4 py-1 text-xs font-bold text-white dark:bg-white dark:text-black">
      {children}
    </div>
  )
}

// @note everything about the selling configuration reaches this component as
// props from the page's server side - the billing module is server-only and
// nothing of it rides in the client bundle. `subscriptions.pricing` carries
// null for a plan that is not self-serve: Infinity does not survive
// serialization, so it is restored here.
export default function UpgradePlans({
  currentPlan,
  limits,
  subscriptions,
  trialPlans,
}) {
  const router = useRouter()

  const { fetch } = useFetch()

  // @note the matrix opens on what differs - that is the comparison - and
  // expands to the full catalogue on demand
  const [showAllLimits, setShowAllLimits] = useState(false)

  // @note the header row sticks 4.5rem below the viewport top to clear the
  // fixed profile bar, which leaves a strip above it where rows would show
  // through - the profile bar has no full-width background. While the header
  // is actually stuck, an opaque cover hides that strip; at rest the cover
  // must not exist or it would paint over the page. 72 is the pixel twin of
  // the header cells' top-[4.5rem].
  const matrixRef = useRef(null)

  const [headerStuck, setHeaderStuck] = useState(false)

  useEffect(() => {
    function onScroll() {
      const rect = matrixRef.current?.getBoundingClientRect()

      setHeaderStuck(!!rect && rect.top < 72 && rect.bottom > 72)
    }

    onScroll()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // @note a trialing user is billed nowhere yet - the rung to mark as theirs
  // is the plan the trial converts into
  const primaryTrialPlan = trialPlans?.[0]

  const pricing = Object.fromEntries(
    Object.entries(subscriptions?.pricing ?? {}).map(([plan, price]) => [
      plan,
      price ?? Infinity,
    ])
  )

  const anchorPlan = currentPlan === PLAN_TRIAL ? primaryTrialPlan : currentPlan

  const rungs = planLadder(pricing, anchorPlan)

  async function goToCheckout(plan, trial) {
    const { data, error } = await fetch('/api/billing/checkout', {
      data: { plan, trial, returnTo: router.asPath },
    })

    if (!error) {
      router.push(data.redirectUrl)
    }
  }

  if (!rungs.some(({ current }) => !current)) {
    // @note a deployment with nothing left to sell this user - already on the
    // top plan, or selling nothing self-serve
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        There is nothing to upgrade to on this deployment.
      </div>
    )
  }

  // @note the deployment's own signal for which plan to feature: the plan it
  // leads its trials with - no plan name is hardcoded here
  const featuredPlan = primaryTrialPlan

  const rows = limitMatrix(rungs.map(({ plan }) => limits?.[plan]))

  // @note a row where every plan renders the same value is not a reason to
  // pick one plan over another, so it hides until the full table is asked for
  const diffRows = rows.filter(
    ({ values }) => new Set(values.map(formatLimitValue)).size > 1
  )

  const visibleRows = showAllLimits || !diffRows.length ? rows : diffRows

  return (
    <div className="space-y-16">
      <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        {rungs.map(({ plan, label, price, current, selfServe }) => {
          const trial = selfServe && !current && trialPlans?.includes(plan)
          const featured = !current && plan === featuredPlan

          const entitlements = headlineEntitlements(limits?.[plan])

          return (
            <div
              key={plan}
              className={clsx(
                'relative flex flex-col rounded-2xl bg-white p-8 dark:bg-black',
                current || featured
                  ? 'border-2 border-gray-900 dark:border-white'
                  : 'border border-gray-200 dark:border-gray-800'
              )}
            >
              {current ? <PlanBadge>Current plan</PlanBadge> : null}
              {featured ? <PlanBadge>Recommended</PlanBadge> : null}

              <h3 className="text-lg font-bold">{label}</h3>

              <p className="mt-2">
                {Number.isFinite(price) ? (
                  <>
                    <span className="text-3xl font-bold">${price}</span>

                    <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                      / month
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-bold">Custom</span>
                )}
              </p>

              {entitlements.length ? (
                <ul className="mt-6 flex-1 space-y-2 text-sm">
                  {entitlements.map((entitlement) => (
                    <li key={entitlement.key} className="flex gap-2">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>{formatEntitlement(entitlement)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1" />
              )}

              {current ? (
                <div className="mt-8 w-full rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-bold text-gray-400 dark:border-gray-800 dark:text-gray-600">
                  Your plan
                </div>
              ) : selfServe ? (
                <button
                  type="button"
                  onClick={() => goToCheckout(plan, trial)}
                  className="mt-8 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-black"
                >
                  {trial
                    ? `Start ${subscriptions.trialDays}-day trial`
                    : `Switch to ${label}`}
                </button>
              ) : (
                <Link
                  href="/support"
                  className="mt-8 w-full rounded-lg border border-gray-900 px-4 py-2 text-center text-sm font-bold dark:border-white"
                >
                  Contact us
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {rows.length ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">Compare plans</h2>

            {diffRows.length && diffRows.length !== rows.length ? (
              <button
                type="button"
                onClick={() => setShowAllLimits(!showAllLimits)}
                className="text-sm text-gray-500 underline underline-offset-4 dark:text-gray-400"
              >
                {showAllLimits
                  ? 'Show differences only'
                  : `Show all limits (${rows.length})`}
              </button>
            ) : null}
          </div>

          {headerStuck ? (
            // @note sits above the scrolling rows (including the z-10 sticky
            // label column) and below the z-20 header cells and the z-40
            // profile bar; starts past the fixed w-64 sidebar on md+. Only on
            // xl - below that the overflow wrapper stops the header sticking,
            // so there is nothing to cover for
            <div
              aria-hidden
              className="fixed left-0 right-0 top-0 z-[15] hidden h-[4.5rem] bg-white dark:bg-black md:left-64 xl:block"
            />
          ) : null}

          {/* @note the wrapper scrolls sideways only where the table cannot
              fit - a scroll container on any axis would stop the header row
              sticking to the viewport, so on wide screens it is not one */}
          <div
            ref={matrixRef}
            className="mt-6 overflow-x-auto xl:overflow-x-visible"
          >
            <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {/* @note the vertical offset clears the fixed profile bar
                      (p-4 plus a button row), which would otherwise cover the
                      stuck plan names */}
                  <th className="sticky left-0 top-[4.5rem] z-30 w-64 border-b border-gray-100 bg-white py-3 pr-4 dark:border-gray-900 dark:bg-black" />

                  {rungs.map(({ plan, label, current }) => (
                    <th
                      key={plan}
                      className={clsx(
                        'sticky top-[4.5rem] z-20 border-b border-gray-100 px-4 py-3 text-center align-top font-bold dark:border-gray-900',
                        current
                          ? 'rounded-t-xl bg-gray-50 dark:bg-gray-950'
                          : 'bg-white dark:bg-black'
                      )}
                    >
                      {label}

                      {current ? (
                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          current
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row, index) => (
                  <Fragment key={row.key}>
                    {row.section &&
                    row.section !== visibleRows[index - 1]?.section ? (
                      <tr>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white pb-2 pt-10 text-xs font-bold uppercase tracking-wide text-gray-400 dark:bg-black dark:text-gray-600">
                          {row.section}
                        </td>

                        {rungs.map(({ plan, current }) => (
                          <td
                            key={plan}
                            className={clsx(
                              current && 'bg-gray-50 dark:bg-gray-950'
                            )}
                          />
                        ))}
                      </tr>
                    ) : null}

                    <tr>
                      <td className="sticky left-0 z-10 border-t border-gray-100 bg-white py-3 pr-4 text-gray-500 dark:border-gray-900 dark:bg-black dark:text-gray-400">
                        {row.label}
                      </td>

                      {row.values.map((value, column) => (
                        <td
                          key={rungs[column].plan}
                          className={clsx(
                            'border-t border-gray-100 px-4 py-3 text-center tabular-nums dark:border-gray-900',
                            rungs[column].current &&
                              'bg-gray-50 dark:bg-gray-950'
                          )}
                        >
                          {value === true ? (
                            <CheckIcon className="mx-auto h-4 w-4" />
                          ) : value === false || value === undefined ? (
                            <span className="text-gray-300 dark:text-gray-700">
                              &mdash;
                            </span>
                          ) : (
                            formatLimitValue(value)
                          )}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
