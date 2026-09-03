import { memo, useEffect, useMemo, useState } from 'react'

import { PLAN_FREE } from '@/config/limits'

import { formatPlanLabel } from '@/lib/plan.label'

import Confirm from '@/components/Confirm'
import DashboardCommandPalette from '@/components/DashboardCommandPalette'
import { getDocsHref } from '@/components/DocsLink'
import Link from '@/components/Link'
import MenuButton from '@/components/MenuButton'
import Meta from '@/components/Meta'
import { NestedAccordionMenu } from '@/components/NestedAccordion'
import NotificationsButton from '@/components/NotificationsButton'
import PartnerBanner from '@/components/PartnerBanner'
import ProfileBar from '@/components/ProfileBar'
import ProjectScopeSelector from '@/components/ProjectScopeSelector'
import RewardsButton from '@/components/RewardsButton'
import SessionContext, {
  TeamSwitchButton,
  UserSwitchButton,
  useSessionContext,
} from '@/components/SessionContext'
import SuperTools, {
  useSuperTools,
  useSuperToolsVisible,
} from '@/components/SuperTools'
import SwitchBar from '@/components/SwitchBar'
import Widget from '@/components/Widget'

import useBuilderExperience from '@/hooks/useBuilderExperience'
import useMediaQuery from '@/hooks/useMediaQuery'
import usePartner from '@/hooks/usePartner'
import { ProjectScopeProvider } from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'

import ChatBotKitIcon from '@/public/icon.svg'

import { Menu } from '@headlessui/react'

import clsx from 'clsx'

// --- Constants ---

export const rootUrl = '/overview'

export const defaultCollapsible = true

// --- Menu Items ---

// @note re-exported so existing consumers keep their import site; the
// structural constant itself lives in @/config/limits and is client-safe
export const freePlan = PLAN_FREE

export const main = [
  {
    icon: '@lucide/layout-dashboard',
    title: 'Overview',
    href: '/overview',
  },
]

export const interactions = [
  {
    icon: '@lucide/user',
    title: 'Contacts',
    href: '/contacts',
  },
  {
    icon: '@lucide/circle-check',
    title: 'Tasks',
    href: '/tasks',
  },
  {
    icon: '@lucide/message-square',
    title: 'Conversations',
    href: '/conversations',
  },
  {
    icon: '@lucide/list',
    title: 'Memories',
    href: '/memories',
  },
  {
    icon: '@lucide/thumbs-up',
    title: 'Ratings',
    href: '/ratings',
  },
]

export const projects = [
  {
    icon: '@lucide/map',
    title: 'Blueprints',
    href: '/blueprints',
  },
]

export const resources = [
  {
    title: 'Bots',
    href: '/bots',
    group: 'app',
  },
  {
    title: 'Datasets',
    href: '/datasets',
    group: 'app',
  },
  {
    title: 'Skillsets',
    href: '/skillsets',
    group: 'app',
  },
  {
    title: 'Files',
    href: '/files',
  },
  {
    title: 'Secrets',
    href: '/secrets',
  },
  {
    title: 'Spaces',
    href: '/spaces',
  },
  {
    title: 'Portals',
    href: '/portals',
  },
]

export const integrations = [
  {
    icon: '@lucide/puzzle',
    title: 'Integrations',
    href: '/integrations',
    group: 'app',
  },
]
const compliance = [
  {
    title: 'Policies',
    href: '/policies',
  },
]

const observability = [
  {
    title: 'Analytics',
    href: '/analytics',
  },
  {
    title: 'Usage',
    href: '/usage',
  },
  {
    title: 'Alerts',
    href: '/alerts',
  },
  {
    title: 'Events',
    href: '/events',
  },
  {
    title: 'Audit',
    href: '/audit',
  },
]

const developer = [
  {
    title: 'Tokens',
    href: '/tokens',
  },
  {
    title: 'Webhooks',
    href: '/webhooks',
  },
  {
    title: 'Playground',
    href: '/playground',
  },
]

