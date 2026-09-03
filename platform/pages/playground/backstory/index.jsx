import { useState } from 'react'

import Dashboard from '@/layouts/Dashboard'

import BackstoryInput from '@/components/BackstoryInput'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import NavHeader from '@/components/NavHeader'

import faq from '@/content/faqs/website-playground-backstory.yaml'

export default function Index() {
  const [backstory, setBackstory] = useState('')

  return (
    <>
      <section className="section-white">
        <div className="main-page">
          <NavHeader link="/playground" caption="playgrounds" title="Backstory">
            <p>
              The <DocsLink slug="backstories">Backstory</DocsLink> is a central
              part of your chatbot&apos;s personality. This playground helps you
              create great backstories for your conversational AI chatbot. Type
              a basic backstory and click on the <q>magic button</q> to generate
              improved variations.
            </p>
          </NavHeader>
          <BackstoryInput
            className="default-input"
            value={backstory}
            onChange={(event) => setBackstory(event.target.value)}
          />
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="AI Bot Backstory Playground"
      description="Use this playground to experiment with different backstories to see how they affect the chatbot's responses."
      keywords="chatbot, playground, backstory, backstories, free, bot maker, free AI tool, free AI tools"
      image={`/playground/backstory/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 40
 *
 * ## Backstory
 *
 * The [Backstory Playground](https://chatbotkit.com/playground/backstory) helps you write and refine the personality, tone, and context of your bot. It gives you a focused place to shape how a bot presents itself and how it frames responses.
 *
 * Use it when you want to create a stronger assistant persona, improve consistency in tone, or experiment with prompt variations before updating a live bot.
 */
