import { memo, useEffect, useState } from 'react'

import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeBlock from '@/components/CodeBlock'
import FAQ from '@/components/FAQ'
import Link from '@/components/Link'
import NavHeader from '@/components/NavHeader'

import faq from '@/content/faqs/website-playground-jsonpath.yaml'

import { JSONPath } from 'jsonpath-plus'

export function DataViewer({ output }) {
  return output ? (
    <CodeBlock className="text-sm" language="json">
      {output}
    </CodeBlock>
  ) : null
}

DataViewer.Memo = memo(DataViewer)

export default function Index() {
  const [search, setSearch] = useState('$.store.book[*].author')

  const [input, setInput] = useState(
    JSON.stringify(
      {
        store: {
          book: [
            {
              category: 'reference',
              author: 'Nigel Rees',
              title: 'Sayings of the Century',
              price: 8.95,
            },
            {
              category: 'fiction',
              author: 'Evelyn Waugh',
              title: 'Sword of Honour',
              price: 12.99,
            },
            {
              category: 'fiction',
              author: 'Herman Melville',
              title: 'Moby Dick',
              isbn: '0-553-21311-3',
              price: 8.99,
            },
            {
              category: 'fiction',
              author: 'J. R. R. Tolkien',
              title: 'The Lord of the Rings',
              isbn: '0-395-19395-8',
              price: 22.99,
            },
          ],
          bicycle: {
            color: 'red',
            price: 19.95,
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
        JSON.stringify(
          JSONPath({ path: search, json: JSON.parse(input) }),
          null,
          2
        )
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
            title="JSONPath"
            beta={true}
          >
            The{' '}
            <Link href="https://jsonpath.com/" target="_blank">
              JSONPath
            </Link>{' '}
            evaluator playground allows you to test JSONPath queries on JSON
            data. JSONPath is a query language for JSON data. It allows you to
            extract and transform elements from a JSON document.
          </NavHeader>
          <div className="space-y-2">
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
              placeholder="$.store.book[*].author"
            />
            <DataViewer.Memo output={output} />
          </div>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="JSONPath Evaluator Playground"
      description="The JSONPath evaluator playground allows you to test JSONPath queries on JSON data. JSONPath is a query language for JSON data. It allows you to extract and transform elements from a JSON document."
      keywords="jsonpath evaluator, chatbot, playground, fetch, jsonpath"
      image={`/playground/jsonpath/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 120
 *
 * ## JSONPath
 *
 * The [JSONPath Playground](https://chatbotkit.com/playground/jsonpath) helps you evaluate JSONPath expressions against sample JSON data. It is useful when you need to test extraction logic before embedding it into a broader automation or integration.
 *
 * Use it to check query syntax, confirm the selected values are correct, and iterate on transformations without having to run a full workflow.
 */
