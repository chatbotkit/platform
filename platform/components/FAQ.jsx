import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

import Collapsible from '@/components/Collapsible'
import Component from '@/components/Component'
import FAQStructuredData from '@/components/FAQStructuredData'

import { ChevronDownIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function Title({ className, children, ...props }) {
  return (
    <h2
      {...props}
      className={clsx(
        'text-center text-3xl sm:text-4xl font-bold tracking-tight',
        className
      )}
    >
      {children}
    </h2>
  )
}

export function Item({
  className,

  questionAs = 'h3',

  question,

  answer,

  ...props
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      {...props}
      className={clsx('pt-6', className)}
      onClick={() => setOpen((open) => !open)}
    >
      <dt className="text-lg">
        <Component
          className="flex w-full items-start justify-between text-left text-gray-400 dark:text-gray-600 cursor-pointer"
          as={questionAs}
        >
          <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {question}
          </span>
          <span className="ml-6 flex h-7 items-center">
            <ChevronDownIcon
              className={clsx(
                open ? '-rotate-180' : 'rotate-0',
                'h-6 w-6 transform'
              )}
              aria-hidden="true"
            />
          </span>
        </Component>
      </dt>
      <Collapsible
        as="dd"
        className={clsx(
          'mt-2 pr-12 prose dark:prose-invert prose-sizeless prose-pre:whitespace-pre-wrap prose-a:text-indigo-500 dark:prose-a:text-white prose-a:no-underline dark:prose-a:underline',
          'text-lg text-gray-500 dark:text-gray-500',
          'opacity-100 transition-all duration-300',
          {
            '!opacity-0 !h-0 overflow-hidden': !open,
          }
        )}
      >
        <ReactMarkdown skipHtml={true}>{answer}</ReactMarkdown>
      </Collapsible>
    </div>
  )
}

export function Content({
  className,

  faq,

  length = Infinity,

  questionAs,

  children,

  ...props
}) {
  return (
    <dl
      {...props}
      className={clsx(
        'mt-6 space-y-6 divide-y divide-gray-200 dark:divide-gray-800',
        className
      )}
    >
      {faq.slice(0, length).map((faq, index) => (
        <Item key={index} questionAs={questionAs} {...faq} />
      ))}
      {children}
    </dl>
  )
}

export default function FAQ({
  className,

  faq,

  titleAs = Title,

  questionAs,

  length = Infinity,

  withSection = true,

  ...props
}) {
  if (!faq.length) {
    return null
  }

  return (
    <>
      <FAQStructuredData faq={faq} />
      {withSection ? (
        <section
          {...props}
          aria-labelledby="faq-heading"
          className={clsx('faq section-gray-25', className)}
        >
          <div className="main-page">
            <Component as={titleAs} id="frequently-asked-questions">
              Frequently Asked Questions
            </Component>
            <Content faq={faq} length={length} questionAs={questionAs} />
          </div>
        </section>
      ) : null}
    </>
  )
}
