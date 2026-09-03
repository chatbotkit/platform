import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { generateThreeWordSlug } from '@/lib/slug'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import DocsLink from '@/components/DocsLink'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import PortalConfigInput from '@/components/PortalConfigInput'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import { usePortalApex } from '@/hooks/useHostname'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-portal-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ portal }) {
  const portalApex = usePortalApex()

  const confirm = useConfirm()
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

    delete data.portal

    if (portal.id) {
      const { error } = await fetch(`/api/v1/portal/${portal.id}/update`, {
        data,

        successMessage: 'Portal updated.',
      })

      if (!error) {
        Object.assign(portal, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: portalId },
      } = await fetch(`/api/v1/portal/create`, {
        data: scopeCreateData(data),

        successMessage: 'Portal created.',
      })

      if (portalId) {
        router.push(`/portals/${portalId}`)
      }
    }
  }

  async function handleCustomDomain(event) {
    event.preventDefault()

    if (
      !(await confirm('Please contact support to configure a custom domain.', {
        actions: {
          'Get in touch': { result: true, default: true },
        },
      }))
    ) {
      return
    }

    window.open('/contact')
  }

  async function handleAdhocApp(event) {
    event.preventDefault()

    if (
      !(await confirm('Please contact support to develop an adhoc app.', {
        actions: {
          'Get in touch': { result: true, default: true },
        },
      }))
    ) {
      return
    }

    window.open('/contact')
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this portal?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/portal/${portal.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/portals`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="portal"
        instance={portal}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* portal configuration */}
          <div>
            <Headline title="Portal Configuration">
              This information is used to configure the portal.
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
                    defaultValue={portal.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the portal from others.
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
                    defaultValue={portal.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this portal is about. This
                  information is not used as part of your chatbot conversations.
                </p>
              </div>
              {/* slug */}
              <div>
                <label className="default-label" htmlFor="slug">
                  Slug
                </label>
                <div className="mt-1">
                  <div className="default-input w-full flex flex-row gap-2 overflow-hidden">
                    <input
                      className="flex-1 none-input m-0 p-0"
                      name="slug"
                      type="text"
                      defaultValue={portal.slug}
                      spellCheck={false}
                      required={true}
                    />
                    <div className="auto-bg-gray-100 -mr-3 -mt-2 -mb-2 px-3 flex items-center justify-center">
                      .{portalApex}
                    </div>
                  </div>
                </div>
                <p className="input-description">
                  Type a unique slug to identify the portal. This information is
                  used to generate the unique app URL.
                </p>
              </div>
              {/* config */}
              <div>
                <label className="default-label" htmlFor="config">
                  Config
                </label>
                <div className="mt-1">
                  <PortalConfigInput
                    name="config"
                    defaultConfig={portal.config}
                    required={true}
                  />
                </div>
                <p className="input-description">
                  Type the configuration to customize the portal. This
                  information is used to setup the portal apps, users and look
                  and feel. For more information see the portal configuration{' '}
                  <DocsLink className="default-link" slug="portals">
                    documentation
                  </DocsLink>
                  .
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Advanced Options"
              >
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
                      defaultValue={portal.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this portal. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this portal via @alias.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={portal.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this portal.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/portals">
              Back To Portals
            </BackLink> */}
            {portal.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {portal.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleCustomDomain}
              >
                Custom Domain
              </button>
            ) : null}
            {portal.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleAdhocApp}
              >
                Adhoc App
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {portal.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ portal }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/portals" caption="portals" title="Portal" beta={true}>
          <p>
            Portals are a way to package multiple conversational AI applications
            into a single experience with a unique URL and branding. For more
            information, see the portal{' '}
            <DocsLink slug="portals">documentation</DocsLink>.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form portal={portal} />
          </div>
        </section>
        {/* {portal.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this portal.
              </Headline>
              <MetaArea instance={portal} />
            </div>
          </section>
        ) : null} */}
        {portal.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on the progress of your portal events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ portalId: portal.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { portal }) {
  return (
    <Dashboard
      breadcrumbs={['Portals', 'ChatBotKit']}
      title={portal.name || portal.id || 'New'}
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

  if (context.query.portalId === 'new') {
    return {
      props: makeJsonSafe({
        portal: {
          slug: generateThreeWordSlug({ suffix: true }),

          config: {
            apps: {
              // @todo add all apps

              chat: {
                save: true,
                models: true,
                sources: true,
              },

              task: {},

              connect: {},

              inbox: {},

              usage: {},
            },

            users: {
              [`user@example.com`]: {},
              [`@example.com`]: {},
            },

            layout: {
              sidebar: {
                title: 'ChatBotKit',
                logo: '/icon.png',
              },
            },
          },
        },
      }),
    }
  }

  const portal = await prisma.portal.findUnique({
    where: {
      id: context.query.portalId,
    },

    include: {
      ...Object.fromEntries(
        // @todo dynamically find all integrations
        [].map((key) => {
          return [
            `${key}Integrations`,
            {
              select: {
                id: true,

                name: true,
                description: true,
              },
            },
          ]
        })
      ),
    },
  })

  if (!portal) {
    return {
      notFound: true,
    }
  }

  if (portal.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      portal,
    }),
  }
}
