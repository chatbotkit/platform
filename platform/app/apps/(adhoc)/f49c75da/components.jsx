'use client'

import { useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'

import usePopup from '@/hooks/usePopup'

import manifest from './app.manifest'
import { configureIntegration } from './server'

import { InformationCircleIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

function ConfigureForm({
  integrationId,
  manifestUrl,

  existingSigningSecret,
  existingBotToken,
  existingUserToken,

  onClose,
}) {
  const [signingSecret, setSigningSecret] = useState(
    existingSigningSecret || ''
  )

  const [botToken, setBotToken] = useState(existingBotToken || '')

  const [userToken, setUserToken] = useState(existingUserToken || '')

  return (
    <div className="space-y-4">
      <p>
        Install the Slack app in your workspace, then paste the credentials
        below. Click Install to open Slack&apos;s manifest installer.
      </p>
      <div className="flex gap-2">
        <a
          className="default-button"
          href={manifestUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Install
        </a>
      </div>
      <div className="space-y-1">
        <label className="default-label" htmlFor="signingSecret">
          Signing Secret
        </label>
        <input
          id="signingSecret"
          name="signingSecret"
          type="password"
          className="default-input w-full"
          placeholder="xoxs-..."
          value={signingSecret}
          onChange={(e) => setSigningSecret(e.target.value)}
        />
        <p className="input-description">
          Slack → Basic Information → App Credentials → Signing Secret.
        </p>
      </div>
      <div className="space-y-1">
        <label className="default-label" htmlFor="userToken">
          User OAuth Token (optional)
        </label>
        <input
          id="userToken"
          name="userToken"
          type="password"
          className="default-input w-full"
          placeholder="xoxp-..."
          value={userToken}
          onChange={(e) => setUserToken(e.target.value)}
        />
        <p className="input-description">
          Optional. Adds user-level permissions.
        </p>
      </div>
      <div className="space-y-1">
        <label className="default-label" htmlFor="botToken">
          Bot User OAuth Token
        </label>
        <input
          id="botToken"
          name="botToken"
          type="password"
          className="default-input w-full"
          placeholder="xoxb-..."
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />
        <p className="input-description">
          Slack → OAuth & Permissions → Bot User OAuth Token.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="primary-button"
          onClick={async () => {
            // @note we validate slack token prefixes client-side before attempting to save

            const signingSecretTrimmed = signingSecret.trim()
            const botTokenTrimmed = botToken.trim()
            const userTokenTrimmed = userToken.trim()

            // @note skip validation and updating if value is the sentinel

            const finalSigningSecret =
              signingSecretTrimmed === '********'
                ? undefined
                : signingSecretTrimmed || undefined

            const finalBotToken =
              botTokenTrimmed === '********'
                ? undefined
                : botTokenTrimmed || undefined

            const finalUserToken =
              userTokenTrimmed === '********'
                ? undefined
                : userTokenTrimmed || undefined

            if (
              finalBotToken &&
              finalBotToken !== '********' &&
              !finalBotToken.startsWith('xoxb-')
            ) {
              toast.error('Bot User OAuth token must start with xoxb-')

              return
            }

            if (
              finalUserToken &&
              finalUserToken !== '********' &&
              !finalUserToken.startsWith('xoxp-')
            ) {
              toast.error('User OAuth token must start with xoxp-')

              return
            }

            try {
              const result = await configureIntegration({
                id: integrationId,
                signingSecret: finalSigningSecret,
                botToken: finalBotToken,
                userToken: finalUserToken,
              })

              if (!result) {
                return throwUnprocessableEntity('Unexpected action result')
              }

              if ('error' in result) {
                throw errorToErrorResponse(result.error)
              }

              toast.success('Slack integration configured')

              onClose()
            } catch (e) {
              toast.error(e.message)
            }
          }}
        >
          Save
        </button>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">
        <InformationCircleIcon className="size-4 mt-0.5 text-yellow-600 dark:text-yellow-300" />
        <p className="flex-1">
          Configured credentials are shown as <code>********</code> for
          security. Leave them unchanged to preserve existing values, or enter
          new credentials to update them.
        </p>
      </div>
    </div>
  )
}

export function ConnectionScreen({ integrations }) {
  const { popup, openPopup, closePopup } = usePopup()

  const handleOpenConfigure = (integration) => {
    const { manifestUrl, signingSecret, botToken, userToken, id } = integration

    openPopup(
      <ConfigureForm
        integrationId={id}
        manifestUrl={manifestUrl}
        existingSigningSecret={signingSecret}
        existingBotToken={botToken}
        existingUserToken={userToken}
        onClose={closePopup}
      />,
      {
        title: 'Configure Slack Integration',
        cancelButtonCaption: 'Close',
        noActions: true,
      }
    )
  }

  return (
    <>
      {popup}
      <List>
        {integrations.map((integration) => {
          const { icon, id, name, description, configured } = integration

          return (
            <List.Item
              key={id}
              icon={
                icon ? (
                  <DynamicIcon
                    className="flex flex-row justify-center items-center w-12 h-12 text-2xl rounded-2xl overflow-hidden"
                    icon={icon}
                  />
                ) : null
              }
              title={name || id}
              body={
                description || (
                  <span className="italic">
                    An integration without description
                  </span>
                )
              }
              onClick={() => handleOpenConfigure(integration)}
              actions={{
                Edit: () => handleOpenConfigure(integration),
              }}
            >
              {configured && <span className="tag">configured</span>}
            </List.Item>
          )
        })}
      </List>
    </>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Manage Integration"
      description={manifest.description}
    />
  )
}

export function Main({ integrations }) {
  return (
    <>
      <Scene compact={true} />
      <ConnectionScreen integrations={integrations} />
    </>
  )
}
