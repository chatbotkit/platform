import { useEffect, useRef, useState } from 'react'

import prisma from '@/prisma/client'

import availableEvents from '@/lib/event'
import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import DocsLink from '@/components/DocsLink'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-webhooks.yaml'

import clsx from 'clsx'

export const VISIBLE_EVENT_TYPES = ['webhook.request']

export function EventsSelector({
  className,

  name: inputName,

  defaultValue: inputDefaultValue,
  value: inputValue,
  onChange: inputOnChange,
}) {
  const inputRef = useRef()

  const [value, setValue] = useState('')

  const [toggledEvents, setToggledEvents] = useState([])

  useEffect(() => {
    const value =
      typeof inputValue !== 'undefined' ? inputValue : inputDefaultValue

    if (!value) {
      setToggledEvents([])

      return
    }

    setToggledEvents(
      Array.from(
        new Set(
          value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s)
        )
      )
    )
  }, [inputValue])

  useEffect(() => {
    inputRef.current.value = toggledEvents.join(',')

    setValue(inputRef.current.value)

    if (inputOnChange) {
      const event = new Event('change', { bubbles: true })

      Object.defineProperty(event, 'target', {
        writable: false,
        value: inputRef.current,
      })

      inputOnChange(event)
    }
  }, [toggledEvents])

  function handleToggleCheckedChange(event, toggle) {
    let events = toggledEvents

    if (toggle) {
      events = [...events, event]
    } else {
      events = events.filter((_event) => _event !== event)
    }

    setToggledEvents(events)
  }

  return (
    <div className={clsx(className, 'p-2')}>
      <input
        ref={inputRef}
        className="hidden"
        name={inputName}
        type="text"
        value={value}
        onChange={() => {}} // no handler
      />
      <div className="space-y-2">
        {availableEvents
          .filter(({ trigger }) => !!trigger)
          .map(({ type, name, description }) => {
            return (
              <div key={type} className="flex flex-row space-x-2">
                <Toggle
                  key={type}
                  checked={toggledEvents.includes(type)}
                  setChecked={handleToggleCheckedChange.bind(null, type)}
                />
                <div className="space-y-1">
                  <div className="font-semibold">{name}</div>
                  <div className="text-sm">{description}</div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

export function Form({ webhook }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (data.events) {
      data.events = data.events.split(',')
    } else {
      data.events = []
    }

    if (webhook.id) {
      const { error } = await fetch(`/api/v1/webhook/${webhook.id}/update`, {
        data,

        successMessage: 'Webhook updated.',
      })

      if (!error) {
        Object.assign(webhook, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: webhookId },
      } = await fetch(`/api/v1/webhook/create`, {
        data,

        successMessage: 'Webhook created.',
      })

      if (webhookId) {
        router.push(`/webhooks/${webhookId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this webhook?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/webhook/${webhook.id}/delete`, {
      data: {},

      successMessage: 'Webhook deleted...',
    })

    if (!error) {
      router.push(`/webhooks`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="webhook"
        instance={webhook}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* webhook configuration */}
          <div>
            <Headline title="Webhook Configuration">
              This information is used to configure the webhook.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* name */}
              <div>
                <label className="default-label" htmlFor="name">
                  Name
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    name="name"
                    type="text"
                    defaultValue={webhook.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the webhook from others.
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <DescriptionInput
                    className="default-input w-full"
                    name="description"
                    defaultValue={webhook.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this webhook is about.
                </p>
              </div>
              {/* request */}
              <div>
                <label className="default-label" htmlFor="request">
                  Request
                </label>
                <div className="mt-1">
                  <AutoTextarea
                    className="default-input w-full"
                    name="request"
                    defaultValue={webhook.request}
                    placeholder="https://..."
                  />
                </div>
                <p className="input-description">
                  The web request for this particular webhook. You can type in a
                  full http request or just the URL of the endpoint.
                </p>
              </div>
              {/* events */}
              <div>
                <label className="default-label" htmlFor="events">
                  Events
                </label>
                <div className="mt-1">
                  <EventsSelector
                    className="default-input w-full"
                    name="events"
                    defaultValue={webhook.events}
                  />
                </div>
                <p className="input-description">
                  The events this webhook will trigger for.
                </p>
              </div>
              {/* secret */}
              {webhook.secret ? (
                <div>
                  <label className="default-label" htmlFor="secret">
                    Secret
                  </label>
                  <div className="mt-1">
                    <RevealToken
                      className="default-input w-full"
                      defaultToken={webhook.secret}
                      readOnly={true}
                    />
                  </div>
                  <p className="input-description">
                    Secret token to use to validate incoming webhook requests.
                    See the{' '}
                    <DocsLink slug="webhooks">webhooks documentation</DocsLink>{' '}
                    for more information.
                  </p>
                </div>
              ) : null}
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Show Advanced Options"
              >
                <div className="mt-6 space-y-6">
                  {/* meta */}
                  <div>
                    <label className="default-label" htmlFor="meta">
                      Meta
                    </label>
                    <div className="mt-1">
                      <MetaInput name="meta" defaultMeta={webhook.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this webhook.
                    </p>
                  </div>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/webhooks">
              Back To Webhooks
            </BackLink> */}
            {webhook.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {webhook.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ webhook }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/webhooks" caption="webhooks" title="Webhook" beta>
          <p>
            A webhook is a powerful automation tool that allows software
            applications to communicate and share real-time data with each
            other. It acts as a bridge between different systems, enabling
            seamless integration and triggering actions based on specific
            events. Webhooks are commonly used in various scenarios, such as
            receiving updates from external services, automating tasks, and
            enhancing the functionality of your applications.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page first">
            <Form webhook={webhook} />
          </div>
        </section>
        {webhook.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on the progress of your webhook events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ webhookId: webhook.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { webhook }) {
  return (
    <Dashboard
      breadcrumbs={['Webhooks', 'ChatBotKit']}
      title={webhook.name || webhook.id || 'New'}
      authenticated={true}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
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

  if (context.query.webhookId === 'new') {
    return {
      props: makeJsonSafe({
        webhook: {},
      }),
    }
  }

  const webhook = await prisma.webhook.findUnique({
    where: {
      id: context.query.webhookId,
    },
  })

  if (!webhook) {
    return {
      notFound: true,
    }
  }

  if (webhook.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      webhook: webhook,
    }),
  }
}