const playgroundItems = [
  {
    title: 'Conversation',
    href: '/playground/conversation',
    description: 'AI Conversation Playground',
  },
  {
    title: 'Situation',
    href: '/playground/situation',
    description: 'AI Bot Situation Playground',
  },
  {
    title: 'Entity',
    href: '/playground/entity',
    description: 'Entity Playground',
  },
  {
    title: 'Backstory',
    href: '/playground/backstory',
    description: 'AI Bot Backstory Playground',
  },
  {
    title: 'Record',
    href: '/playground/record',
    description: 'Dataset Record Playground',
  },
  {
    title: 'Ability',
    href: '/playground/ability',
    description: 'Ability Playground',
  },
  {
    title: 'Image',
    href: '/playground/image',
    description: 'Generative AI Image Playground',
  },
  {
    title: 'Widget',
    href: '/playground/widget',
    description: 'AI Widget Playground',
  },
  {
    title: 'Message',
    href: '/playground/message',
    description: 'Message Rendering Playground',
  },
  {
    title: 'API',
    href: '/playground/api',
    description: 'API Playground',
  },
  {
    title: 'GraphQL',
    href: '/playground/graphql',
    description: 'GraphQL Playground',
  },
  {
    title: 'JSONPath',
    href: '/playground/jsonpath',
    description: 'JSONPath Evaluator Playground',
  },
  {
    title: 'JMESPath',
    href: '/playground/jmespath',
    description: 'JMESPath Tester Playground',
  },
  {
    title: 'HTML',
    href: '/playground/html',
    description: 'HTML Tester Playground',
  },
  {
    title: 'PDF',
    href: '/playground/pdf',
    description: 'PDF to Text Playground',
  },
]

const organization = [
  {
    title: 'Teams',
    href: '/teams',
  },
  {
    title: 'Users',
    href: '/users',
  },
]

// const account = [
//   {
//     title: 'Billing',
//     href: '/billing',
//   },
// ]

const help = [
  {
    title: 'Support',
    href: '/support',
  },
  {
    title: 'Documentation',
    href: getDocsHref(),
    target: '_blank',
    external: true,
  },
  {
    title: 'Examples',
    href: '/examples',
    target: '_blank',
    external: true,
  },
  {
    title: 'Community',
    href: 'https://go.cbk.ai/discord',
    target: '_blank',
    external: true,
  },
]

// --- Menu Composition Helpers ---

function pickItems(items, titles) {
  return items.filter((item) => titles.includes(item.title))
}

function omitItems(items, titles) {
  return items.filter((item) => !titles.includes(item.title))
}

function promoteItems(items, icon) {
  return items.map((item) => ({ ...item, icon: item.icon || icon }))
}

function demoteItems(items) {
  return items.map(({ icon: _icon, ...item }) => item)
}

// @note what a drilldown holds becomes the sections of the menu it opens, and
// the menu rules a line between its sections - so a plain list of links has to
// arrive as a single section, or it draws as a stack of divided rows
function asMenu(key, items) {
  return [{ key, items, expanded: true, collapsible: false }]
}

// @note everything the builder experience does not lead with, grouped exactly
// as the platform experience groups it at its top level - see the Advanced
// section in buildMenu
export function buildAdvancedGroups() {
  return [
    {
      title: 'Resources',
      items: omitItems(resources, ['Bots', 'Datasets', 'Skillsets']),
    },
    {
      title: 'Interactions',
      items: omitItems(interactions, ['Contacts', 'Conversations']),
    },
    {
      title: 'Compliance',
      items: compliance,
    },
    {
      title: 'Observability',
      items: omitItems(observability, ['Analytics']),
    },
    {
      title: 'Developer',
      items: developer,
    },
  ]
}

/**
 * Builds the sidebar menu sections for the current host and partner context.
 */
