import { useMemo } from 'react'

import Component from '@/components/Component'
import DarkModeSwitch from '@/components/DarkModeSwitch'
import Emoji from '@/components/Emoji'
import Link from '@/components/Link'
import { ListItem } from '@/components/List'
import PartnerBanner from '@/components/PartnerBanner'

import useRouter from '@/hooks/useRouter'

import ChatBotKitIcon from '@/public/icon.svg'

import { Disclosure } from '@headlessui/react'
import {
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function GroupItems({ className, items }) {
  const router = useRouter()

  const groupedItems = useMemo(() => {
    const groups = {}

    items.forEach((item) => {
      if (!groups[item.group]) {
        groups[item.group] = []
      }

      groups[item.group].push(item)
    })

    return groups
  }, [items])

  return (
    <div
      className={clsx(
        'hidden lg:flex lg:flex-row items-center whitespace-nowrap	space-x-1 h-full',
        className
      )}
    >
      {Object.entries(groupedItems).map(([group, items]) => {
        return (
          <div key={group} className="space-x-1">
            {items
              .filter(({ hideOnFull }) => !hideOnFull)
              .map(
                (
                  {
                    href,
                    title,

                    highlight = true,

                    exactMatch,

                    isExternal = /^\w+:\/\//.test(href),

                    hideOnSmall,

                    panel,
                  },

                  index // @note using index for keys because hrefs can be the same
                ) => {
                  const hasRoot =
                    href !== '/' && exactMatch
                      ? router.asPath === href
                      : router.asPath.startsWith(href)

                  const Wrapper = href
                    ? Link
                    : ({
                        href: _href,
                        target: _target,
                        className,
                        ...props
                      }) => (
                        <div
                          {...props}
                          className={clsx('cursor-default', className)}
                        />
                      )

                  return (
                    <div key={index} className="relative group inline-block">
                      <Wrapper
                        className={clsx(
                          'inline-flex items-center text-sm duration-150 px-3.5 py-1.5 rounded-full capitalize',
                          {
                            'text-gray-800 bg-gray-100 dark:text-gray-200 dark:bg-gray-900':
                              hasRoot && highlight,
                            'text-gray-500 group-hover:text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-200':
                              !(hasRoot && highlight),
                            'hidden xl:inline-block': hideOnSmall,
                          },
                          'relative z-20'
                        )}
                        href={href}
                        {...(isExternal ? { target: '_blank' } : null)}
                      >
                        {title}
                        {isExternal && (
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 inline-block ml-1" />
                        )}
                      </Wrapper>
                      {panel ? (
                        <div className="absolute z-10 -top-2 pt-12 transition ease-in-out duration-200 delay-100 group-hover:opacity-100 opacity-0 scale-0 group-hover:scale-100">
                          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black w-[700px] p-2 shadow-lg">
                            <div className="grid grid-cols-2 grid-gap-2 whitespace-normal">
                              {panel.items?.map(
                                ({
                                  title,
                                  description,
                                  href,
                                  emoji,

                                  target = /^\w+:\/\//.test(href)
                                    ? '_blank'
                                    : undefined,
                                }) => {
                                  return (
                                    <ListItem
                                      key={href}
                                      className="rounded-lg"
                                      icon={
                                        <Emoji className="text-6xl pt-2">
                                          {emoji}
                                        </Emoji>
                                      }
                                      title={title}
                                      body={description}
                                      link={href}
                                      target={target}
                                    />
                                  )
                                }
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                }
              )}
          </div>
        )
      })}
    </div>
  )
}

export function Separator({ className }) {
  return (
    <div
      className={clsx(
        'hidden lg:block h-4 w-[1px] bg-gray-300 dark:bg-gray-700 mx-4',
        className
      )}
    />
  )
}

export function MenuItem({ className, ...props }) {
  return (
    <Disclosure.Button
      {...props}
      className={clsx(
        className,
        'block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-200'
      )}
    />
  )
}

export function SignInMenuItem() {
  const router = useRouter()

  return (
    <MenuItem
      as={Link}
      href={{
        pathname: '/signin',
        query: { callbackUrl: router.asPath },
      }}
    >
      Sign In
    </MenuItem>
  )
}

export default function MainNavbar({
  rootUrl = '/',
  navigation = [],
  buttons = [],
  links = [],

  title,

  logoAs = ChatBotKitIcon,

  miniDarkModeSwitch = false,

  // @note the signed-in account UI is injected rather than imported so that
  // session-free surfaces (landing pages, partner sites) do not pull next-auth
  // into their bundle. See components/NavbarAccount.jsx.
  account = null,

  compact = false,

  partner,
}) {
  return (
    <Disclosure
      className="main-navbar print:hidden sticky top-0 z-30 w-full bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800"
      as="nav"
      unmount={false} // @note did it for SEO purposes but not sure if it helps
    >
      {({ open }) => (
        <>
          <div className="mx-auto px-4">
            <div className="relative flex items-center h-14 justify-between">
              <div className="flex items-center h-full">
                {compact ? (
                  <Link className="flex items-center gap-2.5" href={rootUrl}>
                    {partner ? (
                      <>
                        <PartnerBanner
                          className="text-lg h-[1.1em]"
                          partner={partner}
                        />
                        {!partner.whitelabel ? (
                          <>
                            <div className="hidden sm:block px-0.5 text-2xl leading-none text-gray-300 dark:text-gray-700">
                              &bull;
                            </div>
                            <div className="hidden sm:flex flex-row items-center gap-1 text-base">
                              <Component
                                className="w-[1.1em] h-[1.1em]"
                                as={logoAs}
                              />
                              <div className="font-black select-none">
                                {title}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <Component className="w-[30px] h-[30px]" as={logoAs} />
                    )}
                  </Link>
                ) : (
                  <Link
                    className="flex flex-row items-center gap-1 text-xl"
                    href={rootUrl}
                  >
                    {partner ? (
                      <>
                        <PartnerBanner
                          className="text-lg h-[1.1em]"
                          partner={partner}
                        />
                        {!partner.whitelabel ? (
                          <>
                            <div className="hidden sm:block px-0.5 text-2xl leading-none text-gray-300 dark:text-gray-700">
                              &bull;
                            </div>
                            <div className="hidden sm:flex flex-row items-center gap-1 text-base">
                              <Component
                                className="w-[1.1em] h-[1.1em]"
                                as={logoAs}
                              />
                              {title ? (
                                <div className="font-bold select-none">
                                  {title}
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Component
                          className="w-[1.1em] h-[1.1em]"
                          as={logoAs}
                        />
                        {title ? (
                          <div className="font-bold select-none">{title}</div>
                        ) : null}
                      </>
                    )}
                  </Link>
                )}
                {navigation?.length ? <Separator /> : null}
                <GroupItems items={navigation} />
              </div>
              <div className="hidden lg:ml-6 lg:flex lg:items-center space-x-4">
                {miniDarkModeSwitch ? (
                  <>
                    <DarkModeSwitch.Mini />
                    {buttons?.length || links?.length ? <Separator /> : null}
                  </>
                ) : null}
                {buttons?.map(({ title, href, as = Link, primary }, index) => {
                  return (
                    <Component
                      key={href || index}
                      className={clsx({
                        'primary-button': primary,
                        'default-button': !primary,
                      })}
                      href={href}
                      as={as}
                    >
                      {title}
                    </Component>
                  )
                })}
                {links?.length ? (
                  <>
                    {buttons?.length ? <Separator /> : null}
                    <GroupItems items={links} external={true} />
                  </>
                ) : null}
                {account ? (
                  <>
                    {buttons?.length || links?.length ? <Separator /> : null}
                    <account.Desktop />
                  </>
                ) : null}
              </div>
              <div className="-mr-2 flex items-center lg:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-white">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>
          <Disclosure.Panel className="lg:hidden">
            <div className="space-y-1 pt-2">
              {[...navigation, ...links].map(({ title, href }) => {
                return (
                  <Disclosure.Button
                    className="block py-2 pl-3 pr-4 text-base font-medium hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-900 dark:hover:text-gray-200"
                    key={href}
                    as={Link}
                    href={href}
                  >
                    {title}
                  </Disclosure.Button>
                )
              })}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4 pb-3">
              {account ? (
                <account.Mobile />
              ) : (
                <div className="mt-3 space-y-1">
                  <MenuItem as="div">
                    <DarkModeSwitch />
                  </MenuItem>
                  <SignInMenuItem />
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
