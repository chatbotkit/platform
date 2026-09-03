import { useEffect } from 'react'
import { MdGridView } from 'react-icons/md'

import { icons } from '@/lib/integration.items'

import Wizard, { Heading, NavigationButtons, useWizard } from '@/layouts/Wizard'

import { CheckCircleIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

// @note these mirror the use-case templates in `@/templates`. The onboarding
// task in `@/templates/onboarding` maps each intent id to the matching template.
const intents = [
  {
    id: 'website-agent',
    title: 'Website Agent',
    description:
      'Deploy an AI agent on your website that learns from your content and answers visitor questions through an embeddable chat widget.',
    icon: '🌐',
    Icon: icons.sitemap,
  },
  {
    id: 'slack-agent',
    title: 'Slack Agent',
    description:
      'Bring an AI agent into your Slack workspace to answer questions and automate tasks for your team.',
    icon: '💬',
    Icon: icons.slack,
  },
  {
    id: 'telegram-agent',
    title: 'Telegram Agent',
    description:
      'Set up a personal AI agent on Telegram that you can chat with one-on-one to get answers, capture ideas, and handle tasks on the go.',
    icon: '✈️',
    Icon: icons.telegram,
  },
  {
    id: 'whatsapp-agent',
    title: 'WhatsApp Agent',
    description:
      'Put an AI agent on WhatsApp to engage customers and resolve conversations on the channel they already use.',
    icon: '📱',
    Icon: icons.whatsapp,
  },
  {
    id: 'googlechat-agent',
    title: 'Google Chat Agent',
    description:
      'Bring an AI agent into Google Chat to answer questions and automate tasks across your Google Workspace.',
    icon: '💬',
    Icon: icons.googlechat,
  },
  {
    id: 'ready-made-solution',
    title: 'Ready-Made Solution',
    description:
      'Start from a proven agent, assistant or blueprint - browse the ready-made examples and clone the closest match to make it your own.',
    icon: '📚',
    Icon: MdGridView,
  },
]

export default function Page() {
  const { values, setValues } = useWizard()

  const intent = values.intent || 'website-agent'

  // @note persist the display default so completing this step always selects
  // an intent - the onboarding task keys off its presence to decide between
  // continuing to a template and ending at the dashboard
  useEffect(() => {
    if (!values.intent) {
      setValues((values) => ({ ...values, intent: 'website-agent' }))
    }
  }, [values.intent, setValues])

  return (
    <>
      <Heading
        title="What do you want to build first?"
        description="Pick the closest outcome. You can still use every platform feature later."
      />
      <div className="mt-4 md:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 px-8 md:px-0">
        {intents.map((item) => {
          const selected = intent === item.id
          const Icon = item.Icon

          return (
            <button
              key={item.id}
              type="button"
              className={clsx(
                'relative',
                'flex flex-col items-start justify-start',
                'p-5 rounded-xl',
                'text-left',
                'transition duration-150',
                'focus:outline-none',
                'border',
                {
                  'border-indigo-600 dark:border-gray-600 ring ring-indigo-50 dark:ring-gray-50 bg-gray-50/50 dark:bg-gray-950/50':
                    selected,
                  'border-gray-100 dark:border-gray-900 hover:bg-gray-50/50 dark:hover:bg-gray-950/50':
                    !selected,
                }
              )}
              onClick={() => {
                setValues({
                  ...values,
                  intent: item.id,
                  name: values.name || item.title,
                })
              }}
            >
              <div className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                {Icon ? <Icon /> : item.icon}
              </div>
              <h3 className="text-base mt-2 mb-1">{item.title}</h3>
              <p className="text-xs opacity-60 leading-normal">
                {item.description}
              </p>
              {selected && (
                <div className="text-indigo-600 dark:text-gray-50 absolute top-3 right-3">
                  <CheckCircleIcon color="" height="20px" width="20px" />
                </div>
              )}
            </button>
          )
        })}
      </div>
      <input type="hidden" name="intent" value={intent} required />
      <NavigationButtons disabled={!intent} />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Onboarding"
      title="First Outcome"
      description="Start with a working assistant, then explore the platform behind it."
    >
      {children}
    </Wizard>
  )
}
