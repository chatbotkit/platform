import { useEffect } from 'react'

import { readSource } from '@/lib/source'
import { makeJsonSafe } from '@/lib/struct'

import Demo, { SideBySidePage } from '@/layouts/Demo'

import DotsLoader from '@/components/DotsLoader'

// source start
import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

export default function Page() {
  const widget = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    // if the widget is not ready, do nothing

    if (!widget) {
      return
    }

    // setup the functions available to the widget AI bot

    widget.functions = {
      listFormFields: {
        description:
          'Returns a list of form fields with their current values and descriptions.',
        parameters: {},
        handler: () => {
          if (!document) {
            return
          }

          return Array.from(
            document.querySelectorAll('#form input, #form textarea')
          ).map((element) => {
            return {
              field: element.name,
              value: element.value,
              description:
                element.parentNode.parentNode.querySelector(
                  '.input-description'
                ).textContent,
              required: true,
            }
          })
        },
      },
      fillFormFieldValue: {
        description:
          'Fill a single form field given a name and value. Returns "success" or "error: field not found".',
        parameters: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              description: 'The name of the form field',
            },
            value: {
              type: 'string',
              description: 'The value to fill the form field with',
            },
          },
          required: ['field', 'value'],
        },
        handler: ({ field, value }) => {
          field = field.trim().toLowerCase()

          const element = document.querySelector(`#form [name="${field}"]`)

          if (!element) {
            return `error: field "${field}" not found`
          }

          element.value = value

          element.focus()

          return 'success'
        },
      },
    }
  }, [widget])

  return (
    <SideBySidePage>
      <div className="w-full overflow-auto flex flex-cols justify-center items-center">
        <div id="form" className="space-y-6">
          {/* name */}
          <div>
            <label className="default-label" htmlFor="name">
              Name
            </label>
            <div className="mt-1">
              <input
                className="default-input w-full sm:text-sm"
                name="name"
                type="text"
              />
            </div>
            <p className="input-description">
              Your name will help us personalize your experience.
            </p>
          </div>
          {/* email */}
          <div>
            <label className="default-label" htmlFor="email">
              Email
            </label>
            <div className="mt-1">
              <input
                className="default-input w-full sm:text-sm"
                name="email"
                type="email"
              />
            </div>
            <p className="input-description">
              We will send important information to this address.
            </p>
          </div>
          {/* reason for visit */}
          <div>
            <label className="default-label" htmlFor="reason">
              Reason for visit
            </label>
            <div className="mt-1">
              <textarea
                className="default-input w-full sm:text-sm"
                name="reason"
                type="text"
              />
            </div>
            <p className="input-description">
              Let us know the reason for your upcoming visit.
            </p>
          </div>
        </div>
      </div>
      <div className="relative border border-1 border-gray-200 rounded-xl overflow-hidden flex min-w-[30rem] max-w-[60rem] shadow-lg">
        <chatbotkit-widget
          class="flex-1 w-full h-full"
          widget="/examples/form-autofill/frame" // @note you would use your own chatbotkit widget id here
        />
        <div
          className={clsx('absolute inset-0 flex items-center justify-center', {
            hidden: !!widget,
          })}
        >
          <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
        </div>
      </div>
    </SideBySidePage>
  )
}
// source end

Page.getLayout = function getLayout(children, { source }) {
  return (
    <Demo
      title="Form Autofill"
      description="A bot that demonstrates how to deploy a form autofill features into any website using AI Widgets."
      slug="form-autofill"
      source={source}
      copy={false}
      share={false}
    >
      {children}
    </Demo>
  )
}

Page.theme = 'light'

export async function getStaticProps() {
  const source = readSource('./pages/examples/form-autofill/demo/index.jsx')

  return {
    props: makeJsonSafe({
      source,
    }),
  }
}
