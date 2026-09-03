import { PLAN_FREE, PLAN_TRIAL } from '@/config/limits'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

// @note `upgradable` comes from the plan's limit table (limits[plan]
// .upgradable), resolved server-side by the page - it replaces the old
// hardcoded top-of-ladder tier name
export default function BillingButtons({ plan, upgradable, returnTo, children }) {
  const router = useRouter()

  const { fetch } = useFetch({ loadingMessage: true, failureMessage: true })

  async function goToUpgrade(event) {
    event.preventDefault()

    router.push('/billing/upgrade')
  }

  async function skipTrial(event) {
    event.preventDefault()

    if (
      !confirm(
        'We will cancel your current trial and start your subscription immediately. Do you want to continue?'
      )
    ) {
      return
    }

    await fetch(`/api/billing/skip`, {
      data: {},

      successMessage: 'Your subscription was updated',
    })
  }

  async function goToBilling(event) {
    event.preventDefault()

    const { data, error } = await fetch(`/api/billing/session`, {
      data: {
        returnTo: returnTo || router.asPath,
      },
    })

    if (!error) {
      router.push(data.redirectUrl)
    }
  }

  async function goToBooster(event) {
    event.preventDefault()

    const { data, error } = await fetch(`/api/billing/checkout`, {
      data: {
        plan: 'booster',

        returnTo: returnTo || router.asPath,
      },
    })

    if (!error) {
      router.push(data.redirectUrl)
    }
  }

  return (
    <div className="flex flex-row gap-2">
      <button className="default-button" type="button" onClick={goToBilling}>
        Manage Billing
      </button>
      {plan === PLAN_TRIAL ? (
        <button className="default-button" type="button" onClick={skipTrial}>
          Skip Trial
        </button>
      ) : null}
      {plan === PLAN_FREE ? (
        <button className="primary-button" type="button" onClick={goToUpgrade}>
          Upgrade
        </button>
      ) : null}
      {plan !== PLAN_TRIAL && plan !== PLAN_FREE && upgradable ? (
        <button className="default-button" type="button" onClick={goToBooster}>
          <span>Add Booster</span>
        </button>
      ) : null}
      {plan !== PLAN_FREE && upgradable ? (
        <button className="primary-button" type="button" onClick={goToBilling}>
          Upgrade
        </button>
      ) : null}
      {children}
    </div>
  )
}
