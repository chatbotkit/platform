import prisma from '@/prisma/client'
import { Visibility } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import { useConfirmDelete } from '@/components/Confirm'
import Expando from '@/components/Expando'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

function AvatarPreview() {
  return (
    <div>
      <label className="default-label" htmlFor="avatar">
        Avatar
      </label>
      <div className="mt-1">
        <input
          className="default-input w-full max-w-xs sm:text-sm"
          id="avatar"
          type="text"
          value="Default"
          disabled
          readOnly
        />
      </div>
      <p className="input-description">
        ChatBotKit Avatar currently uses the built-in Default avatar.
      </p>
      <div className="relative mt-3 block aspect-video max-w-xs overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <video
          className="h-full w-full bg-black object-cover object-center"
          src="/avatars/friend.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-label="ChatBotKit Avatar preview"
        />
        <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]">
          <span className="tag darker max-w-full text-xs">Default</span>
        </div>
      </div>
    </div>
  )
}

export function Form({ integration }) {
  const confirmDelete = useConfirmDelete()

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { popup, openPopup } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Avatar integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/avatar/${integration.id}/update`,
        {
          data: {
            ...data,
          },
        }
      )

      if (!error) {
        Object.assign(integration, data)
      }
    } else {
      const {
        data: { id: avatarIntegrationId },
      } = await fetch(`/api/v1/integration/avatar/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (avatarIntegrationId) {
        router.push(`/integrations/avatar/${avatarIntegrationId}`)
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
      `/api/v1/integration/avatar/${integration.id}/delete`,
      {
        data: {},
        successMessage: 'Avatar integration deleted.',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  function handleTest(event) {
    event.preventDefault()

    const a = document.createElement('a')

    a.href = `/integrations/avatar/${integration.id}/test`
    a.target = '_blank'

    a.click()
  }

  return (
    <>
      {popup}
      <ThisSolution type="integrations/avatar" instance={integration} portal />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          <div>
            <Headline title="Avatar Integration Configuration">
              This information is used to configure the private ChatBotKit
              Avatar integration.
            </Headline>
            <div className="mt-6 space-y-6">
              <GeneralBasicOptions instance={integration} />
              <div>
                <label className="default-label" htmlFor="botId">
                  Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    className="default-input w-full max-w-xs"
                    name="botId"
                    defaultValue={integration.botId}
                  />
                </div>
                <p className="input-description">Select an existing bot.</p>
              </div>
            </div>
          </div>
          {integration.id ? (
            <div>
              <Headline title="Advanced Configuration">
                This information is used to customize the Avatar integration.
              </Headline>
              <div className="mt-6 space-y-6">
                <AvatarPreview />
                <Expando
                  titleClassName="default-link text-sm"
                  title="Show Advanced Options"
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
                      letters, numbers, hyphens, and underscores only. Can be
                      used to reference this integration via @alias.
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
                        defaultValue={integration.visibility}
                      >
                        {Object.entries(Visibility).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="input-description">
                      Private integrations are only accessible by the owner.
                      Protected integrations are accessible by the owner and all
                      child Users. Public integrations are accessible by anyone
                      with the embed URL.
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
          ) : null}
        </div>
        <div>
          <div className="action-area">
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
                className="default-button"
                type="button"
                onClick={handleTest}
              >
                Test
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
    <PageSections className="pt-12">
      <section data-page-section-title="Configuration">
        <div className="main-page">
          <Form key={integration.id || 'new'} integration={integration} />
        </div>
      </section>
    </PageSections>
  )
}

Index.getLayout = function (children, { integration }) {
  return (
    <Dashboard
      breadcrumbs={['Avatar', 'Integrations', 'ChatBotKit']}
      title={integration.name || integration.id || 'New'}
      authenticated={true}
    >
      {children}
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

  if (context.query.avatarIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,
        },
      }),
    }
  }

  const integration = await prisma.avatarIntegration.findUnique({
    where: {
      id: context.query.avatarIntegrationId,
    },
    include: {
      bot: {
        select: {
          id: true,
          name: true,
          description: true,
          datasetId: true,
          skillsetId: true,
        },
      },
    },
  })

  if (!integration || integration.userId !== session.user.id) {
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
