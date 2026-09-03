import { useRef } from 'react'

import { getRandomId } from '@/lib/string'
import toast from '@/lib/toast'

import AutoTextarea from '@/components/AutoTextarea'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

export default function useMagicDialog({
  promptId,

  input,

  title,

  children,

  placeholder,
}) {
  const rootRef = useRef()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const { popup, openPopup, closePopup } = usePopup({
    title,
  })

  function open(_options) {
    const options = _options || {}

    openPopup(
      <div className="space-y-4" ref={rootRef}>
        {options.children || children}
        <AutoTextarea
          className="default-input !max-h-64 !overflow-auto"
          name="input"
          defaultValue={options.input || input}
          placeholder={
            options.placeholder || placeholder || options.input || input
          }
          required
        />
        <label
          className="text-sm auto-text-gray-500"
          style={{ display: 'none' }}
          htmlFor="suggestion"
        >
          Generated suggestion (review and click &ldquo;Use&rdquo; to apply):
        </label>
        <AutoTextarea
          className="default-input !max-h-96 !overflow-auto"
          style={{ display: 'none' }}
          name="suggestion"
          placeholder="Click generate to create a suggestion..."
        />
      </div>,
      {
        actions: {
          Generate: {
            async fn(props) {
              const input = props.input?.trim() || ''

              if (!input) {
                toast.error(`Please specify some input...`, {
                  duration: 3000,
                  id: getRandomId(),
                })

                return
              }

              const { error, data } = await fetch(
                `/api/v1/magic/${promptId}/generate`,
                {
                  data: {
                    text: input,
                  },

                  loadingMessage: 'Generating...',
                }
              )

              if (!error) {
                const { text } = data

                const label = rootRef.current?.querySelector(
                  'label[htmlFor="suggestion"]'
                )

                if (label) {
                  label.style.display = 'block'
                }

                const textarea = rootRef.current?.querySelector(
                  '[name="suggestion"]'
                )

                if (textarea) {
                  textarea.style.display = 'block'

                  textarea.value = text

                  const event = new Event('recalibrate')

                  textarea.dispatchEvent(event)
                }
              }
            },
          },

          Use: {
            default: true,

            async fn(props) {
              if (!props.suggestion) {
                toast.error(`There is no suggestion to use...`, {
                  duration: 3000,
                  id: getRandomId(),
                })

                return
              }

              if (options.callback) {
                options.callback(props.suggestion)
              }

              closePopup()
            },
          },
        },
      }
    )
  }

  function close() {
    closePopup()
  }

  return {
    dialog: popup,

    open,
    close,
  }
}
