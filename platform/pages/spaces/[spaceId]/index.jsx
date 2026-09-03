import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import ContactList from '@/components/ContactList'
import ContactSelect from '@/components/ContactSelect'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import SpaceSiteList from '@/components/SpaceSiteList'
import SpaceStorageList from '@/components/SpaceStorageList'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-space-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ space }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

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

    if (space.id) {
      const { error } = await fetch(`/api/v1/space/${space.id}/update`, {
        data,

        successMessage: 'Space updated.',
      })

      if (!error) {
        Object.assign(space, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: spaceId },
      } = await fetch(`/api/v1/space/create`, {
        data: scopeCreateData(data),

        successMessage: 'Space created.',
      })

      if (spaceId) {
        router.push(`/spaces/${spaceId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this space?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/space/${space.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/spaces`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="space"
        instance={space}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* space configuration */}
          <div>
            <Headline title="Space Configuration">
              This information is used to configure the space.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={space} />
              {/* contactId */}
              <div>
                <label className="default-label" htmlFor="contactId">
                  Contact
                </label>
                <div className="mt-1">
                  <ContactSelect
                    className="default-input w-full max-w-xs"
                    name="contactId"
                    defaultValue={space.contactId}
                  />
                </div>
                <p className="input-description">
                  Optionally associate this space with a specific contact by
                  entering their ID.
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Show Advanced Options"
              >
                <div className="mt-6 space-y-6">
                  {/* alias */}
                  <div>
                    <label className="default-label" htmlFor="alias">
                      Alias
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full max-w-xs"
                        name="alias"
                        type="text"
                        defaultValue={space.alias}
                        pattern="[a-z0-9_-]*"
                        maxLength={128}
                      />
                    </div>
                    <p className="input-description">
                      Optional unique alias for this space. Use lowercase
                      letters, numbers, hyphens, and underscores only. Can be
                      used to reference this space via @alias.
                    </p>
                  </div>
                  {/* meta */}
                  <div>
                    <label className="default-label" htmlFor="meta">
                      Meta
                    </label>
                    <div className="mt-1">
                      <MetaInput name="meta" defaultMeta={space.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this space.
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
            {/* <BackLink className="default-button" href="/spaces">
              Back To Spaces
            </BackLink> */}
            {space.id ? (
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
              {space.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ space }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/spaces" caption="spaces" title="Space" beta={true}>
          <p>
            A space is transferable file storage for AI agents. Agents can
            upload, read, and manipulate files inside a space, making it easy to
            share context and data across agents and sessions.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form space={space} />
          </div>
        </section>
        {space.id ? (
          <section data-page-section-title="Files">
            <div className="main-page">
              <Headline title="Files">
                Files stored in this space. Upload, download, or manage your
                files here.
              </Headline>
              <SpaceStorageList spaceId={space.id} />
            </div>
          </section>
        ) : null}
        {space.id ? (
          <section data-page-section-title="Sites">
            <div className="main-page">
              <Headline title="Sites">
                Publish this space as a static website. Each site serves the
                space&apos;s files from a slug beneath the site apex.
              </Headline>
              <SpaceSiteList spaceId={space.id} />
            </div>
          </section>
        ) : null}
        {space.id && space.contact ? (
          <section data-page-section-title="Contact">
            <div className="main-page">
              <Headline title="Contact">
                The contact associated with this space.
              </Headline>
              <ContactList
                defaultItems={[space.contact]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {/* {space.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this space.
              </Headline>
              <MetaArea instance={space} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { space }) {
  return (
    <Dashboard
      breadcrumbs={['Spaces', 'ChatBotKit']}
      title={space.name || space.id || 'New'}
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

  if (context.query.spaceId === 'new') {
    return {
      props: makeJsonSafe({
        space: {},
      }),
    }
  }

  const space = await prisma.space.findUnique({
    where: {
      id: context.query.spaceId,
    },

    include: {
      contact: {
        select: {
          id: true,

          name: true,
          description: true,
        },
      },
    },
  })

  if (!space) {
    return {
      notFound: true,
    }
  }

  if (space.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      space,
    }),
  }
}
