import { useState } from 'react'

import prisma from '@/prisma/client'

import { captureError } from '@/lib/error'
import { formToData } from '@/lib/form'
import { sleep } from '@/lib/promise'
import { getSoftSession } from '@/lib/session.get'
import { withSitemapIntegrationResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeAction from '@/components/CodeAction'
import CommaListSelect from '@/components/CommaListSelect'
import { useConfirmDelete } from '@/components/Confirm'
import DatasetImportJobFinishURLs from '@/components/DatasetImportJobFinishURLs'
import DatasetSelect from '@/components/DatasetSelect'
import DaysSelect from '@/components/DaysSelect'
import DescriptionInput from '@/components/DescriptionInput'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ScheduleSelect from '@/components/ScheduleSelect'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-sitemap.yaml'

import clsx from 'clsx'

export const VISIBLE_EVENT_TYPES = []

export function SelectorsCheatsheet({
  className,

  ...props
}) {
  return (
    <Expando
      {...props}
      titleClassName={clsx('default-link text-sm', className)}
      title="Selectors Cheat Sheet"
    >
      <div className="content-prose">
        <table>
          <thead className="text-bold">
            <tr>
              <th>Selector</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-mono">some-tag</td>
              <td>
                Focus on the content of an element with the specified tag name
              </td>
            </tr>
            <tr>
              <td className="font-mono">#some-id</td>
              <td>Focus on the content of an element with the specified id</td>
            </tr>
            <tr>
              <td className="font-mono">.some-class-name</td>
              <td>
                Focus on the content of an element with the specified class name
              </td>
            </tr>
            <tr>
              <td className="font-mono">@jsonld</td>
              <td>Include structured data</td>
            </tr>
            <tr>
              <td className="font-mono">@microdata</td>
              <td>Include microdata data</td>
            </tr>
            <tr>
              <td className="font-mono">@skiphtml</td>
              <td>Skip HTML extraction</td>
            </tr>
            <tr>
              <td className="font-mono">@skiptag-a</td>
              <td>Skip extracting anchor tags</td>
            </tr>
            <tr>
              <td className="font-mono">@skiptag-img</td>
              <td>Skip extracting image tags</td>
            </tr>
            <tr>
              <td className="font-mono">@skiptag-audio</td>
              <td>Skip extracting audio tags</td>
            </tr>
            <tr>
              <td className="font-mono">@skiptag-video</td>
              <td>Skip extracting video tags</td>
            </tr>
            <tr>
              <td className="font-mono">@skiptag-hr</td>
              <td>Skip extracting horizontal lines</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Expando>
  )
}

export function Form({ integration }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Sitemap integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/sitemap/${integration.id}/update`,
        {
          data,

          successMessage: 'Sitemap integration updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const { error, data: createData } = await fetch(
        `/api/v1/integration/sitemap/create`,
        {
          data: scopeCreateData(data),

          successMessage: 'Sitemap integration created.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        const { id: sitemapIntegrationId } = createData

        if (sitemapIntegrationId) {
          router.push(`/integrations/sitemap/${sitemapIntegrationId}`)
        }
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (
      !(await confirmDelete('Do you really want to delete this integration?'))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/integration/sitemap/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Sitemap integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSync(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/sitemap/${integration.id}/sync`, {
      successMessage: 'The sitemap is syncing with your dataset.',

      data: {},
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/sitemap"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Sitemap Integration Configuration">
              This information is used to configure some general options around
              the integration.
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
                    defaultValue={integration.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the integration from others.
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
                    defaultValue={integration.description}
                  />
                </div>
                <p className="input-description">
                  Provide optional description for this integration.
                </p>
              </div>
              {/* datasetId */}
              <div>
                <label className="default-label" htmlFor="datasetId">
                  Dataset
                </label>
                <div className="mt-1">
                  <DatasetSelect
                    className="default-input w-full max-w-xs sm:text-sm"
                    name="datasetId"
                    defaultValue={integration.datasetId}
                    required={true}
                  />
                </div>
                <p className="input-description">
                  Dataset to import information into.
                </p>
              </div>
            </div>
          </div>
          {/* application configuration */}
          <div>
            <Headline title="Sitemap Application Configuration">
              This information is used to configure the sitemap integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* url */}
              <div>
                <label className="default-label" htmlFor="url">
                  URL
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full sm:text-sm"
                    name="url"
                    type="url"
                    defaultValue={integration.url}
                    spellCheck={false}
                    required={true}
                  />
                </div>
                <p className="input-description">
                  The URL of the website or the website sitemap. A sitemap URL
                  typically ends with <code>/sitemap.xml</code>.{' '}
                  <strong>
                    If the provided URL is not a sitemap we will attempt to
                    crawl/spider the entire website.
                  </strong>
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
                      defaultValue={integration.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this integration. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this integration via @alias.
                  </p>
                </div>
                {/* glob */}
                <div>
                  <label className="default-label" htmlFor="glob">
                    Glob
                  </label>
                  <div className="mt-1">
                    <AutoTextarea
                      className="default-input w-full sm:text-sm font-mono"
                      name="glob"
                      defaultValue={integration.glob}
                      placeholder="/**"
                      spellCheck={false}
                    />
                  </div>
                  <p className="input-description">
                    This field specifies the files to include in the
                    integration. Use a glob pattern to match the desired files,
                    such as <code>*.txt</code> for all text files or{' '}
                    <code>&#x2f;**</code> for all files in all subdirectories.
                    Multiple globs can be specified by separating them with a
                    new line. Negative globs can be specified by prefixing them
                    with an exclamation mark (<code>!</code>).{' '}
                    <strong>
                      Keep in mind that <code>&#x2f;*</code> only looks matches
                      the first level of folders. To match all levels you need
                      to use <code>&#x2f;**</code>.
                    </strong>
                  </p>
                </div>
                {/* selectors */}
                <div>
                  <label className="default-label" htmlFor="selectors">
                    Selectors
                  </label>
                  <div className="mt-1">
                    <CommaListSelect
                      className="default-input w-full sm:text-sm"
                      name="selectors"
                      defaultValue={integration.selectors}
                      placeholder="Type a CSS selector and press enter..."
                      spellCheck={false}
                    />
                  </div>
                  <p className="input-description">
                    Specify selectors to extract specific content from pages. By
                    default, the integration extracts from{' '}
                    <strong>article</strong>, then <strong>main</strong>, and
                    finally <strong>body</strong>. Multiple selectors act as
                    fallbacks if the first isn&apos;t found.
                  </p>
                  <SelectorsCheatsheet className="mt-2" />
                </div>
                {/* javascript */}
                <div>
                  <label className="default-label" htmlFor="javascript">
                    JavaScript
                    <sup className="ml-2 bg-gray-800 text-white p-0.5 rounded">
                      PRO
                    </sup>
                  </label>
                  <div className="mt-1">
                    <Toggle
                      className="default-input w-full"
                      name="javascript"
                      defaultChecked={integration.javascript}
                    />
                  </div>
                  <p className="input-description">
                    Indicates weather to use a more advanced spidering engine
                    which is capable of understanding dynamic pages with
                    JavaScript support.{' '}
                    <strong>
                      This engine is only used if your account limits allow it.
                    </strong>
                  </p>
                </div>
                {/* syncSchedule */}
                <div>
                  <label className="default-label" htmlFor="syncSchedule">
                    Sync Schedule
                    <sup className="ml-2 bg-gray-800 text-white p-0.5 rounded">
                      PRO
                    </sup>
                  </label>
                  <div className="mt-1">
                    <ScheduleSelect
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="syncSchedule"
                      defaultValue={integration.syncSchedule}
                      fair={true}
                    />
                  </div>
                  <p className="input-description">
                    The sync scheduled defines how often to sync your Sitemap
                    URLs with the selected dataset.{' '}
                    <strong>
                      This option is only available to customers on ChatBotKit
                      Pro and Team plans.
                    </strong>
                  </p>
                </div>
                {/* expiresIn */}
                <div>
                  <label className="default-label" htmlFor="expiresIn">
                    Expires In
                  </label>
                  <div className="mt-1">
                    <DaysSelect
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="expiresIn"
                      defaultValue={integration.expiresIn}
                    />
                  </div>
                  <p className="input-description">
                    The dataset record will be automatically removed after this
                    period. When set to <strong>automatic</strong> dataset
                    records will be removed upon synchronization.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={integration.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this integration.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackButton
              type="button"
              className="default-button"
              href="/integrations"
            >
              Back To Integrations
            </BackButton> */}
            {integration.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {integration.id ? (
              <button
                className="primary-button"
                type="button"
                onClick={handleSync}
              >
                Sync
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {integration.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ integration }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/integrations" caption="integrations" title="Sitemap">
          <p>
            With this integration, you can dynamically import website content
            into a dataset so that your chatbot always have the most up-to-date
            information. Detailed instructions on how to set up this integration
            can be found at{' '}
            <DocsLink className="default-link" slug="sitemap">
              ChatBotKit Integrations
            </DocsLink>{' '}
            docs.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form integration={integration} />
          </div>
        </section>
        {integration.id ? (
          <section data-page-section-title="URLs">
            <div className="main-page">
              <Headline title="Sitemap Sync URLs">
                Understand what Sitemap pages are included in this integration.
              </Headline>
              <DatasetImportJobFinishURLs
                contextFilters={{ sitemapIntegrationId: integration.id }}
                actions={{
                  'Exclude URL': {
                    type: 'danger',
                    action: async (url) => {
                      const glob = document.querySelector('textarea[name=glob]')

                      if (!glob) {
                        await captureError('Glob not found')

                        return
                      }

                      const pathname = new URL(url).pathname

                      const preValues = glob.value
                        .split('\n')
                        .map((value) => value.trim())
                        .filter(Boolean)

                      preValues.unshift('/**')

                      const values = new Set(preValues)

                      values.add(`!${pathname}`)

                      glob.value = Array.from(values).join('\n')

                      toast.success('URL excluded!')

                      await sleep(1000)

                      toast.success('Click save to apply the changes.')
                    },
                  },
                }}
              />
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Sitemap Integration Events">
                Keep tabs on the progress of your Sitemap integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ sitemapIntegrationId: integration.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { integration }) {
  return (
    <Dashboard
      breadcrumbs={['Sitemap', 'Integrations', 'ChatBotKit']}
      title={integration.name || integration.id || 'New'}
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

  if (context.query.sitemapIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          datasetId: context.query.datasetId,

          // default values

          expiresIn: 0,
        },
      }),
    }
  }

  const integration = await prisma.sitemapIntegration.findUnique({
    where: {
      id: context.query.sitemapIntegrationId,
    },

    include: {
      ...withSitemapIntegrationResources(session.user.id),
    },
  })

  if (!integration) {
    return {
      notFound: true,
    }
  }

  if (integration.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      integration,
    }),
  }
}