export function buildMenu({ builder, partner }) {
  const whitelabel = partner?.whitelabel

  const organizationSection = {
    key: 'organization',
    title: 'Organization',
    icon: '@lucide/user',
    drilldown: true,
    items: asMenu('organization', organization),
  }

  const helpSections = whitelabel
    ? []
    : [
        {
          key: 'help',
          title: 'Help',
          icon: '@lucide/circle-help',
          drilldown: true,
          items: asMenu('help', help),
        },
      ]

  if (builder) {
    return [
      {
        key: 'main',
        items: main,
        expanded: true,
        collapsible: false,
      },
      {
        key: 'interactions',
        items: pickItems(interactions, ['Contacts', 'Conversations']),
        flat: true,
        expanded: true,
        collapsible: false,
      },
      {
        key: 'build',
        items: [
          ...promoteItems(pickItems(resources, ['Bots']), '@lucide/bot'),
          ...promoteItems(
            pickItems(resources, ['Datasets']),
            '@lucide/database'
          ),
          ...promoteItems(pickItems(resources, ['Skillsets']), '@lucide/zap'),
          ...integrations,
        ],
        flat: true,
        expanded: true,
        collapsible: false,
      },
      {
        key: 'insights',
        className: 'flex-1',
        items: promoteItems(
          pickItems(observability, ['Analytics']),
          '@lucide/chart-pie'
        ),
        flat: true,
        expanded: true,
        collapsible: false,
      },
      // @note Advanced is a door rather than a section - following it hands the
      // whole sidebar over to these groups instead of unfolding them below. So
      // nothing it holds competes with the builder journey above for room, and
      // the groups are free to lay the platform primitives out in full.
      {
        key: 'advanced',
        title: 'Advanced',
        icon: '@lucide/wrench',
        drilldown: true,
        items: buildAdvancedGroups().map(({ title, items }) => ({
          key: title.toLowerCase(),
          title,
          items: demoteItems(items),
          expanded: true,
          collapsible: false,
        })),
      },
      organizationSection,
      ...helpSections,
    ]
  }

  return [
    {
      key: 'main',
      items: main,
      expanded: true,
      collapsible: false,
    },
    {
      key: 'projects',
      items: projects,
      flat: true,
      expanded: true,
      collapsible: false,
    },
    {
      key: 'resources',
      className: 'flex-1',
      title: 'Resources',
      icon: '@lucide/box',
      items: resources,
      flat: true,
      expanded: true,
      collapsible: defaultCollapsible,
    },
    {
      key: 'integrations',
      items: integrations,
      flat: true,
      expanded: true,
      collapsible: false,
    },
    // @note the platform experience leads with what you build - projects,
    // resources, integrations - and puts the interactions those produce behind
    // a door, alongside the other secondary sections below
    {
      key: 'interactions',
      title: 'Interactions',
      icon: '@lucide/inbox',
      drilldown: true,
      items: asMenu('interactions', demoteItems(interactions)),
    },
    {
      key: 'compliance',
      title: 'Compliance',
      icon: '@lucide/circle-check',
      drilldown: true,
      items: asMenu('compliance', compliance),
    },
    {
      key: 'observability',
      title: 'Observability',
      icon: '@lucide/chart-pie',
      drilldown: true,
      items: asMenu('observability', observability),
    },
    {
      key: 'developer',
      title: 'Developer',
      icon: '@lucide/code',
      drilldown: true,
      items: asMenu('developer', developer),
    },
    organizationSection,
    ...helpSections,
  ]
}

/**
 * Builds command palette entries for the current host and partner context.
 */
export function buildQuickAccessItems({ builder, partner }) {
  return [
    { group: 'Main', items: main },
    { group: 'Interactions', items: interactions },
    { group: 'Resources', items: resources },
    ...(!builder ? [{ group: 'Projects', items: projects }] : []),
    { group: 'Integrations', items: integrations },
    { group: 'Compliance', items: compliance },
    { group: 'Observability', items: observability },
    { group: 'Developer', items: developer },
    { group: 'Playgrounds', items: playgroundItems },
    { group: 'Organization', items: organization },
    ...(!partner?.whitelabel ? [{ group: 'Help', items: help }] : []),
  ].flatMap(({ group, items }) =>
    items.map((item) => ({
      id: `${group.toLowerCase()}-${item.href}`,
      label: item.title,
      description: item.description || item.href,
      href: item.href,
      icon: item.icon,
      group,
      target: item.target,
      external: item.external,
      keywords: [item.title, group, item.description].filter(Boolean),
    }))
  )
}

// --- Components ---

/**
 *
 */
export function CommandPaletteHint() {
  const isWideEnough = useMediaQuery('(min-width: 768px)')

  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!isWideEnough) {
      return undefined
    }

    const fadeTimer = setTimeout(() => setFading(true), 4000)
    const hideTimer = setTimeout(() => setVisible(false), 5000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [isWideEnough])

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.match('Mac')

  if (!isWideEnough || !visible) {
    return null
  }

  return (
    <span
      className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap transition-opacity duration-1000"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <kbd className="font-mono">{isMac ? '⌘' : 'Ctrl'}+K</kbd> to open command
      palette
    </span>
  )
}

