import Link from '@/components/Link'

import Meta from '@/components/Meta'
import Widget from '@/components/Widget'
import { useWidgetNotifications } from '@/components/Widget'

import clsx from 'clsx'

export default function Page() {
  useWidgetNotifications({
    notifications: {
      contact: {
        text: 'It seems like we screwed up. Sorry about that. 😔\n\nPlease tell us what happened.\n\nYour feedback is important to us.',
      },
    },
  })

  return (
    <main>
      <Widget />
      <Meta breadcrumbs={['ChatBotKit']} title="500 Internal Server Error" />
      <div
        className={clsx(
          'min-h-screen bg-white dark:bg-black py-16 px-6 sm:py-24 md:grid md:place-items-center lg:px-8'
        )}
      >
        <div className="mx-auto max-w-2xl">
          <main className="sm:flex">
            <p className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
              500
            </p>
            <div className="sm:ml-6">
              <div className="sm:border-l auto-border-gray-200 sm:pl-6">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl [text-wrap:balance]">
                  Internal Server Error
                </h1>
                <p className="mt-10 text-base text-gray-500">
                  Something went wrong on our end. We have been notified and are
                  looking into it. Please try again in a moment.
                </p>
              </div>
              <div className="mt-10 flex space-x-3 sm:border-l sm:border-transparent sm:pl-6">
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
