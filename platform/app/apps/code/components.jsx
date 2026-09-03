'use client'

import { useCallback, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import AutoTextarea from '@/components/AutoTextarea'
import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'
import RevealToken from '@/components/RevealToken'

import usePopup from '@/hooks/usePopup'

import manifest from './app.manifest'
import { createToken, deleteToken } from './server'

import clsx from 'clsx'

export function TokenScreen({ token = {} }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-2">
          <input
            className="default-input w-full"
            type="text"
            name="name"
            id="name"
            required
            defaultValue={token.name || ''}
            placeholder="My Coding Token"
          />
        </div>
      </div>
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-2">
          <AutoTextarea
            className="default-input"
            name="description"
            id="description"
            defaultValue={token.description || ''}
            placeholder="Optional description for this token..."
          />
        </div>
      </div>
    </div>
  )
}

export function TokenList({ tokens: _tokens, setTokens }) {
  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const openMintTokenScreen = useCallback(() => {
    openPopup(<TokenScreen />, {
      title: 'Mint Coding Token',
      actions: {
        Mint: {
          fn: async (props) => {
            if (!props.name || !props.name.trim()) {
              toast.error('Token name is required')

              return
            }

            closePopup()

            const toastId = toast.loading('Minting token...', {})

            const tempId = `temp-${Date.now()}`

            setTokens((tokens) => [
              {
                id: tempId,
                name: props.name,
                description: props.description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              ...tokens,
            ])

            try {
              const result = await createToken(props)

              if (!result) {
                return throwUnprocessableEntity('Unexpected action result')
              }

              if ('error' in result) {
                throw errorToErrorResponse(result.error)
              }

              setTokens((tokens) =>
                tokens.map((t) => (t.id === tempId ? result : t))
              )

              // Show the token to the user. It is only ever returned once.
              openPopup(
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your coding token has been minted. It is scoped to the
                    stateless <code>conversation/complete</code> endpoint. Copy
                    it now as it won&apos;t be shown again.
                  </p>
                  <div>
                    <label className="default-label" htmlFor="token">
                      Token
                    </label>
                    <div className="mt-2">
                      <RevealToken
                        className="default-input w-full"
                        name="token"
                        token={result.token}
                        readOnly
                      />
                    </div>
                  </div>
                </div>,
                {
                  title: 'Token Minted',
                  cancelButtonCaption: 'Close',
                  actions: {
                    'Copy Token': {
                      fn: async () => {
                        try {
                          await navigator.clipboard.writeText(result.token)

                          toast.success('Token copied to clipboard!')
                        } catch {
                          // @note clipboard API may be blocked by permissions policy

                          toast.error('Failed to copy to clipboard')
                        }
                      },

                      default: true,
                    },
                  },
                }
              )

              toast.success('Token minted!', { id: toastId })
            } catch (e) {
              setTokens((tokens) => tokens.filter((t) => t.id !== tempId))

              toast.error(e.message, { id: toastId })
            }
          },

          default: true,
        },
      },
    })
  }, [closePopup, openPopup, setTokens])

  const handleDeleteToken = useCallback(
    async (tokenId) => {
      if (!(await confirmDelete('Do you really want to revoke this token?'))) {
        return
      }

      const toastId = toast.loading('Revoking token...', {})

      const previousTokens = _tokens

      setTokens((tokens) => tokens.filter((token) => token.id !== tokenId))

      try {
        const result = await deleteToken({ tokenId })

        if (!result) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in result) {
          throw errorToErrorResponse(result.error)
        }

        toast.success('Token revoked!', { id: toastId })
      } catch (e) {
        setTokens(previousTokens)

        toast.error(e.message, { id: toastId })
      }
    },
    [_tokens, confirmDelete, setTokens]
  )

  return (
    <>
      {popup}
      <div className="space-y-6">
        <List
          actions={
            <button
              className="primary-button small"
              type="button"
              onClick={openMintTokenScreen}
            >
              Mint Coding Token
            </button>
          }
          emptyMessage="No coding tokens yet. Mint one to get started."
        >
          {_tokens.map(({ id, name, description, createdAt }) => {
            return (
              <List.Item
                key={id}
                title={name || 'Unnamed Token'}
                body={
                  <div className="line-clamp-2">
                    {description || <i>No description</i>}
                  </div>
                }
                timestamp={createdAt}
                actions={{
                  Revoke: () => handleDeleteToken(id),
                }}
              />
            )
          })}
        </List>
      </div>
    </>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      className={clsx('scene', className)}
      name={null}
      headline="Coding Tokens"
      description={manifest.description}
      {...props}
    />
  )
}

export function Main({ tokens: _tokens }) {
  const [tokens, setTokens] = useState(_tokens)

  return (
    <Scene compact={true}>
      <TokenList tokens={tokens} setTokens={setTokens} />
    </Scene>
  )
}
