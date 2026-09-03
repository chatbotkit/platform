import { Fragment } from 'react'

import { q } from '@/lib/query.helpers'

import DarkModeSwitch from '@/components/DarkModeSwitch'
import DynamicIcon from '@/components/DynamicIcon'
import Link from '@/components/Link'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'
import useSignout from '@/hooks/useSignout'
import useTheme from '@/hooks/useTheme'

import { Menu, Transition } from '@headlessui/react'
import { UserCircleIcon } from '@heroicons/react/24/solid'

import clsx from 'clsx'

export const OPTIONAL_LINKS = []

export default function ProfileDropdown({
  compact,

  withDashboard = !compact,
  withApps = false,
  withHub = !compact,
  withBilling = true,
  withUsage = true,
  withDarkModeSwitch = !compact,

  className,

  children,

  ...props
}) {
  const withOptionalLinks = OPTIONAL_LINKS.length > 0 && !compact

  const { data: session } = useSession()

  // @note the billing entry only exists where the deployment has billing and
  // this user can reach it - in a planless or provider-less deployment the
  // billing pages 404, so the link must not render
  const showBilling = withBilling && session?.billing?.available === true

  const router = useRouter()

  const { signout } = useSignout()

  const { forcedTheme } = useTheme()

  if (forcedTheme) {
    withDarkModeSwitch = false
  }

  const { fetch } = useFetch({ loadingMessage: true, failureMessage: true })

  async function goToBilling(event) {
    event.preventDefault()

    const { error, data } = await fetch(`/api/billing/session`, {
      data: {
        returnTo: router.asPath,
      },
    })

    if (!error) {
      router.push(data.redirectUrl)
    }
  }

  return (
    <Menu {...props} as="div" className={clsx('shrink-0 relative', className)}>
      <div className="flex">
        <Menu.Button
          className={clsx(
            // @note without size-8 does not work in safari
            'default-button p-0 size-8 aspect-square rounded-full'
          )}
        >
          <span className="sr-only">Open user menu</span>
          {session?.user ? (
            session.user.image ? (
              <div className="size-full">
                <img
                  className="w-full h-full"
                  src={session.user.image}
                  alt=""
                />
              </div>
            ) : /@/.test(session.name) ? (
              <DynamicIcon
                className="size-full"
                icon={`@gravatar/${session.name}`}
              />
            ) : (
              <UserCircleIcon className="size-full" />
            )
          ) : (
            <UserCircleIcon className="size-full" />
          )}
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className={clsx(
            'absolute right-0 z-[100] origin-top-right',
            'mt-2 py-1',
            'w-48 rounded-md shadow-lg',
            'ring-1 ring-black dark:ring-white ring-opacity-5 focus:outline-none',
            'auto-bg-white auto-text-gray-700',
            'divide-y auto-divide-gray-100',
            'dark:border dark:border-gray-700'
          )}
        >
          {session?.user ? (
            <Menu.Item>
              {() => {
                const display =
                  session.name ||
                  session.user.displayName ||
                  session.user.displayEmail ||
                  session.user.name ||
                  session.user.email

                return (
                  <div className="block px-4 py-2 text-sm text-gray-500 truncate cursor-default">
                    {display}
                  </div>
                )
              }}
            </Menu.Item>
          ) : null}
          {children}
          {withDashboard ? (
            <Menu.Item>
              {({ active }) => (
                <Link
                  className={clsx(
                    {
                      'bg-gray-100 dark:bg-gray-900': active,
                    },
                    'hover:bg-gray-100 dark:hover:bg-gray-900',
                    'block px-4 py-2 text-sm'
                  )}
                  href="/overview"
                  target="_blank"
                >
                  Dashboard
                </Link>
              )}
            </Menu.Item>
          ) : null}
          {showBilling || withUsage || withOptionalLinks ? (
            <div>
              {showBilling ? (
                <>
                  {compact ? (
                    <Menu.Item>
                      {({ active }) => (
                        <div
                          onClick={goToBilling}
                          className={clsx(
                            {
                              'bg-gray-100 dark:bg-gray-900': active,
                            },
                            'hover:bg-gray-100 dark:hover:bg-gray-900',
                            'block px-4 py-2 text-sm',
                            'cursor-pointer'
                          )}
                        >
                          Billing
                        </div>
                      )}
                    </Menu.Item>
                  ) : (
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          className={clsx(
                            {
                              'bg-gray-100 dark:bg-gray-900': active,
                            },
                            'hover:bg-gray-100 dark:hover:bg-gray-900',
                            'block px-4 py-2 text-sm'
                          )}
                          href="/billing"
                        >
                          Billing
                        </Link>
                      )}
                    </Menu.Item>
                  )}
                </>
              ) : null}
              {withUsage ? (
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      className={clsx(
                        {
                          'bg-gray-100 dark:bg-gray-900': active,
                        },
                        'hover:bg-gray-100 dark:hover:bg-gray-900',
                        'block px-4 py-2 text-sm'
                      )}
                      href="/usage"
                    >
                      Usage
                    </Link>
                  )}
                </Menu.Item>
              ) : null}
              {withOptionalLinks ? (
                <Menu.Item>
                  {({ active }) => (
                    <>
                      {OPTIONAL_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          className={clsx(
                            {
                              'bg-gray-100 dark:bg-gray-900': active,
                            },
                            'hover:bg-gray-100 dark:hover:bg-gray-900',
                            'block px-4 py-2 text-sm'
                          )}
                          href={link.href}
                        >
                          {link.name}
                        </Link>
                      ))}
                    </>
                  )}
                </Menu.Item>
              ) : null}
            </div>
          ) : null}
          {withApps || withHub ? (
            <div>
              {withApps ? (
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      className={clsx(
                        {
                          'bg-gray-100 dark:bg-gray-900': active,
                        },
                        'hover:bg-gray-100 dark:hover:bg-gray-900',
                        'block px-4 py-2 text-sm'
                      )}
                      href="/apps"
                      target="_blank"
                    >
                      Apps
                    </Link>
                  )}
                </Menu.Item>
              ) : null}
              {withHub ? (
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      className={clsx(
                        {
                          'bg-gray-100 dark:bg-gray-900': active,
                        },
                        'hover:bg-gray-100 dark:hover:bg-gray-900',
                        'block px-4 py-2 text-sm'
                      )}
                      href="/hub"
                      target="_blank"
                    >
                      Hub
                    </Link>
                  )}
                </Menu.Item>
              ) : null}
            </div>
          ) : null}
          {withDarkModeSwitch ? (
            <Menu.Item>
              <div className="px-4 py-2 text-sm">
                <DarkModeSwitch />
              </div>
            </Menu.Item>
          ) : null}
          <Menu.Item>
            {({ active }) =>
              session?.user ? (
                <div onClick={() => signout()}>
                  <div
                    className={clsx(
                      {
                        'bg-gray-100 dark:bg-gray-900': active,
                      },
                      'hover:bg-gray-100 dark:hover:bg-gray-900',
                      'block px-4 py-2 text-sm cursor-pointer'
                    )}
                  >
                    Sign Out
                  </div>
                </div>
              ) : (
                <div>
                  <Link
                    className={clsx(
                      {
                        'bg-gray-100 dark:bg-gray-900': active,
                      },
                      'hover:bg-gray-100 dark:hover:bg-gray-900',
                      'block px-4 py-2 text-sm',
                      'cursor-pointer'
                    )}
                    // @todo removed because for whatever reason it does not
                    // work - this profile dropdown should be replaced with a
                    // simpler components based on pure react - no headlessui
                    // href={{
                    //   pathname: '/signin',
                    //   query: { callbackUrl: router.asPath },
                    // }}
                    href={`/signin?${q({ callbackUrl: router.asPath })}`}
                  >
                    Sign In
                  </Link>
                </div>
              )
            }
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}
