import { memo, useEffect, useState } from 'react'

import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeBlock from '@/components/CodeBlock'
import FAQ from '@/components/FAQ'
import Link from '@/components/Link'
import NavHeader from '@/components/NavHeader'

import faq from '@/content/faqs/website-playground-jmespath.yaml'

import jmespath from 'jmespath'

export function DataViewer({ output }) {
  return output ? (
    <CodeBlock className="text-sm" language="json">
      {output}
    </CodeBlock>
  ) : null
}

DataViewer.Memo = memo(DataViewer)

export default function Index() {
  const [search, setSearch] = useState('foo.bar')

  const [input, setInput] = useState(
    JSON.stringify(
      {
        foo: {
          bar: {
            baz: [0, 1, 2, 3, 4],
          },
        },
      },
      null,
      2
    )
  )

  const [output, setOutput] = useState('{}')

  useEffect(() => {
    try {
      setOutput(
        JSON.stringify(jmespath.search(JSON.parse(input), search), null, 2)
      )
    } catch (e) {
      toast.error(e.message)
    }
  }, [search, input])

  return (
    <>
      <section className="section-white">
        <div className="main-page">
          <NavHeader
            link="/playground"
            caption="playgrounds"
            title="JMESPath"
            beta={true}
          >
            The{' '}
            <Link href="https://jmespath.org/" target="_blank">
              JMESPath
            </Link>{' '}
            tester playground allows you to test JMESPath queries on JSON data.
            JMESPath is a query language for JSON data. It allows you to extract
            and transform elements from a JSON document.
          </NavHeader>
          <AutoTextarea
            className="default-input !font-mono w-full max-h-96 !overflow-auto"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="JSON data"
          />
          <AutoTextarea
            className="default-input !font-mono w-full"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="foo.bar"
          />
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
      title="JMESPath Tester Playground"
      description="The JMESPath tester playground allows you to test JMESPath queries on JSON data. JMESPath is a query language for JSON data. It allows you to extract and transform elements from a JSON document."
      keywords="jmespath tester, chatbot, playground, fetch, jmespath"
      image={`/playground/jmespath/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 130
 *
 * ## JMESPath
 *
 * The [JMESPath Playground](https://chatbotkit.com/playground/jmespath) works like the JSONPath Playground, but for JMESPath expressions. It helps you filter, reshape, and extract data from structured JSON documents before those expressions are used elsewhere.
 *
 * Use it to validate query behavior, compare outputs, and make sure your JSON transformation logic is correct before deployment.
 */
