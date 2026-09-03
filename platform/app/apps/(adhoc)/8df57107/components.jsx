'use client'

import { useCallback, useEffect } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene, useApp } from '@/layouts/App'

import AutoTextarea from '@/components/AutoTextarea'
import { useConfirmDelete } from '@/components/Confirm'
import List from '@/components/List'

import useControlledState from '@/hooks/useControlledState'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'

import manifest from './app.manifest'
import { APP_NAME } from './const'
import { createBlueprint, deleteBlueprint, updateBlueprint } from './server'

import clsx from 'clsx'

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Agents"
      description={manifest.description}
    />
  )
}

function Popup({ blueprint = {} }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full"
            name="name"
            defaultValue={blueprint.name}
            required
          />
        </div>
        <p className="input-description">
          The name of your customer support project.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <AutoTextarea
            className="default-input w-full"
            name="description"
            defaultValue={blueprint.description}
            rows={3}
          />
        </div>
        <p className="input-description">
          Describe the purpose of this customer support solution.
        </p>
      </div>
    </div>
  )
}

export function Main({ blueprints: _blueprints }) {
  const router = useRouter()

  const { setSidebarItems } = useApp()

  useEffect(() => {
    setSidebarItems([])
  }, [setSidebarItems])

  const confirmDelete = useConfirmDelete()

  const { popup, openPopup, closePopup } = usePopup()

  const [blueprints, setBlueprints] = useControlledState([], _blueprints)

  const openCreateBlueprintScreen = useCallback(() => {
    openPopup(<Popup />, {
      title: 'Create Project',
      actions: {
        Create: {
          fn: async (props) => {
            closePopup()

            const toastId = toast.loading('Creating project...', {})

            const tempId = `temp-${Date.now()}-${Math.random()}`

            setBlueprints((blueprints) => [
              ...blueprints,
              { ...props, id: tempId },
            ])

            try {
              const result = await createBlueprint(props)

              if (!result) {
                return throwUnprocessableEntity('Unexpected action result')
              }

              if ('error' in result) {
                throw errorToErrorResponse(result.error)
              }

              setBlueprints((blueprints) =>
                blueprints.map((b) => (b.id === tempId ? result : b))
              )

              toast.success('Project created!', { id: toastId })

              router.push(`/apps/${APP_NAME}/${result.id}`)
            } catch (e) {
              setBlueprints((blueprints) =>
                blueprints.filter((b) => b.id !== tempId)
              )
              toast.error(e.message, { id: toastId })
            }
          },
          default: true,
        },
      },
    })
  }, [closePopup, openPopup, router, setBlueprints])

  const openUpdateBlueprintScreen = useCallback(
    (blueprint) => {
      openPopup(<Popup blueprint={blueprint} />, {
        title: 'Edit Project',
        actions: {
          Update: {
            fn: async (props) => {
              closePopup()

              const toastId = toast.loading('Updating project...', {})

              try {
                const result = await updateBlueprint({
                  ...props,
                  id: blueprint.id,
                })

                if (!result) {
                  return throwUnprocessableEntity('Unexpected action result')
                }

                if ('error' in result) {
                  throw errorToErrorResponse(result.error)
                }

                setBlueprints((blueprints) =>
                  blueprints.map((b) =>
                    b.id === blueprint.id ? { ...b, ...result } : b
                  )
                )

                toast.success('Project updated!', { id: toastId })

                router.refresh()
              } catch (e) {
                toast.error(e.message, { id: toastId })
              }
            },
            default: true,
          },
        },
      })
    },
    [closePopup, openPopup, router, setBlueprints]
  )

  const handleDeleteBlueprint = useCallback(
    async (blueprint) => {
      if (
        !(await confirmDelete(
          'Are you sure you want to delete this project? All associated resources will also be deleted.'
        ))
      ) {
        return
      }

      const toastId = toast.loading('Deleting project...', {})

      try {
        const result = await deleteBlueprint({ id: blueprint.id })

        if (!result) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in result) {
          throw errorToErrorResponse(result.error)
        }

        setBlueprints((blueprints) =>
          blueprints.filter((b) => b.id !== blueprint.id)
        )

        toast.success('Project deleted!', { id: toastId })

        router.refresh()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    },
    [confirmDelete, router, setBlueprints]
  )

  return (
    <>
      {popup}
      <Scene compact={true} />
      <div className="flex flex-col gap-2">
        {blueprints.length > 0 ? (
          <List
            actions={
              <button
                className="primary-button small"
                type="button"
                onClick={openCreateBlueprintScreen}
              >
                Create Project
              </button>
            }
          >
            {blueprints.map((blueprint) => (
              <List.Item
                key={blueprint.id}
                className="cursor-pointer"
                link={`/apps/${APP_NAME}/${blueprint.id}`}
                title={blueprint.name || blueprint.id}
                body={
                  blueprint.description || (
                    <p className="italic">A project without description.</p>
                  )
                }
                timestamp={blueprint.updatedAt}
                actions={{
                  Edit: () => openUpdateBlueprintScreen(blueprint),
                  Delete: () => handleDeleteBlueprint(blueprint),
                }}
              />
            ))}
          </List>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              No projects yet. Create your first customer support AI project.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={openCreateBlueprintScreen}
            >
              Create First Project
            </button>
          </div>
        )}
      </div>
    </>
  )
}