/**
 *
 */
export function Assistant() {
  return <Widget />
}

Assistant.Memo = memo(Assistant)

// --- Dashboard Layout ---

/**
 *
 */
export default SessionContext.withSessionContext(function Dashboard({
  breadcrumbs,
  title,
  description,
  keywords,
  image,

  baseUrl,

  children,
}) {
  const router = useRouter()

  const { data: session, status } = useSession()

  const {
    isTeamSwitched,
    isUserSwitched,
    teams,
    users,
    openTeamSwitchPopup,
    openUserSwitchPopup,
  } = useSessionContext()

  const isSwitched = isTeamSwitched || isUserSwitched

  const partner = usePartner()

  // @note the community offer speaks for our own brand and is aimed at accounts
  // we have not converted yet, so it is gated exactly like the upgrade button -
  // free tier only, never under whitelabel
  const isFreePlan = !partner?.whitelabel && session?.billing?.plan === freePlan

  const { open: openSuperTools } = useSuperTools()

  const isSuperToolsVisible = useSuperToolsVisible()

  const isBuilderExperience = useBuilderExperience()

  const quickAccessItems = useMemo(
    () => buildQuickAccessItems({ builder: isBuilderExperience, partner }),
    [isBuilderExperience, partner]
  )

  const menuSections = useMemo(
    () => buildMenu({ builder: isBuilderExperience, partner }),
    [isBuilderExperience, partner]
  )

  return (
    <ProjectScopeProvider
      enabled={isBuilderExperience}
      ownerId={session?.user?.id}
    >
      <Confirm>
        <div className="min-h-[calc(100vh-4rem)] auto-bg-white">
          <Meta
            breadcrumbs={breadcrumbs}
            title={title}
            description={description}
            keywords={keywords}
            image={image}
            baseUrl={baseUrl}
          />
          <Assistant.Memo />
          <DashboardCommandPalette items={quickAccessItems} />
          <ProfileBar
            className={clsx({
              'top-10': isSwitched,
            })}
            withDashboard={false}
            withHub={partner?.whitelabel ? false : isBuilderExperience}
            withApps={partner?.whitelabel ? false : isBuilderExperience}
            withBilling={partner?.whitelabel ? false : true}
            withUsage={partner?.whitelabel ? false : true}
            withDarkModeSwitch={true}
            dropdownChildren={
              teams.length || users.length ? (
                <div>
                  {teams.length ? (
                    <Menu.Item>
                      {({ active }) => (
                        <TeamSwitchButton
                          className={clsx(
                            'w-full text-left',
                            {
                              'bg-gray-100 dark:bg-gray-900': active,
                            },
                            'hover:bg-gray-100 dark:hover:bg-gray-900',
                            'block px-4 py-2 text-sm',
                            'cursor-pointer'
                          )}
                        >
                          Switch Team
                        </TeamSwitchButton>
                      )}
                    </Menu.Item>
                  ) : null}
                  {users.length ? (
                    <Menu.Item>
                      {({ active }) => (
                        <UserSwitchButton
                          className={clsx(
                            'w-full text-left',
                            {
                              'bg-gray-100 dark:bg-gray-900': active,
                            },
                            'hover:bg-gray-100 dark:hover:bg-gray-900',
                            'block px-4 py-2 text-sm',
                            'cursor-pointer'
                          )}
                        >
                          Switch User
                        </UserSwitchButton>
                      )}
                    </Menu.Item>
                  ) : null}
                </div>
              ) : null
            }
          >
            {session?.user ? <CommandPaletteHint /> : null}
            {status === 'loading' ? null : session?.user ? null : (
              <Link
                className="primary-button"
                href={{
                  pathname: '/signin',
                  query: {
                    callbackUrl: router.asPath,
                  },
                }}
              >
                Sign In
              </Link>
            )}
            {session?.user ? <NotificationsButton /> : null}
            {isFreePlan ? <RewardsButton /> : null}
            {!isSwitched ? (
              <MenuButton
                className="default-button push"
                menu={[
                  ...(teams.length
                    ? [
                        {
                          title: 'Switch Team',
                          href: '#',
                          icon: '@lucide/users',
                          onClick: openTeamSwitchPopup,
                        },
                      ]
                    : []),
                  ...(users.length
                    ? [
                        {
                          title: 'Switch User',
                          href: '#',
                          icon: '@lucide/user',
                          onClick: openUserSwitchPopup,
                        },
                      ]
                    : []),
                ]}
              >
                Personal
              </MenuButton>
            ) : null}
            {!partner?.whitelabel && session?.billing?.upgradeAvailable ? (
              <>
                {isFreePlan ? (
                  <Link className="primary-button" href="/billing/upgrade">
                    Upgrade
                  </Link>
                ) : (
                  <Link className="default-button" href="/billing/upgrade">
                    {formatPlanLabel(session.billing.plan)}
                  </Link>
                )}
              </>
            ) : null}
            {session?.user && isSuperToolsVisible ? (
              <button
                type="button"
                className="default-button push"
                onClick={() => openSuperTools()}
              >
                Developer Console
              </button>
            ) : null}
          </ProfileBar>
          <SwitchBar
            className={clsx(
              'fixed top-0 z-40',
              'w-full pl-6 pr-4',
              'bg-orange-600 text-white',
              'text-sm'
            )}
          >
            {isSwitched ? (
              <>
                <div className="fixed left-0 top-10 w-4 h-4 bg-orange-600">
                  <div className="w-full h-full auto-bg-white rounded-tl-xl" />
                </div>
                <div className="fixed right-0 top-10 w-4 h-4 bg-orange-600">
                  <div className="w-full h-full auto-bg-white rounded-tr-xl" />
                </div>
              </>
            ) : null}
          </SwitchBar>
          <div
            className={clsx('flex flex-row relative', {
              'mt-10': isSwitched,
            })}
          >
            <aside
              className={clsx(
                'text-sm',
                'hidden md:flex flex-col gap-4',
                // @note --pullout-inset-bottom is the measured height of the
                // pullout dock handle (the SuperTools console here), published
                // on the root element only while one is mounted - see
                // components/Pullout.jsx; the switch bar shifts the h-screen
                // aside down, which needs its own compensation either way
                isSwitched
                  ? 'pb-[calc(var(--pullout-inset-bottom,0px)+2.5rem)]'
                  : 'pb-[var(--pullout-inset-bottom,0px)]',
                'fixed z-10 pt-20',
                'h-screen overflow-auto subtle-scrollbar px-5 w-64',
                'auto-bg-white',
                'border-r border-gray-100 dark:border-gray-900'
              )}
            >
              {/* logo */}
              <div className="absolute top-6 left-6">
                {partner ? (
                  <PartnerBanner
                    className="text-3xl h-[1.1em]"
                    partner={partner}
                  />
                ) : (
                  <Link
                    className="flex flex-row items-center gap-1 text-xl"
                    href={rootUrl}
                  >
                    <ChatBotKitIcon className="w-[1.1em] h-[1.1em]" />
                    {/* <div className="font-bold select-none">CBK</div> */}
                  </Link>
                )}
              </div>
              {/* project scope */}
              {isBuilderExperience ? <ProjectScopeSelector /> : null}
              {/* menu */}
              <NestedAccordionMenu sections={menuSections} />
              {/* partner */}
              {partner && !partner.whitelabel ? (
                <div className="mt-auto text-sm">
                  <div>in partnership with</div>
                  <div className="font-semibold">CBK.AI</div>
                </div>
              ) : null}
            </aside>
            <main
              className={clsx(
                'md:pl-64',
                'w-full',
                '[&_.main-page]:mx-10',
                '[&_.faq]:hidden'
              )}
            >
              {isBuilderExperience && session?.user ? (
                <div className="md:hidden mx-10 pt-4">
                  <ProjectScopeSelector className="max-w-sm" />
                </div>
              ) : null}
              <div>{children}</div>
            </main>
          </div>
        </div>
        {session ? (
          <SuperTools.Memo className="[&_.handle]:ml-16" theme="dark" />
        ) : null}
      </Confirm>
    </ProjectScopeProvider>
  )
})
