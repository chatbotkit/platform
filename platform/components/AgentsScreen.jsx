import { useMemo, useState } from 'react'

import DynamicIcon from '@/components/DynamicIcon'
import ForwardLink from '@/components/ForwardLink'
import LoadingIframe from '@/components/LoadingIframe'
import MovingScreen from '@/components/MovingScreen'

import clsx from 'clsx'

export function Examples({
  className,

  shadow = true,

  linkPosition = 'top',

  examples = [
    {
      icon: 'lucide/target',
      name: 'GTM Agent',
      description:
        'Researches prospects, enriches contacts with verified emails, and drafts outreach - right inside Slack.',
      src: '/examples/gtm-agent/designer',
    },
    {
      icon: 'lucide/palette',
      name: 'Brand Studio for Slack',
      description:
        'Composes on-brand images on the fly in Slack - the design team sets the brand kit once, then anyone can self-serve posts and graphics.',
      src: '/examples/brand-studio-for-slack/designer',
    },
    {
      icon: 'lucide/clipboard-check',
      name: 'Operations Manager Agent',
      description:
        'A proactive ops manager that tracks tasks, chases follow-ups, and keeps work moving across the team.',
      src: '/examples/operations-manager-agent/designer',
    },
    {
      icon: 'lucide/banknote',
      name: 'Revenue Operations War Room',
      description:
        'Three specialized bots monitor pipeline, prep meetings, and analyze revenue so nothing slips through.',
      src: '/examples/revenue-operations-war-room/designer',
    },
  ],

  minZoom = 0.2,

  ...props
}) {
  const [selectedSrc, setSelectedSrc] = useState(examples[0].src)

  const selectedExample = useMemo(
    () => examples.find(({ src }) => src === selectedSrc),
    [examples, selectedSrc]
  )

  return (
    <div
      {...props}
      className={clsx('flex flex-col gap-2 justify-center', className)}
    >
      <div className="flex flex-row gap-2">
        {examples.map(({ icon, name, description, src }, index) => (
          <div
            key={index}
            className={clsx(
              'flex-1',
              'relative group',
              'flex flex-col',
              'overflow-hidden',
              {
                'bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900':
                  selectedSrc !== src,
                'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700':
                  selectedSrc === src,
              },
              'rounded-xl',
              'border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700',
              'transition-all ease-in-out duration-200',
              'cursor-pointer',
              'hidden',
              {
                'sm:flex': index < 2,
                'lg:flex': index >= 2,
              }
            )}
            onClick={() => setSelectedSrc(examples[index].src)}
          >
            <div className="flex gap-4">
              {icon ? (
                <div className="p-4 pr-0">
                  <div
                    className={clsx(
                      'flex flex-row justify-center items-center w-12 h-12',
                      {
                        'rounded-xl border auto-bg-gray-100 auto-border-gray-200':
                          selectedSrc !== src,
                      }
                    )}
                  >
                    <DynamicIcon className="w-6 h-6" icon={icon} alt={name} />
                  </div>
                </div>
              ) : null}
              <div
                className={clsx('flex flex-1 flex-col space-y-1 p-4', {
                  'pl-0': !!icon,
                })}
              >
                <h3
                  className={clsx(
                    'text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1'
                  )}
                >
                  {name}
                </h3>
                <p
                  className={clsx(
                    'text-xs text-gray-500 dark:text-gray-500 line-clamp-3'
                  )}
                >
                  {description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        className={clsx(
          'relative',
          'w-full aspect-video',
          'bg-white dark:bg-black',
          // 'border auto-border-gray-300',
          'rounded-2xl',
          {
            'shadow-xl': !!shadow,
          },
          'overflow-hidden'
        )}
      >
        <LoadingIframe
          key={selectedSrc}
          className="w-full h-full bg-white dark:bg-black pointer-events-none"
          src={useMemo(() => {
            const url = new URL(selectedSrc, 'https://chatbotkit.com')

            url.searchParams.set('controls', 'false')
            url.searchParams.set('minZoom', minZoom)

            return url.pathname + url.search
          }, [minZoom, selectedSrc])}
          postMessageEvent="ready"
          title={['AI Agent Example', selectedExample?.name || '']
            .filter(Boolean)
            .join(' - ')}
        />
        <div
          className={clsx('absolute', {
            'left-5 top-5': linkPosition === 'top',
            'left-5 bottom-5': linkPosition === 'bottom',
            hidden: !linkPosition || linkPosition === 'none',
          })}
        >
          <ForwardLink
            className="default-button"
            href={selectedSrc.replace('/designer', '')}
            target="_blank"
          >
            See this example
          </ForwardLink>
        </div>
      </div>
    </div>
  )
}

export default function AgentsScreen({ examples, ...props }) {
  return (
    <MovingScreen {...props}>
      <div className="relative pb-16 sm:pb-[10vh]">
        <div
          className={clsx('mx-auto max-w-7xl px-5 xl:px-0', 'relative z-20')}
        >
          <Examples examples={examples} />
        </div>
        <div className="pointer-events-none absolute z-10 bottom-0 left-0 w-full h-full pt-paper gradient-mask-t-10" />
      </div>
    </MovingScreen>
  )
}
