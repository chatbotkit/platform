import { useState } from 'react'

import secretTemplatesData from '@/data/secrets/visible'

import prisma from '@/prisma/client'
import { SecretKind, SecretType, SecretVisibility } from '@/prisma/enums'

import { maskSecretConfig } from '@/lib/credential.mask'
import { isDevelopment, isStaging } from '@/lib/env'
import { formToData } from '@/lib/form'
import { getSecretAuthenticationBlockReason } from '@/lib/secret.authenticate'
import { normalizeSecretName } from '@/lib/secret.name'
import { getSoftSession } from '@/lib/session.get'
import { withSecretResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'
import { isPlatformTemplate } from '@/lib/template'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import { copyTextToClipboard } from '@/components/CopyButton'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import List from '@/components/List'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import PlatformExperienceOnly from '@/components/PlatformExperienceOnly'
import RevealTextarea from '@/components/RevealTextarea'
import SecretConfigInput from '@/components/SecretConfigInput'
import ThisSolution from '@/components/ThisSolution'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-secret-instance.yaml'

import clsx from 'clsx'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

function AuthenticateButton({ secret, value, onClick }) {
  const disabledReason = getSecretAuthenticationBlockReason(secret)

  const button = (
    <button
      type="button"
      className={clsx({
        'default-button': !!value,
        'primary-button': !value,
        // @note a disabled button swallows its own pointer events - let the
        // hover fall through to the tooltip container behind it
        'pointer-events-none': !!disabledReason,
      })}
      // @note the type has to have an authentication flow at all - the static
      // ones are values you type in - and it has to carry the config that flow
      // runs on
      disabled={!!disabledReason}
      onClick={onClick}
    >
      Authenticate
    </button>
  )

  if (!disabledReason) {
    return button
  }

  return (
    <span className="relative group/tooltip flex">
      {button}
      <span className="tooltip above w-64">{disabledReason}</span>
    </span>
  )
}

export function Form({ secret, platformTemplates = {} }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const [value, setValue] = useState(secret.value)

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

    if (secret.id) {
      const { error } = await fetch(`/api/v1/secret/${secret.id}/update`, {
        data,

        successMessage: 'Secret updated.',
      })

      if (!error) {
        Object.assign(secret, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: secretId },
      } = await fetch(`/api/v1/secret/create`, {
        data: scopeCreateData(data),

        successMessage: 'Secret created.',
      })

      if (secretId) {
        router.push(`/secrets/${secretId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this secret?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/secret/${secret.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/secrets`)
    }
  }

  async function handleAuthenticate(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    const { error, data } = await fetch(
      `/api/v1/secret/${secret.id}/authenticate`,
      {
        data: {},
      }
    )

    if (error) {
      return
    }

    if (event.metaKey || event.ctrlKey) {
      copyTextToClipboard(
        new URL(data.url, window.location.origin).toString(),
        'Authentication URL copied to clipboard.'
      )

      return
    }

    const handle = window.open(
      data.url,
      '_blank'
      // @note we need the use the opener
    )

    function handleMessage(event) {
      if (event.source !== handle) {
        return
      }

      if (event.data.type === 'oauth') {
        const { error, error_description } = event.data.params || {}

        if (error_description || error) {
          toast.error(error_description || error)
        } else {
          toast.success('Authentication successful.')

          router.refresh()
        }
      }

      window.removeEventListener('message', handleMessage)
    }

    window.addEventListener('message', handleMessage)
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="secret"
        instance={secret}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* secret configuration */}
          <div>
            <Headline title="Secret Configuration">
              This information is used to configure the secret.
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
                    defaultValue={secret.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the secret from others.{' '}
                  {secret.name?.length ? (
                    <>
                      You can reference this this secret by name in your ability
                      instruction using{' '}
                      <code className="font-semibold select-all">
                        {'${'}SECRET_
                        {normalizeSecretName(secret.name).toUpperCase()}
                        {'}'}
                      </code>{' '}
                      or{' '}
                      <code className="font-semibold select-all">
                        {'${'}SECRET_DEFAULT{'}'}
                      </code>{' '}
                      when attached to an ability directly.
                    </>
                  ) : null}
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <AutoTextarea
                    className="default-input w-full"
                    name="description"
                    defaultValue={secret.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this secret is about. This
                  information is not used as part of your chatbot conversations.
                </p>
              </div>
              {/* kind */}
              <div>
                <label className="default-label" htmlFor="kind">
                  Kind
                </label>
                <div className="mt-1">
                  <select
                    className="default-input w-full max-w-xs"
                    name="kind"
                    defaultValue={secret.kind}
                  >
                    {Object.entries(SecretKind).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="input-description">
                  Select the kind of secret. This information is used to
                  configure the secret scope. Shared secrets are accessible by
                  all users of the AI solution. Personal secrets are associated
                  with specific contacts.
                </p>
              </div>
              {/* type */}
              <div>
                <label className="default-label" htmlFor="type">
                  Type
                </label>
                <div className="mt-1">
                  <select
                    className="default-input w-full max-w-xs"
                    name="type"
                    defaultValue={secret.type}
                  >
                    {Object.entries(SecretType).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="input-description">
                  Select the type of secret. This information is used to
                  configure the secret.
                </p>
              </div>
              {/* value */}
              <div>
                <label className="default-label" htmlFor="value">
                  Value
                </label>
                <div className="mt-1">
                  <RevealTextarea
                    className="default-input w-full max-h-96 !overflow-auto not-focus:max-h-24 [&:not(:focus)]:gradient-mask-b-10"
                    name="value"
                    token={value}
                    setToken={setValue}
                  />
                </div>
                <p className="input-description">
                  Type the value of the secret. This information is used to
                  configure the secret.
                </p>
              </div>
              {/* config */}
              <div>
                <label className="default-label" htmlFor="config">
                  Config
                </label>
                <div className="mt-1">
                  <SecretConfigInput
                    className="font-mono break-all max-h-96 !overflow-auto not-focus:max-h-24"
                    wrapperClassName="[&:not(:focus-within)]:gradient-mask-b-10"
                    name="config"
                    defaultConfig={secret.config}
                    secretType={secret.type}
                    templates={platformTemplates}
                    zoom={false}
                  />
                  {/* @todo create a custom input that can show warnings such as when using non http: urls */}
                </div>
                <p className="input-description">
                  Type the configuration of the secret. This information is used
                  to configure the secret.
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
                      defaultValue={secret.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this secret. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this secret via @alias.
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
                      defaultValue={secret.visibility}
                    >
                      {Object.entries(SecretVisibility).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="input-description">
                    Private secrets are only accessible by the owner. Protected
                    secrets are accessible by the owner and all child Users.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={secret.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this secret.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/secrets">
              Back To Secrets
            </BackLink> */}
            {secret.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {secret.id ? (
              <AuthenticateButton
                secret={secret}
                value={value}
                onClick={handleAuthenticate}
              />
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {secret.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export function Integrations({ secret }) {
  return (
    <List>
      {secret.abilities.map(({ id, name, description, skillsetId }) => (
        <List.Item
          key={id}
          title={name}
          body={
            description || (
              <span className="italic">An ability without description</span>
            )
          }
          link={`/skillsets/${skillsetId}/abilities/${id}`}
          target="_blank"
        >
          <span className="tag">ability</span>
        </List.Item>
      ))}
    </List>
  )
}

function getSecretUsageSections(secret) {
  const secretId = secret.id
  const personal = secret.kind === SecretKind.personal

  const node = personal
    ? `import { ChatBotKit, AuthorizationRequiredError } from '@chatbotkit/sdk'

const client = new ChatBotKit({
  secret: process.env.CHATBOTKIT_API_SECRET,
})

const secretId = '${secretId}'

// identify your end-user by a stable fingerprint - a verified contact is
// created or reused for it automatically
const contact = await client.contact.ensure({ fingerprint: 'user-42' })

try {
  // proxy a request - the secret is injected server-side, never in your code
  const response = await client.contact.secret.proxy(contact.id, secretId, {
    method: 'GET',
    url: 'https://api.example.com/me',
  })

  console.log(response.status, await response.json())

  // ...or mint a usable token to call the provider yourself (oauth/jwt only)
  const { token, expiresAt } = await client.contact.secret.mint(
    contact.id,
    secretId
  )

  console.log(token, expiresAt)
} catch (error) {
  if (error instanceof AuthorizationRequiredError) {
    // the contact has not connected this account yet - send them to authorize
    console.log('ask the user to connect:', error.url)
  }
}`
    : `import { ChatBotKit } from '@chatbotkit/sdk'

const client = new ChatBotKit({
  secret: process.env.CHATBOTKIT_API_SECRET,
})

const secretId = '${secretId}'

// proxy a request - the secret is injected server-side, never in your code
const response = await client.secret.proxy(secretId, {
  method: 'GET',
  url: 'https://api.example.com/me',
})

console.log(response.status, await response.json())

// ...or mint a usable token to call the provider yourself (oauth/jwt only)
const { token, expiresAt } = await client.secret.mint(secretId)

console.log(token, expiresAt)`

  const go = personal
    ? `package main

import (
  "context"
  "errors"
  "fmt"
  "os"

  "github.com/chatbotkit/go-sdk/sdk"
  "github.com/chatbotkit/go-sdk/types"
)

func main() {
  ctx := context.Background()

  client := sdk.New(sdk.Options{
    Secret: os.Getenv("CHATBOTKIT_API_SECRET"),
  })

  secretID := "${secretId}"

  // identify your end-user by a stable fingerprint
  contact, err := client.Contact.Ensure(ctx, types.ContactEnsureRequest{
    Fingerprint: "user-42",
  })
  if err != nil {
    panic(err)
  }

  method := "GET"

  resp, err := client.Contact.Secret.Proxy(ctx, contact.ID, secretID, types.ContactSecretProxyRequest{
    Method: &method,
    URL:    "https://api.example.com/me",
  })
  if err != nil {
    var authErr *sdk.AuthorizationRequiredError
    if errors.As(err, &authErr) {
      fmt.Println("ask the user to connect:", authErr.URL)
      return
    }
    panic(err)
  }
  defer resp.Body.Close()

  fmt.Println("status:", resp.StatusCode)
}`
    : `package main

import (
  "context"
  "fmt"
  "os"

  "github.com/chatbotkit/go-sdk/sdk"
  "github.com/chatbotkit/go-sdk/types"
)

func main() {
  ctx := context.Background()

  client := sdk.New(sdk.Options{
    Secret: os.Getenv("CHATBOTKIT_API_SECRET"),
  })

  secretID := "${secretId}"

  method := "GET"

  // proxy a request - the secret is injected server-side
  resp, err := client.Secret.Proxy(ctx, secretID, types.SecretProxyRequest{
    Method: &method,
    URL:    "https://api.example.com/me",
  })
  if err != nil {
    panic(err)
  }
  defer resp.Body.Close()

  fmt.Println("status:", resp.StatusCode)

  // ...or mint a usable token (oauth/jwt only)
  token, err := client.Secret.Mint(ctx, secretID)
  if err != nil {
    panic(err)
  }

  fmt.Println(token.Token, token.ExpiresAt)
}`

  const python = personal
    ? `import asyncio
import os

from chatbotkit import ChatBotKit, AuthorizationRequiredError


async def main():
    client = ChatBotKit(secret=os.environ["CHATBOTKIT_API_SECRET"])

    secret_id = "${secretId}"

    # identify your end-user by a stable fingerprint
    contact = await client.contact.ensure({"fingerprint": "user-42"})

    try:
        # proxy a request - the secret is injected server-side
        response = await client.contact.secret.proxy(
            contact.id,
            secret_id,
            {"method": "GET", "url": "https://api.example.com/me"},
        )

        print(response.status_code, response.json())
    except AuthorizationRequiredError as error:
        # the contact has not connected this account yet
        print("ask the user to connect:", error.url)


asyncio.run(main())`
    : `import asyncio
import os

from chatbotkit import ChatBotKit


async def main():
    client = ChatBotKit(secret=os.environ["CHATBOTKIT_API_SECRET"])

    secret_id = "${secretId}"

    # proxy a request - the secret is injected server-side
    response = await client.secret.proxy(
        secret_id,
        {"method": "GET", "url": "https://api.example.com/me"},
    )

    print(response.status_code, response.json())

    # ...or mint a usable token (oauth/jwt only)
    minted = await client.secret.mint(secret_id)

    print(minted.token, minted.expires_at)


asyncio.run(main())`

  const intro = personal
    ? 'This is a personal secret: identify the contact (your end-user) with a stable fingerprint, then proxy or mint on their behalf.'
    : 'Proxy injects the secret into your request server-side (it never leaves the platform), or mint a usable token for oauth/jwt secrets.'

  return {
    sdk: {
      title: 'Node SDK',
      instructions: [
        intro,
        'Proxy returns the upstream response as-is; mint returns { token, expiresAt }.',
        personal
          ? 'If the contact has not authenticated yet, an AuthorizationRequiredError carries the URL to send them to.'
          : 'Only oauth/jwt secrets are mintable; static secrets (bearer/basic/plain) use the proxy.',
      ],
      code: { language: 'javascript', content: node },
    },
    go: {
      title: 'Go SDK',
      instructions: [
        intro,
        personal
          ? 'Use errors.As to detect *sdk.AuthorizationRequiredError and read its URL.'
          : 'Proxy returns the raw *http.Response; Mint returns { Token, ExpiresAt }.',
      ],
      code: { language: 'go', content: go },
    },
    python: {
      title: 'Python SDK',
      instructions: [
        intro,
        personal
          ? 'Catch AuthorizationRequiredError and read .url to send the user to authorize.'
          : 'Proxy returns an httpx.Response; mint returns a typed result with .token / .expires_at.',
      ],
      code: { language: 'python', content: python },
    },
  }
}

export default function Index({ secret, platformTemplates }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/secrets" caption="secrets" title="Secret">
          <p>
            A secret is a piece of information that is used to configure your
            skillsets and integrations. You can create a secret to store
            credentials, API keys, and other sensitive information.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form secret={secret} platformTemplates={platformTemplates} />
          </div>
        </section>
        {secret.id ? (
          <section data-page-section-title="Integrations">
            <div className="main-page">
              <Headline title="Secret Integrations">
                Make the most out of this secret by connecting it to skillset
                abilities.
              </Headline>
              <Integrations secret={secret} />
            </div>
          </section>
        ) : null}
        {/* {secret.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this secret.
              </Headline>
              <MetaArea instance={secret} />
            </div>
          </section>
        ) : null} */}
        {secret.id ? (
          <PlatformExperienceOnly>
            <section data-page-section-title="SDK" data-page-section-more>
              <div className="main-page">
                <Headline title="Use This Secret with the SDK">
                  Use this stored credential from your own code - proxy a
                  request with the secret injected server-side, or mint a
                  usable token.
                </Headline>
                <Expando
                  titleClassName="default-link text-sm"
                  title="Show Examples"
                >
                  <WebhookSetupSection.Multi
                    sections={getSecretUsageSections(secret)}
                  />
                </Expando>
              </div>
            </section>
          </PlatformExperienceOnly>
        ) : null}
        {secret.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on your secret events.
              </Headline>
              <EventLog
                eventType={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ secretId: secret.id }}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { secret }) {
  return (
    <Dashboard
      breadcrumbs={['Secrets', 'ChatBotKit']}
      title={secret.name || secret.id || 'New'}
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

  const platformTemplates = Object.fromEntries(
    Object.entries(secretTemplatesData)
      .filter(([id]) => isPlatformTemplate(id))
      .filter(([, { tags }]) => {
        if (tags?.includes('hidden')) {
          return false
        }

        if (tags?.includes('alpha')) {
          if (!isDevelopment && !isStaging) {
            return false
          }
        }

        return true
      })
      .map(([id, { icon, name, description, type, kind }]) => {
        return [id, { icon, name, description, type, kind }]
      })
  )

  if (context.query.secretId === 'new') {
    return {
      props: makeJsonSafe({
        secret: {},
        platformTemplates,
      }),
    }
  }

  const secret = await prisma.secret.findUnique({
    where: {
      id: context.query.secretId,
    },

    include: {
      abilities: {
        select: {
          id: true,

          name: true,
          description: true,

          skillsetId: true,
        },
      },

      ...withSecretResources(session.user.id),
    },
  })

  if (!secret) {
    return {
      notFound: true,
    }
  }

  if (secret.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      // @note the owner edits the value in place, so it is revealed here and
      // nowhere else; config.clientSecret is masked like every other read
      // surface and the update route keeps the stored one behind the
      // sentinel - see lib/credential.policy.ts
      secret: { ...secret, config: maskSecretConfig(secret.config) },
      platformTemplates,
    }),
  }
}
