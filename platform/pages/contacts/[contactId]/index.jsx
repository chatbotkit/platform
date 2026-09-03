import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import ConversationList from '@/components/ConversationList'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MemoryList from '@/components/MemoryList'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RatingList from '@/components/RatingList'
import SecretList from '@/components/SecretList'
import SpaceList from '@/components/SpaceList'
import TaskList from '@/components/TaskList'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-contact-instance.yaml'

export function Form({ contact }) {
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

    if (contact.id) {
      const { error } = await fetch(`/api/v1/contact/${contact.id}/update`, {
        data,

        successMessage: 'Contact updated.',
      })

      if (!error) {
        Object.assign(contact, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: contactId },
      } = await fetch(`/api/v1/contact/create`, {
        data: {
          ...data,

          meta: {
            app: 'console',
          },

          verifiedAt: Date.now(),
        },

        successMessage: 'Contact created.',
      })

      if (contactId) {
        router.push(`/contacts/${contactId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this contact?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/contact/${contact.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/contacts`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="contact"
        instance={contact}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* contact configuration */}
          <div>
            <Headline title="Contact Configuration">
              This information is used to configure the contact.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={contact} />
              {/* email */}
              <div>
                <label className="default-label" htmlFor="title">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full max-w-xs"
                    name="email"
                    type="email"
                    defaultValue={contact.email}
                  />
                </div>
                <p className="input-description">
                  The email address of the contact.
                </p>
              </div>
              {/* phone */}
              <div>
                <label className="default-label" htmlFor="phone">
                  Phone
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full max-w-xs"
                    name="phone"
                    type="tel"
                    defaultValue={contact.phone}
                  />
                </div>
                <p className="input-description">
                  The phone number of the contact.
                </p>
              </div>
              {/* nick */}
              <div>
                <label className="default-label" htmlFor="nick">
                  Nick
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full max-w-xs"
                    name="nick"
                    type="text"
                    defaultValue={contact.nick}
                  />
                </div>
                <p className="input-description">
                  The nickname of the contact.
                </p>
              </div>
              {/* preferences */}
              <div>
                <label className="default-label" htmlFor="preferences">
                  Preferences
                </label>
                <div className="mt-1">
                  <AutoTextarea
                    className="default-input w-full"
                    name="preferences"
                    defaultValue={contact.preferences}
                  />
                </div>
                <p className="input-description">
                  The preferences of the contact.
                </p>
              </div>
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
                      <MetaInput name="meta" defaultMeta={contact.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this contact.
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
            {/* <BackLink className="default-button" href="/contacts">
              Back To Contacts
            </BackLink> */}
            {contact.id ? (
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
              {contact.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ contact }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/contacts" caption="contacts" title="Contact">
          <p>
            A contact is a person that your AI bots and agents interact with.
            They can be your customers, leads, or anyone you want to communicate
            with.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form contact={contact} />
          </div>
        </section>
        {contact.id ? (
          <section data-page-section-title="Tasks">
            <div className="main-page">
              <Headline title="Tasks">
                The tasks associated with this contact.
              </Headline>
              <TaskList
                filter={false}
                exportRoute={null}
                contactId={contact.id}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {contact.id ? (
          <section data-page-section-title="Conversations">
            <div className="main-page">
              <Headline title="Conversations">
                The conversations associated with this contact.
              </Headline>
              <ConversationList
                filter={false}
                exportRoute={null}
                listRoute={`/api/v1/contact/${contact.id}/conversation/list`}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {contact.id ? (
          <section data-page-section-title="Ratings">
            <div className="main-page">
              <Headline title="Ratings">
                The ratings associated with this contact.
              </Headline>
              <RatingList
                filter={false}
                exportRoute={null}
                contactId={contact.id}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {contact.id ? (
          <section data-page-section-title="Memories">
            <div className="main-page">
              <Headline title="Memories">
                The memories associated with this contact.
              </Headline>
              <MemoryList
                filter={false}
                exportRoute={null}
                contactId={contact.id}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {contact.id ? (
          <section data-page-section-title="Secrets">
            <div className="main-page">
              <Headline title="Secrets">
                The secrets associated with this contact.
              </Headline>
              <SecretList
                filter={false}
                exportRoute={null}
                contactId={contact.id}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {contact.id ? (
          <section data-page-section-title="Spaces">
            <div className="main-page">
              <Headline title="Spaces">
                The spaces associated with this contact.
              </Headline>
              <SpaceList
                filter={false}
                exportRoute={null}
                contactId={contact.id}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {/* {contact.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this contact.
              </Headline>
              <MetaArea instance={contact} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { contact }) {
  return (
    <Dashboard
      breadcrumbs={['Contacts', 'ChatBotKit']}
      title={contact.name || contact.id || 'New'}
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

  if (context.query.contactId === 'new') {
    return {
      props: makeJsonSafe({
        contact: {},
      }),
    }
  }

  const contact = await prisma.contact.findUnique({
    where: {
      id: context.query.contactId,
    },
  })

  if (!contact) {
    return {
      notFound: true,
    }
  }

  if (contact.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      contact,
    }),
  }
}
