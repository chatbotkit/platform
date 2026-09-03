import { useEffect, useState } from 'react'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import InstructionInput from '@/components/InstructionInput'
import NavHeader from '@/components/NavHeader'
import ObjectView from '@/components/ObjectView'

import useDebounce from '@/hooks/useDebounce'
import useFetch from '@/hooks/useFetch'

import faq from '@/content/faqs/website-playground-ability.yaml'

function ToolCallPreview({ value }) {
  const debouncedValue = useDebounce(value, 500)

  const [toolCall, setToolCall] = useState(null)

  const { fetch } = useFetch()

  useEffect(() => {
    if (!debouncedValue) {
      setToolCall(null)

      return
    }

    let cancelled = false

    async function run() {
      const { data, error } = await fetch('/api/auxiliary/playground/ability', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-chatbotkit-handler-name': 'toolCall',
        },
        body: JSON.stringify({ instruction: debouncedValue }),
      })

      if (cancelled || error) {
        return
      }

      setToolCall(data)
    }

    run()

    return () => {
      cancelled = true
    }
  }, [debouncedValue, fetch])

  if (!toolCall) {
    return null
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium auto-text-gray-500 mb-2">
        JSON Schema Tool Call
      </h3>
      <ObjectView className="text-sm" object={toolCall} />
    </div>
  )
}

export default function Index() {
  const [value, setValue] = useState('')

  return (
    <section className="section-white">
      <div className="main-page">
        <NavHeader
          link="/playground"
          caption="playgrounds"
          title="Ability"
          beta={true}
        >
          An <DocsLink slug="skillsets">ability instruction</DocsLink> is a
          command that describes how to perform a certain action. In this
          playground, you can type an ability instruction to see the resulting
          JSON Schema tool call definition, or click on the <q>magic button</q>{' '}
          to generate improved variations.
        </NavHeader>
        <InstructionInput
          className="default-input"
          value={value}
          setValue={setValue}
        />
        <ToolCallPreview value={value} />
      </div>
    </section>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="Ability"
      description="A playground to generate variations of an ability instruction."
      keywords="chatbot, playground, ability, abilities"
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 60
 *
 * ## Ability
 *
 * The [Ability Playground](https://chatbotkit.com/playground/ability) gives you a sandbox for creating and testing bot abilities before deployment. It helps you validate how an instruction turns into a tool-call shape and whether the intended behavior is clear enough.
 *
 * Use it when you are designing custom abilities, tightening instructions, or checking that a generated tool definition matches the action you want the AI to perform.
 */
