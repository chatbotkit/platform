'use client'

import { useCallback, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import AutoTextarea from '@/components/AutoTextarea'
import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'

import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'

import manifest from './app.manifest'
import { APP_NAME } from './const'
import { createSpace, deleteSpace, updateSpace } from './server'

import clsx from 'clsx'

export function SpaceScreen({ space = {} }) {
  return (
    <div className="space-y-6">
      {/* name */}
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full"
            type="text"
            name="name"
            defaultValue={space.name}
            placeholder="Enter space name..."
            required
          />
        </div>
        <p className="input-description">The name of the space.</p>
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
            defaultValue={space.description}
            placeholder="Enter space description..."
            rows={4}
          />
        </div>
        <p className="input-description">
          A brief description of what this space is for.
        </p>
      </div>
    </div>
  )
}

export function SpaceList({ spaces: _spaces, setSpaces }) {
  const router = useRouter()

  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const openCreateSpaceScreen = useCallback(() => {
    openPopup(<SpaceScreen />, {
      title: 'Create Space',
      actions: {
        Create: {
          fn: async (props) => {
            if (!props.name || !props.name.trim()) {
              toast.error('Space name is required')

              return
            }

            closePopup()

            const toastId = toast.loading('Creating space...', {})

            const tempId = `temp-${Date.now()}`

            setSpaces((spaces) => [
              {
                id: tempId,
                name: props.name,
                description: props.description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              ...spaces,
            ])

            try {
              const result = await createSpace(props)

              if (!result) {
                return throwUnprocessableEntity('Unexpected action result')
              }

              if ('error' in result) {
                throw errorToErrorResponse(result.error)
              }

              setSpaces((spaces) =>
                spaces.map((space) =>
                  space.id === tempId
                    ? {
                        ...space,

                        id: result.id,
                      }
                    : space
                )
              )

              toast.success('Space created!', { id: toastId })

              router.push(`/apps/${APP_NAME}/${result.id}`)
            } catch (e) {
              setSpaces((spaces) =>
                spaces.filter((space) => space.id !== tempId)
              )

              toast.error(e.message, { id: toastId })
            }
          },

          default: true,
        },
      },
    })
  }, [closePopup, openPopup, router, setSpaces])

  const openEditSpaceScreen = useCallback(
    (space) => {
      openPopup(<SpaceScreen space={space} />, {
        title: 'Edit Space',
        actions: {
          Save: {
            fn: async (props) => {
              if (!props.name || !props.name.trim()) {
                toast.error('Space name is required')

                return
              }

              closePopup()

              const toastId = toast.loading('Updating space...', {})

              const previousSpaces = _spaces

              setSpaces((spaces) =>
                spaces.map((s) =>
                  s.id === space.id
                    ? {
                        ...s,
                        name: props.name,
                        description: props.description,
                        updatedAt: new Date().toISOString(),
                      }
                    : s
                )
              )

              try {
                const result = await updateSpace({
                  id: space.id,
                  name: props.name,
                  description: props.description,
                })

                if (!result) {
                  return throwUnprocessableEntity('Unexpected action result')
                }

                if ('error' in result) {
                  throw errorToErrorResponse(result.error)
                }

                toast.success('Space updated!', { id: toastId })
              } catch (e) {
                setSpaces(previousSpaces)

                toast.error(e.message, { id: toastId })
              }
            },

            default: true,
          },
        },
      })
    },
    [closePopup, openPopup, setSpaces, _spaces]
  )

  return (
    <>
      {popup}
      <div className="flex flex-col gap-2">
        {_spaces.length ? (
          <List
            actions={
              <>
                <button
                  className="primary-button small"
                  type="button"
                  onClick={openCreateSpaceScreen}
                >
                  Add Space
                </button>
              </>
            }
          >
            {_spaces.map(({ id, name, description, updatedAt }) => {
              return (
                <List.Item
                  key={id}
                  className="cursor-pointer"
                  link={`/apps/${APP_NAME}/${id}`}
                  title={name || 'Untitled Space'}
                  body={
                    <div className="line-clamp-2">
                      {description || 'No description'}
                    </div>
                  }
                  timestamp={updatedAt}
                  actions={{
                    Edit: () =>
                      openEditSpaceScreen({
                        id,
                        name,
                        description,
                      }),

                    Files: () => router.push(`/apps/${APP_NAME}/${id}`),

                    Delete: async () => {
                      if (
                        !(await confirmDelete(
                          'Are you sure you want to delete this space?'
                        ))
                      ) {
                        return
                      }

                      const toastId = toast.loading('Deleting space...', {})

                      const previousSpaces = _spaces

                      setSpaces(
                        previousSpaces.filter((space) => space.id !== id)
                      )

                      try {
                        const result = await deleteSpace({ id })

                        if (!result) {
                          return throwUnprocessableEntity(
                            'Unexpected action result'
                          )
                        }

                        if ('error' in result) {
                          throw errorToErrorResponse(result.error)
                        }

                        toast.success('Space deleted!', { id: toastId })
                      } catch (e) {
                        setSpaces(previousSpaces)

                        toast.error(e.message, { id: toastId })
                      }
                    },
                  }}
                />
              )
            })}
          </List>
        ) : null}
        {_spaces.length === 0 ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => openCreateSpaceScreen()}
          >
            Add Space
          </button>
        ) : null}
      </div>
    </>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Manage Your Spaces"
      description={manifest.description}
    />
  )
}

export function Main({ spaces: _spaces }) {
  const [spaces, setSpaces] = useState(_spaces)

  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* spaces */}
      <SpaceList spaces={spaces} setSpaces={setSpaces} />
    </>
  )
}
