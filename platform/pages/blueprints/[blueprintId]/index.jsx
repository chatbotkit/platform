import { useState } from 'react'

import prisma from '@/prisma/client'
import { BlueprintVisibility } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withBlueprintResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDeleteWithOptions } from '@/components/Confirm'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import HubOptions from '@/components/HubOptions'
import Link from '@/components/Link'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'

import useBuilderExperience from '@/hooks/useBuilderExperience'
import useFetch from '@/hooks/useFetch'
import { usePublishResourceDeleted } from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-blueprint-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ blueprint }) {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDeleteWithOptions()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const publishResourceDeleted = usePublishResourceDeleted()

  const isBuilderExperience = useBuilderExperience()

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (blueprint.id) {
      const { error } = await fetch(
        `/api/v1/blueprint/${blueprint.id}/update`,
        {
          data,

          successMessage: 'Blueprint updated.',
        }
      )

      if (!error) {
        Object.assign(blueprint, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: blueprintId },
      } = await fetch(`/api/v1/blueprint/create`, {
        data,

        successMessage: 'Blueprint created.',
      })

      if (blueprintId) {
        router.push(`/blueprints/${blueprintId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    const deleteValues = await confirmDelete(
      'Do you really want to delete this blueprint?',
      {
        options: [
          {
            name: 'deleteResources',
            label: 'Also delete all associated resources',
            description:
              'Permanently delete every bot, dataset, skillset, integration, and other resource created by this blueprint. Leave unchecked to keep them as standalone items. This cannot be undone.',
            default: false,
          },
        ],
      }
    )

    if (!deleteValues) {
      return
    }

    const { error } = await fetch(`/api/v1/blueprint/${blueprint.id}/delete`, {
      data: { ...deleteValues },

      successMessage: 'Blueprint deleted...',
    })

    if (!error) {
      publishResourceDeleted({ kind: 'blueprint', id: blueprint.id })

      router.push(isBuilderExperience ? `/overview` : `/blueprints`)
    }
  }

  async function handleClone(event) {
    event.preventDefault()

    if (!(await confirm('Do you really want to clone this blueprint?'))) {
      return
    }

    const { error, data } = await fetch(
      `/api/v1/blueprint/${blueprint.id}/clone`,
      {
        data: {},

        successMessage: 'Blueprint integration cloned...',
      }
    )

    if (error) {
      return
    }

    router.push(`/blueprints/${data.id}`)
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="blueprint"
        instance={blueprint}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* blueprint basic configuration */}
          <div>
            <Headline title="Blueprint Configuration">
              This information is used to configure the blueprint basic options.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={blueprint} />
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
                      defaultValue={blueprint.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this blueprint. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this blueprint via @alias.
                  </p>
                </div>
                {/* visibility */}
                <div>
                  <label className="default-label" htmlFor="visibility">
                    Visibility
                  </label>
                  <div className="mt-1">
                    <select
                      name="visibility"
                      className="default-input w-full max-w-xs"
                      defaultValue={blueprint.visibility}
                    >
                      {Object.entries(BlueprintVisibility).map(
                        ([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <p className="input-description">
                    Private blueprints are only accessible by the owner.
                    Protected blueprints are accessible by the owner and all
                    child Users.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={blueprint.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this blueprint.
                  </p>
                </div>
              </Expando>
              {/* hub options */}
              {blueprint?.id ? (
                <HubOptions type="blueprint" instance={blueprint} />
              ) : null}
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/blueprints">
              Back To Blueprints
            </BackLink> */}
            {blueprint.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {blueprint.id ? (
              <button
                className="default-button"
                type="button"
                onClick={handleClone}
              >
                Clone
              </button>
            ) : null}
            {blueprint.id ? (
              <Link
                className="primary-button"
                href={`/blueprints/${blueprint.id}/designer`}
              >
                Edit in Designer
              </Link>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {blueprint.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ blueprint }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/blueprints" caption="blueprints" title="Blueprint">
          <p>
            A blueprint is a reusable solution that can be used to create
            multiple resource instances in a consistent way.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form blueprint={blueprint} />
          </div>
        </section>
        {blueprint.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on the progress of your blueprint events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ blueprintId: blueprint.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { blueprint }) {
  return (
    <Dashboard
      breadcrumbs={['Blueprints', 'ChatBlueprintKit']}
      title={blueprint.name || blueprint.id || 'New'}
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

  if (context.query.blueprintId === 'new') {
    return {
      props: makeJsonSafe({
        blueprint: {},
      }),
    }
  }

  const blueprint = await prisma.blueprint.findUnique({
    where: {
      id: context.query.blueprintId,
    },

    include: {
      ...withBlueprintResources(session.user.id),

      hubBlueprintPage: true,
    },
  })

  if (!blueprint) {
    return {
      notFound: true,
    }
  }

  if (blueprint.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      blueprint,
    }),
  }
}
