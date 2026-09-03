import { getSoftSession } from '@/lib/session.get'

import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import Link from '@/components/Link'

import usePartner from '@/hooks/usePartner'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

export default function Page({ supportEmail }) {
  const partner = usePartner()

  const widgetInstance = useWidgetInstance('chatbotkit-widget')

  function handleLaunchSupportBot() {
    if (widgetInstance) {
      widgetInstance.open = true
    }
  }

  const hasEmailSupport = !!supportEmail && !partner?.whitelabel

  return (
    <div className="main-page">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Support</h1>
        <p className="sm:text-sm">
          {hasEmailSupport || widgetInstance
            ? 'Contact us by email, or launch the support widget if you want help directly inside the dashboard.'
            : 'No support channels are configured for this deployment. Please contact your administrator.'}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:auto-rows-fr lg:grid-cols-2">
        {hasEmailSupport ? (
          <div className="flex h-full flex-col rounded-xl border auto-border-gray-200 auto-bg-white p-6">
            <div className="flex h-full flex-col justify-between gap-3">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold auto-text-gray-900">
                  Email support
                </h2>
                <p className="text-sm auto-text-gray-600">
                  Send us an email for account, billing, and platform questions.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  className="default-button"
                  href={`mailto:${supportEmail}`}
                >
                  Email support
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {widgetInstance ? (
          <div className="flex h-full flex-col rounded-xl border auto-border-gray-200 auto-bg-white p-6">
            <div className="flex h-full flex-col justify-between gap-3">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold auto-text-gray-900">
                  Widget agent
                </h2>
                <p className="text-sm auto-text-gray-600">
                  Open the support widget to ask quick questions without
                  leaving the dashboard.
                </p>
              </div>
              <div className="pt-2">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleLaunchSupportBot}
                >
                  Launch support widget
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

Page.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Contact ChatBotKit Support"
      description="Have a question, issue, or just want to chat? Reach out to us through one of our contact channels or get instant support from our AI bot."
      authenticated={authenticated}
    >
      {children}
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  return {
    redirect: !session
      ? {
          destination: `/signin?callbackUrl=${context.resolvedUrl}`,
          permanent: false,
        }
      : undefined,
    props: makeJsonSafe({
      authenticated: true,

      supportEmail: process.env.SUPPORT_EMAIL || null,
    }),
  }
}
