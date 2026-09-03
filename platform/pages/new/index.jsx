import { useEffect, useRef } from 'react'

import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Wizard, { useWizard } from '@/layouts/Wizard'
import { Heading, NavigationButtons } from '@/layouts/Wizard'

import Emoji from '@/components/Emoji'

import useRouter from '@/hooks/useRouter'

import { templates } from '@/templates/index'

import { CheckCircleIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export function TemplateButton({
  template,
  currentTemplate,

  className,

  ...props
}) {
  const Icon = template.Icon

  return (
    <button
      {...props}
      type="button"
      className={clsx(
        className,
        'relative',
        'flex flex-col items-start justify-start',
        'p-5 rounded-xl',
        'text-left',
        'transition duration-150',
        'focus:outline-none',
        'border',
        {
          'border-indigo-600 dark:border-gray-600 ring ring-indigo-50 dark:ring-gray-50 bg-gray-50/50 dark:bg-gray-950/50':
            template.templateId === currentTemplate.templateId,
          'border-gray-100 dark:border-gray-900 hover:bg-gray-50/50 dark:bg-gray-950/50':
            template.templateId != currentTemplate.templateId,
        }
      )}
    >
      {Icon ? (
        <div className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
          <Icon />
        </div>
      ) : (
        <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
          {template.icon}
        </Emoji>
      )}
      <h3 className="text-base mt-2 mb-1">{template.templateName}</h3>
      <p className="text-xs opacity-60 leading-normal">
        {template.templateDescription}
      </p>
      {template.templateId === currentTemplate.templateId && (
        <div className="text-indigo-600 dark:text-gray-50 absolute top-3 right-3">
          <CheckCircleIcon color="" height="20px" width="20px" />
        </div>
      )}
    </button>
  )
}

export default function Index({
  templateId,
  options: _options,
  values: _values,
}) {
  const router = useRouter()

  const initializedTemplateIdRef = useRef(null)

  const {
    currentTemplate,
    setCurrentTemplate,

    options,
    setOptions,

    values,
    setValues,
  } = useWizard()

  useEffect(() => {
    setOptions((options) => ({ ...options, ..._options }))
  }, [_options, setOptions])

  useEffect(() => {
    setValues((values) => ({ ...values, ..._values }))
  }, [_values, setValues])

  useEffect(() => {
    if (!templateId) {
      return
    }

    const template = templates.find((item) => {
      return item.templateId === templateId
    })

    if (!template) {
      return
    }

    if (initializedTemplateIdRef.current === templateId) {
      return
    }

    initializedTemplateIdRef.current = templateId

    const { template: _template, ...query } = router.query

    const nextOptions = { ...options, ..._options }
    const nextValues = { ...values, ..._values }

    async function loadTemplate() {
      let nextStep

      if (template.init) {
        const result = await template.init({
          options: nextOptions,
          setOptions,

          values: nextValues,
          setValues,

          query,
        })

        if (result?.redirect) {
          router.push(result.redirect)

          return
        }

        // @note init can steer deep links past intermediate steps (e.g.
        // ?template=example&example=<slug> skips the browse step and goes
        // straight to the confirm step)
        if (result?.nextStep) {
          nextStep = result.nextStep
        }
      }

      setCurrentTemplate(template)

      router.push({
        pathname: nextStep || template.steps[1],
        query,
      })
    }

    loadTemplate()
  }, [
    templateId,

    _options,
    _values,

    setCurrentTemplate,

    options,
    setOptions,

    values,
    setValues,

    router,
  ])

  if (templateId) {
    return null
  }

  return (
    <>
      <Heading
        title="What do you want to build?"
        description="Pick a starting point. We'll set everything up and take you straight to its configuration."
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 md:mt-10 px-8 md:px-0">
        {templates
          .filter((item) => !item.hidden)
          .map((item) => (
            <TemplateButton
              key={item.templateId}
              template={item}
              currentTemplate={currentTemplate}
              onClick={() => setCurrentTemplate(item)}
            />
          ))}
        {/* <TemplateButton
          key="custom"
          template={{
            templateId: 'custom',
            icon: '⚙️',
            templateName: 'Custom Solution',
            templateDescription:
              'Build a fully customized AI solution with your own datasets, skillsets, and integrations.',
          }}
          currentTemplate={currentTemplate}
          onClick={() =>
            setCurrentTemplate({
              templateId: 'custom',
              steps: ['/new', '/bots/new'],
            })
          }
        /> */}
      </div>
      <NavigationButtons disabled={!currentTemplate.templateId} />
    </>
  )
}

Index.getLayout = function (children, { templateId, options, values }) {
  return (
    <Wizard
      {...(templateId
        ? {}
        : {
            caption: 'Create Solution',
            title: 'Templates',
            description: 'Choose a template to start building your solution.',
          })}
      options={options}
      values={values}
    >
      {children}
    </Wizard>
  )
}

// @note guards the returnTo query param against open redirects - only local
// same-origin paths pass, anything else falls back to /overview
export function getSafeReturnPath(value) {
  const path = Array.isArray(value) ? value[0] : value

  if (typeof path !== 'string') {
    return '/overview'
  }

  try {
    const baseUrl = new URL('https://chatbotkit.local')
    const returnUrl = new URL(path, baseUrl)

    if (!path.startsWith('/') || returnUrl.origin !== baseUrl.origin) {
      return '/overview'
    }

    return returnUrl.pathname + returnUrl.search + returnUrl.hash
  } catch {
    return '/overview'
  }
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const templateId = context.query.templateId || context.query.template

  if (templateId) {
    const item = templates.find((item) => {
      return item.templateId === templateId
    })

    if (!item) {
      return {
        redirect: {
          destination: '/new',
          permanent: false,
        },
      }
    }
  }

  const options = {}
  const values = {}

  if (context.query.projectScope === 'true') {
    options.projectScopeReturnPath = getSafeReturnPath(context.query.returnTo)
  }

  // special case to extract the goal from the user

  switch (context.query.from) {
    case 'goal': {
      const user = await prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
        select: {
          goal: true,
        },
      })

      values.description = user?.goal

      break
    }
  }

  return {
    props: makeJsonSafe({
      templateId,

      options,
      values,
    }),
  }
}
