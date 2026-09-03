import { useMemo, useState } from 'react'

import { TAG_RESULT } from '@/lib/conversation.tag'
import cuid from '@/lib/cuid'
import { jsonl } from '@/lib/fetch'
import { ellipsis } from '@/lib/string'
import toast from '@/lib/toast'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'
import CodeBlock from '@/components/CodeBlock'
import ObjectView from '@/components/ObjectView'
import SendInstructions from '@/components/SendInstructions'
import SimpleTabs from '@/components/SimpleTabs'

import useFetch from '@/hooks/useFetch'

function unpackResultEnvelope(value, fallbackDebug) {
  let result = value
  let debug = fallbackDebug

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof debug === 'undefined' && typeof value.debug !== 'undefined') {
      debug = value.debug
    }

    if (typeof value.result !== 'undefined') {
      result = value.result
    } else if (
      typeof value.data !== 'undefined' &&
      typeof value.debug !== 'undefined'
    ) {
      result = value.data
    }
  }

  return { result, debug }
}

export default function SkillsetAbilityTester({ skillset, ability }) {
  const [input, setInput] = useState('')

  const [result, setResult] = useState(null)
  const [debug, setDebug] = useState(undefined)

  const [messages, setMessages] = useState([])

  const { loading, fetch } = useFetch({
    loadingMessage: 'Executing the ability...',
    failureMessage: true,
  })

  const namespace = useMemo(() => {
    return cuid()
  }, [])

  const tabs = useMemo(() => {
    const nextTabs = {}

    if (result) {
      nextTabs.Data = {
        default: true,
        content:
          result.type === 'object' ? (
            <ObjectView className="text-xs max-h-96" object={result.object} />
          ) : (
            <CodeBlock className="text-xs max-h-96" language={result.language}>
              {result.text}
            </CodeBlock>
          ),
      }
    }

    if (typeof debug !== 'undefined') {
      nextTabs.Debug = {
        content: <ObjectView className="text-xs max-h-96" object={debug} />,
      }
    }

    if (messages.length) {
      nextTabs.Messages = {
        content: (
          <div className="flex flex-col gap-2">
            {messages.map(({ text, meta }, index) => {
              return (
                <CodeBlock className="text-xs" key={index} language="json">
                  {text || JSON.stringify(meta || {}, null, 2)}
                </CodeBlock>
              )
            })}
          </div>
        ),
      }
    }

    return nextTabs
  }, [debug, messages, result])

  async function handleSubmit() {
    const { error, data: body } = await fetch(
      `/api/v1/skillset/${skillset.id}/ability/${
        ability?.id || skillset.ability.id
      }/execute`,
      {
        headers: {
          Accept: 'application/jsonl',
        },

        data: {
          input: input,

          debug: true,

          // ----------------
          // unstable options
          // ----------------

          namespace,
        },

        dataType: 'body',
      }
    )

    if (!error) {
      // @todo refactor the code to ensure it follows the API signature

      for await (let { type, data } of jsonl(body)) {
        if (type === TAG_RESULT) {
          let nextResult = null
          const unpacked = unpackResultEnvelope(data.result, data.debug)
          const resultValue = unpacked.result
          const debugValue = unpacked.debug

          // @note before processing the result, let's handle the error case
          // first to allow for overriding - this is important for edge cases

          if (typeof data.error !== 'undefined') {
            nextResult = {
              type: 'code',
              language: 'markdown',
              text: data.error,
            }

            toast.error(ellipsis(data.error, 200))
          }

          switch (true) {
            // the result is a string

            case !nextResult && typeof resultValue === 'string': {
              let text = resultValue
              let language = 'markdown'

              if (text.startsWith('{') || text.startsWith('[')) {
                try {
                  nextResult = {
                    type: 'object',
                    object: JSON.parse(text),
                  }
                } catch {
                  // pass
                }
              }

              if (!nextResult) {
                nextResult = {
                  type: 'code',
                  language,
                  text,
                }
              }

              break
            }

            // the result is an object

            case !nextResult && typeof resultValue === 'object': {
              nextResult = {
                type: 'object',
                object: resultValue,
              }

              break
            }

            case !nextResult && typeof resultValue !== 'undefined': {
              nextResult = {
                type: 'code',
                language: 'json',
                text: JSON.stringify(resultValue, null, 2),
              }

              break
            }
          }

          setResult(nextResult)
          setDebug(debugValue)
          setMessages(data.messages || [])
        }
      }
    }
  }

  function handleOnKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()

      handleSubmit()
    }
  }

  function handleOnClick(event) {
    event.preventDefault()

    handleSubmit()
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <div className="relative">
          <AdvancedAutoTextarea
            className="default-input font-mono"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Enter your input"
            onKeyDown={handleOnKeyDown}
            disabled={loading}
            spellCheck={false}
          >
            <button
              className="primary-button small"
              type="button"
              onClick={handleOnClick}
              disabled={loading}
            >
              Execute
            </button>
          </AdvancedAutoTextarea>
        </div>
        <SendInstructions message="to execute the ability" />
        {/* @todo: add more information how to describe the input */}
      </div>
      <div className="flex flex-col gap-2">
        {Object.keys(tabs).length ? <SimpleTabs tabs={tabs} /> : null}
        {!Object.keys(tabs).length ? (
          <div className="text-xs">There are no results</div>
        ) : null}
      </div>
    </div>
  )
}
