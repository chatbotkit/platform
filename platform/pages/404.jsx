import Link from '@/components/Link'

import Meta from '@/components/Meta'
import Widget from '@/components/Widget'
import { useWidgetNotifications } from '@/components/Widget'

import useFetch from '@/hooks/useFetch'
import { persistProjectScope } from '@/hooks/useProjectScope'
import useSession from '@/hooks/useSession'
import useUserSwitch from '@/hooks/useUserSwitch'

import clsx from 'clsx'

export default function Page() {
  useWidgetNotifications({
    notifications: {
      contact: {
        text: "Hey there! We couldn't find the page you were looking for. We are really sorry about this! 😔\n\nPlease tell us what happened.\n\nYour feedback is important to us.",
      },
    },
  })

  const { isSwitched: userIsSwitched } = useUserSwitch()

  const { data: session } = useSession()

  const { fetch } = useFetch()

  return (
    <main>
      <Widget />
      <Meta breadcrumbs={['ChatBotKit']} title="404 Page Not Found" />
      <div
        className={clsx(
          'min-h-screen bg-white dark:bg-black py-16 px-6 sm:py-24 md:grid md:place-items-center lg:px-8'
        )}
      >
        <div className="mx-auto max-w-2xl">
          <main className="sm:flex">
            <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
              404
            </p>
            <div className="sm:ml-6">
              <div className="sm:border-l auto-border-gray-200 sm:pl-6">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl [text-wrap:balance]">
                  Page Not Found
                </h1>
                <p className="mt-10 text-base text-gray-500">
                  Sorry, we couldn’t find the page you’re looking for. Please
                  check the URL in the address bar and try again.
                </p>
              </div>
              <div className="mt-10 flex space-x-3 sm:border-l sm:border-transparent sm:pl-6">
                {userIsSwitched ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={async () => {
                      const { error } = await fetch(`/api/me/team/unswitch`, {
                        data: {},

                        loadingMessage: 'Switching back to your account...',
                      })

                      if (!error) {
                        // @note this page sits outside the dashboard, so there
                        // is no project scope provider around to hear about the
                        // account change - drop the stored scope of the account
                        // we are leaving before it rehydrates on the way back in
                        persistProjectScope(session?.user?.id, null)

                        window.location.reload()
                      }
                    }}
                  >
                    Unswitch
                  </button>
                ) : null}
                <Link className="primary-button" href="/">
                  Go back home
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </main>
  )
}
