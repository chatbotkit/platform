import { useContext } from 'react'

import { icons } from '@/lib/integration.items'

import Wizard, { wizardContext } from '@/layouts/Wizard'
import { Heading, NavigationButtons } from '@/layouts/Wizard'

import { CheckCircleIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

const integrations = {
  slack: {
    Icon: icons.slack,
    title: 'Slack Bot',
    description: 'Interact with your chatbot in Slack.',
  },

  discord: {
    Icon: icons.discord,
    title: 'Discord Bot',
    description: 'Interact with your chatbot in Discord.',
  },

  whatsapp: {
    Icon: icons.whatsapp,
    title: 'WhatsApp Bot',
    description: 'Interact with your chatbot in WhatsApp.',
  },

  messenger: {
    Icon: icons.messenger,
    title: 'Messenger Bot',
    description: 'Interact with your chatbot in Messenger.',
  },

  telegram: {
    Icon: icons.telegram,
    title: 'Telegram Bot',
    description: 'Interact with your chatbot in Telegram.',
  },
}

export default function Page() {
  const { loading, values, setValues } = useContext(wizardContext)

  return (
    <>
      <Heading
        title="Which platform best fits you?"
        description="For the last step, you must select the platform to integrate your bot with, ensuring that it aligns with your bot's objectives. Choose the integration that best fits your bot's goals and services."
      />
      <div
        className={clsx(
          'mt-4 md:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 px-8 md:px-0',
          {
            'opacity-30 pointer-events-none': loading,
          }
        )}
      >
        {Object.entries(integrations).map(
          ([name, { Icon, title, description }]) => (
            <button
              type="button"
              onClick={() => setValues({ ...values, integration: name })}
              key={title}
              className={clsx(
                'relative',
                'p-5 rounded-xl',
                'text-left',
                'transition duration-150',
                'focus:outline-none',
                'border',
                {
                  'border-indigo-600 dark:border-gray-600 ring ring-indigo-50 dark:ring-gray-50 bg-gray-50/50 dark:bg-gray-950/50':
                    name === values.integration,
                  'border-gray-100 dark:border-gray-900 hover:bg-gray-50/50 dark:hover:bg-gray-950/50':
                    name !== values.integration,
                }
              )}
            >
              <Icon className="w-12 h-12 p-2 rounded-full border border-indigo-300 dark:border-gray-800 bg-indigo-200 dark:bg-gray-900" />
              <h3 className="text-base mt-2 mb-1">{title}</h3>
              <p className="text-xs opacity-60 leading-normal">{description}</p>
              {name === values.integration && (
                <div className="text-indigo-600 dark:text-gray-50 absolute top-3 right-3">
                  <CheckCircleIcon color="" height="20px" width="20px" />
                </div>
              )}
            </button>
          )
        )}
      </div>
      <NavigationButtons disabled={!values.integration || loading} />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Create Solution"
      title="Integrations"
      description="Take your bot to the next level by integrating it with a popular communication platforms."
    >
      {children}
    </Wizard>
  )
}
