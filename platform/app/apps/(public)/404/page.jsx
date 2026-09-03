'use client'

import Link from '@/components/Link'

export default function Page() {
  return (
    <div className="absolute top-0 left-0 w-screen h-screen flex flex-col justify-center items-center">
      <div className="mx-auto max-w-2xl">
        <main className="sm:flex">
          <p className="text-4xl font-bold tracking-tight text-indigo-600 sm:text-5xl">
            404
          </p>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
                Page Not Found
              </h1>
              <p className="mt-10 text-base text-gray-500 dark:text-gray-500">
                Seems like we screwed up.
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
  )
}
