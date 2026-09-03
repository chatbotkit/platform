'use client'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import { useConfirmDanger } from '@/components/Confirm'
import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'

import useControlledState from '@/hooks/useControlledState'
import usePostMessageHandler from '@/hooks/usePostMessageHandler'

import manifest from './app.manifest'
import { revokeSecret } from './server'

import clsx from 'clsx'

export function ConnectionScreen({
  defaultSecrets: _defaultSecrets = [],
  secrets: _secrets,
  setSecrets: _setSecrets,
}) {
  const [secrets, setSecrets] = useControlledState(
    _defaultSecrets,
    _secrets,
    _setSecrets
  )

  const confirmDanger = useConfirmDanger()

  usePostMessageHandler(
    'oauth',
    ({ error_description, secretId }) => {
      if (error_description) {
        toast.error(error_description)

        return
      }

      if (secretId) {
        setSecrets((secrets) => {
          return secrets.map((secret) => {
            if (secret.id === secretId) {
              secret = {
                ...secret,

                verification: {
                  status: 'authenticated',
                },
              }
            }

            return secret
          })
        })
      }
    },
    [setSecrets]
  )

  return (
    <List>
      {secrets.map(({ icon, id, name, description, verification }) => {
        return (
          <List.Item
            key={id}
            className="cursor-default"
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
                <span className="italic">A secret without description</span>
              )
            }
            focusable={false}
          >
            {verification.status === 'unauthenticated' ? (
              <button
                className="default-link text-sm"
                type="button"
                onClick={async () => {
                  window.open(
                    verification.action.url,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }}
              >
                Authenticate
              </button>
            ) : null}
            <div className="flex-1" />
            {verification.status === 'authenticated' ? (
              <button
                className="danger-link text-sm"
                type="button"
                onClick={async () => {
                  const confirmed = await confirmDanger(
                    `Are you sure you want to revoke the connection credentials for "${
                      name || id
                    }"? This action cannot be undone.`,
                    {
                      title: 'Revoke Connection',
                    }
                  )

                  if (!confirmed) {
                    return
                  }

                  const toastId = toast.loading('Revoking...', {})

                  try {
                    const result = await revokeSecret({ id })

                    if (!result) {
                      return throwUnprocessableEntity(
                        'Unexpected action result'
                      )
                    }

                    if ('error' in result) {
                      throw errorToErrorResponse(result.error)
                    }

                    setSecrets((secrets) => {
                      return secrets.map((secret) => {
                        if (secret.id === id) {
                          secret = {
                            ...secret,

                            verification: result,
                          }
                        }

                        return secret
                      })
                    })

                    toast.success('Connection credentials revoked!', {
                      id: toastId,
                    })
                  } catch (e) {
                    toast.error(e.message, { id: toastId })
                  }
                }}
              >
                Revoke
              </button>
            ) : null}
          </List.Item>
        )
      })}
    </List>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Manage Shared Connections"
      description={manifest.description}
    />
  )
}

export function Main({ secrets }) {
  // @todo periodically refresh the secrets list to ensure that we don't have
  // stale data - i.e. expired states, etc

  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* secret */}
      <ConnectionScreen defaultSecrets={secrets} />
    </>
  )
}
