import { useContext } from 'react'

import { icons } from '@/lib/integration.items'

import Wizard, { wizardContext } from '@/layouts/Wizard'
import { Heading, NavigationButtons } from '@/layouts/Wizard'

import { CheckCircleIcon } from '@heroicons/react/24/outline'

const integrations = {
  widget: {
    Icon: icons.widget,
    title: 'Widget',
    description: 'Embed a widget on your websites.',
  },

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

  email: {
    Icon: icons.email,
    title: 'Email Bot',
    description: 'Interact with your chatbot via email.',
  },

  trigger: {
    Icon: icons.trigger,
    title: 'Trigger Bot',
    description: 'Trigger your bot via webhook.',
  },

  bot: {
    Icon: function BotIcon() {
      return (
        <div className="w-12 h-12 rounded-full border border-gray-100 flex justify-center items-center">
          <span className="emoji">🤖</span>
        </div>
      )
    },
    title: 'Bot Instance',
    description: 'Create just a bot and plug it to an integration later.',
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
        className={`${
          loading && 'opacity-30 pointer-events-none'
        }  mt-4 md:mt-10 grid  grid-cols-1 sm:grid-cols-3 gap-4 px-8 md:px-0`}
      >
        {Object.entries(integrations).map(
          ([name, { Icon, title, description }]) => (
            <button
              type="button"
              onClick={() => setValues({ ...values, integration: name })}
              key={title}
              className={`${
                name === values.integration
                  ? 'border-indigo-600 ring ring-indigo-50 bg-gray-50/50'
                  : 'border-gray-100 hover:bg-gray-50/50'
              } border p-5 rounded-xl transition duration-150 focus:outline-none relative text-left `}
            >
              <Icon className="w-12 h-12 p-2 rounded-full border border-gray-100" />
              <h3 className="text-base mb-0.5 mt-3">{title}</h3>
              <p className="text-xs opacity-60 leading-normal">{description}</p>
              {name === values.integration && (
                <div className="text-indigo-600 absolute top-3 right-3">
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
