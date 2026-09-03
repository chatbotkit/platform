import { useEffect, useMemo, useRef, useState } from 'react'

import Hero from '@/components/Hero'
import Meta from '@/components/Meta'

import useRouter from '@/hooks/useRouter'
import useTextAnimation from '@/hooks/useTextAnimation'

import { PhotoIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function PreviewInput({ className, ...props }) {
  const router = useRouter()

  const inputElement = useRef(null)

  useEffect(() => {
    if (inputElement.current) {
      inputElement.current.focus()
    }
  }, [])

  const [value, setValue] = useState('')

  const [isDisabled, setIsDisabled] = useState(false)

  const placeholder = useTextAnimation({
    texts: useMemo(() => ['notion.so', 'vercel.com', 'figma.com'], []),
    typingSpeed: 100,
    deletingSpeed: 50,
    delayBetweenTexts: 2000,
    disabled: value.length > 0,
  })

  return (
    <form
      {...props}
      className={clsx('relative', className)}
      onSubmit={(event) => {
        event.preventDefault()

        if (!event.target.checkValidity()) {
          event.target.reportValidity()

          return
        }

        setIsDisabled(true)

        let location

        let input = event.target.heroInput.value

        if (input.startsWith('http')) {
          const url = new URL(input)

          location = url.hostname + url.pathname
        } else {
          location = input
        }

        location = location.trim()

        if (!location) {
          return
        }

        router.push(`/widgets/preview/${location}`)
      }}
    >
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <PhotoIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
      </div>
      <input
        ref={inputElement}
        className="default-input w-full text-xl pl-10"
        type="text"
        name="heroInput"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={isDisabled}
      />
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
        <button
          className="primary-button small"
          type="submit"
          disabled={isDisabled}
        >
          Preview
        </button>
      </div>
    </form>
  )
}

export default function Index() {
  return (
    <>
      <Meta
        title={`ChatBotKit AI Widget Preview`}
        description="If you want to build an AI chatbot for your website, you can use ChatBotKit. It's a powerful and easy-to-use tool that allows you to create a chatbot for your website in minutes."
        keywords="chatbot, chatbot widget, chatbot for website, chatbot ai, chatbot builder, chatbot platform, chatbot integration, chatbot plugin, chatbot software, chatbot tool, chatbot service, chatbot solution, chatbot app, chatbot development, chatbot framework, chatbot library, chatbot sdk, chatbot api, chatbot code, chatbot script"
      />
      <div className="w-screen h-screen pt-rectangles flex flex-col justify-center items-center">
        <div className="w-full max-w-xl px-5 flex flex-col">
          <Hero
            className="[&_.main-page]:p-0"
            title={['AI Widget', 'Builder']}
            description="Create a conversational AI assistant for your website in seconds."
            compact={true}
          />
          <PreviewInput className="w-full shadow-lg" />
        </div>
      </div>
    </>
  )
}

Index.getLayout = function (children) {
  return <>{children}</>
}
