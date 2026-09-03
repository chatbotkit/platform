import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import ContactSelect from '@/components/ContactSelect'
import Expando from '@/components/Expando'
import ExpiresAtInput from '@/components/ExpiresAtInput'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-memory-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ memory }) {
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

    if (memory.id) {
      const { error } = await fetch(`/api/v1/memory/${memory.id}/update`, {
        data,

        successMessage: 'Memory updated.',
      })

      if (!error) {
        Object.assign(memory, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: memoryId },
      } = await fetch(`/api/v1/memory/create`, {
        data,

        successMessage: 'Memory created.',
      })

      if (memoryId) {
        router.push(`/memories/${memoryId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this memory?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/memory/${memory.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/memories`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="memory"
        instance={memory}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* memory configuration */}
          <div>
            <Headline title="Memory Configuration">
              This information is used to configure the memory.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={memory} />
              {/* text */}
              <div>
                <label className="default-label" htmlFor="text">
                  Text
                </label>
                <div className="mt-1">
                  <AutoTextarea
                    className="default-input w-full"
                    name="text"
                    defaultValue={memory.text}
                    placeholder="Enter the memory content..."
                    required={true}
                  />
                </div>
                <p className="input-description">
                  The main content of this memory that will be stored and
                  retrieved.
                </p>
              </div>
              {/* contactId */}
              <div>
                <label className="default-label" htmlFor="contactId">
                  Contact
                </label>
                <div className="mt-1">
                  <ContactSelect
                    className="default-input w-full max-w-xs"
                    name="contactId"
                    defaultValue={memory.contactId}
                  />
                </div>
                <p className="input-description">
                  Optionally associate this memory with a specific contact by
                  entering their ID.
                </p>
              </div>
              {/* botId */}
              <div>
                <label className="default-label" htmlFor="botId">
                  Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    className="default-input w-full max-w-xs"
                    name="botId"
                    defaultValue={memory.botId}
                  />
                </div>
                <p className="input-description">
                  Optionally associate this memory with a specific bot.
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Show Advanced Options"
              >
                <div className="mt-6 space-y-6">
                  {/* expiry */}
                  <div>
                    <label className="default-label" htmlFor="expiresAt">
                      Expires
                    </label>
                    <div className="mt-1">
                      <ExpiresAtInput
                        className="default-input w-full max-w-xs"
                        name="expiresAt"
                        defaultValue={memory.expiresAt}
                      />
                    </div>
                    <p className="input-description">
                      When set, the memory is automatically deleted at this time
                      (in your local timezone). Leave empty for no expiry.
                    </p>
                  </div>
                  {/* meta */}
                  <div>
                    <label className="default-label" htmlFor="meta">
                      Meta
                    </label>
                    <div className="mt-1">
                      <MetaInput name="meta" defaultMeta={memory.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this memory.
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
            {/* <BackLink className="default-button" href="/memories">
              Back To Memories
            </BackLink> */}
            {memory.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {memory.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ memory }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/memories"
          caption="memories"
          title="Memory"
          beta={true}
        >
          <p>
            A memory is a piece of information that can be stored and retrieved
            by your AI agents to maintain context and provide personalized
            experiences.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form memory={memory} />
          </div>
        </section>
        {/* {memory.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this memory.
              </Headline>
              <MetaArea instance={memory} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { memory }) {
  return (
    <Dashboard
      breadcrumbs={['Memories', 'ChatBotKit']}
      title={memory.name || memory.id || 'New'}
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

  if (context.query.memoryId === 'new') {
    return {
      props: makeJsonSafe({
        memory: {},
      }),
    }
  }

  const memory = await prisma.memory.findUnique({
    where: {
      id: context.query.memoryId,
    },

    include: {
      contact: {
        select: {
          id: true,

          name: true,
          description: true,
        },
      },
      bot: {
        select: {
          id: true,

          name: true,
          description: true,
        },
      },
    },
  })

  if (!memory) {
    return {
      notFound: true,
    }
  }

  if (memory.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      memory,
    }),
  }
}
