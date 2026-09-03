import { useEffect, useState } from 'react'

import CodeBlock from './CodeBlock'

const meta = {
  title: 'Components/CodeBlock',
  component: CodeBlock,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Renders code with incremental streaming highlighting - completed lines are cached and only the last incomplete line is re-tokenized on each update.',
      },
    },
  },
  argTypes: {
    language: {
      control: 'text',
      description: 'Language passed to the syntax highlighter.',
    },
    copy: {
      control: 'boolean',
      description: 'Whether to show the copy button.',
    },
  },
}

export default meta

const sampleCode = `export async function streamAnswer(prompt) {
  const response = await client.responses.create({
    model: 'gpt-5.4',
    stream: true,
    input: prompt,
  })

  let content = ''

  for await (const event of response) {
    if (event.type === 'response.output_text.delta') {
      content += event.delta
      yield content
    }
  }
}`

function StreamingPreview({
  language = 'javascript',
  copy = true,
  tickMs = 45,
  chunkSize = 3,
}) {
  const [content, setContent] = useState('')
  const [runId, setRunId] = useState(0)

  useEffect(() => {
    let offset = 0

    setContent('')

    const interval = window.setInterval(() => {
      offset += chunkSize
      setContent(sampleCode.slice(0, offset))

      if (offset >= sampleCode.length) {
        window.clearInterval(interval)
      }
    }, tickMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [chunkSize, runId, tickMs])

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3 text-sm auto-text-gray-500">
        <button
          type="button"
          className="default-button"
          onClick={() => setRunId((value) => value + 1)}
        >
          Replay stream
        </button>
        <span>
          Chunks update every {tickMs}ms. Each token is highlighted immediately
          via incremental line caching.
        </span>
      </div>
      <CodeBlock language={language} copy={copy}>
        {content}
      </CodeBlock>
    </div>
  )
}

export const Default = {
  args: {
    language: 'javascript',
    copy: true,
    children: sampleCode,
  },
}

export const Streaming = {
  args: {
    language: 'javascript',
    copy: true,
  },
  render: (args) => <StreamingPreview {...args} />,
}
