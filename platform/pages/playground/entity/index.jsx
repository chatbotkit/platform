import { useState } from 'react'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import NavHeader from '@/components/NavHeader'
import SendInstructions from '@/components/SendInstructions'

import useFetch from '@/hooks/useFetch'

import faq from '@/content/faqs/website-playground-entity.yaml'

export default function Index() {
  const [result, setResult] = useState(null)

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function transform(text) {
    const { data, error } = await fetch(`/api/v1/entity/text/redact`, {
      data: {
        text: text,
      },
    })

    if (!error) {
      setResult(data)
    }
  }

  function handleOnKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()

      transform(event.target.value)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <section className="section-white">
        <div className="main-page">
          <NavHeader link="/playground" caption="playgrounds" title="Entity">
            <p>
              The following playground helps you test how PII (personal
              identifiable information) and other types of entities are detected
              and transformed when received by your chat bot. For more
              information see the{' '}
              <DocsLink className="default-link" slug="privacy">
                Privacy
              </DocsLink>{' '}
              documentation.
            </p>
          </NavHeader>
          <div>
            <AutoTextarea
              className="default-input"
              placeholder="Type any text to see how it will get transformed"
              onKeyDown={handleOnKeyDown}
            />
            <div className="mt-2">
              <SendInstructions message="extract entities" />
            </div>
          </div>
          {result ? (
            <div className="prose dark:prose-invert">
              <CodeBlock>{result.text}</CodeBlock>
              {result.entities.length ? (
                <>
                  <p>
                    The following personal information was detected and
                    automatically redacted.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Original</th>
                        <th>Replacement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.entities.map(({ text, replacement }, index) => {
                        if (replacement) {
                          return (
                            <tr key={index}>
                              <td>{text}</td>
                              <td>{replacement.text}</td>
                            </tr>
                          )
                        }
                      })}
                    </tbody>
                  </table>
                  <CodeBlock language="json">
                    {JSON.stringify(result.entities, null, 2)}
                  </CodeBlock>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="Entity Playground"
      description="The following playground helps you test how PII (personal identifiable information) and other types of entities are detected and transformed when received by your chat bot."
      keywords="chatbot, playground, entity, privacy, security"
      image={`/playground/entity/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 30
 *
 * ## Entity
 *
 * The [Entity Playground](https://chatbotkit.com/playground/entity) helps you inspect how personal and structured information is detected and transformed. It is useful for validating privacy behavior and understanding how sensitive user data is handled.
 *
 * Use it when you want to test PII detection, verify redaction behavior, or make sure entity processing is doing what you expect before that logic affects production traffic.
 */
