import { memo, useEffect, useState } from 'react'

import { html2text } from '@chatbotkit-dev/file-html/parse'

import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeBlock from '@/components/CodeBlock'
import CommaListSelect from '@/components/CommaListSelect'
import FAQ from '@/components/FAQ'
import NavHeader from '@/components/NavHeader'
import Toggle from '@/components/Toggle'

import faq from '@/content/faqs/website-playground-html.yaml'

export function DataViewer({ output }) {
  return output ? (
    <CodeBlock className="text-sm" language="text">
      {output}
    </CodeBlock>
  ) : null
}

DataViewer.Memo = memo(DataViewer)

export default function Index() {
  const [input, setInput] = useState('')

  const [additionalSelectors, setAdditionalSelectors] = useState('')

  const [skipA, setSkipA] = useState(false)
  const [skipImg, setSkipImg] = useState(false)
  const [skipAudio, setSkipAudio] = useState(false)
  const [skipVideo, setSkipVideo] = useState(false)

  const [output, setOutput] = useState('{}')

  useEffect(() => {
    const selectors = []

    if (additionalSelectors) {
      selectors.push(
        ...additionalSelectors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    }

    if (skipA) {
      selectors.push('@skiptag-a')
    }

    if (skipImg) {
      selectors.push('@skiptag-img')
    }

    if (skipAudio) {
      selectors.push('@skiptag-audio')
    }

    if (skipVideo) {
      selectors.push('@skiptag-video')
    }

    try {
      setOutput(html2text(input, { selectors }))
    } catch (e) {
      toast.error(e.message)
    }
  }, [input, additionalSelectors, skipA, skipImg, skipAudio, skipVideo])

  return (
    <>
      <section className="section-white">
        <div className="main-page">
          <NavHeader
            link="/playground"
            caption="playgrounds"
            title="HTML"
            beta={true}
          >
            The HTML tester playground allows you to test how HTML is converted
            to simplified text, suitable for use in conversational AI
            applications.
          </NavHeader>
          <AutoTextarea
            className="default-input !font-mono w-full max-h-96 !overflow-auto"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="HTML"
          />
          <div>
            <CommaListSelect
              className="default-input !font-mono"
              value={additionalSelectors}
              setValue={setAdditionalSelectors}
              placeholder="Enter list of additional selectors"
            />
          </div>
          <div className="flex flex-row gap-2">
            <div className="relative group/tooltip">
              <Toggle checked={skipA} setChecked={setSkipA} />
              <span className="tooltip below w-36">Skip Links</span>
            </div>
            <div className="relative group/tooltip">
              <Toggle checked={skipImg} setChecked={setSkipImg} />
              <span className="tooltip below w-36">Skip Images</span>
            </div>
            <div className="relative group/tooltip">
              <Toggle checked={skipAudio} setChecked={setSkipAudio} />
              <span className="tooltip below w-36">Skip Audio</span>
            </div>
            <div className="relative group/tooltip">
              <Toggle checked={skipVideo} setChecked={setSkipVideo} />
              <span className="tooltip below w-36">Skip Video</span>
            </div>
          </div>
          <DataViewer.Memo output={output} />
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="HTML Tester Playground"
      description="The HTML tester playground allows you to test how HTML is converted to simplified text, suitable for use in conversational AI applications"
      keywords="html tester, chatbot, playground"
      image={`/playground/html/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 140
 *
 * ## HTML
 *
 * The [HTML Playground](https://chatbotkit.com/playground/html) lets you test how HTML content is converted into simplified text. It is useful for debugging content extraction and understanding what text your conversational workflows will actually consume.
 *
 * Use it when you are tuning selectors, skipping specific tags, or validating how rich web content is reduced for AI processing.
 */
