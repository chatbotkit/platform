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

import manifest from './app.manifest'
import { createMemory, deleteMemory, updateMemory } from './server'

import clsx from 'clsx'

export function MemoryScreen({ memory = {} }) {
  return (
    <div className="space-y-6">
      {/* text */}
      <div>
        <label className="default-label" htmlFor="text">
          Memory
        </label>
        <div className="mt-1">
          <AutoTextarea
            className="default-input w-full"
            name="text"
            defaultValue={memory.text}
            placeholder="Enter memory content..."
            rows={6}
            required
          />
        </div>
        <p className="input-description">The content of the memory.</p>
      </div>
    </div>
  )
}

export function MemoryList({ memories: _memories, setMemories }) {
  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const openCreateMemoryScreen = useCallback(() => {
    openPopup(<MemoryScreen />, {
      title: 'Create Memory',
      actions: {
        Create: {
          fn: async (props) => {
            if (!props.text || !props.text.trim()) {
              toast.error('Memory text is required')

              return
            }

            closePopup()

            const toastId = toast.loading('Creating memory...', {})

            const tempId = `temp-${Date.now()}`

            setMemories((memories) => [
              {
                id: tempId,
                text: props.text,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              ...memories,
            ])

            try {
              const result = await createMemory(props)

              if (!result) {
                return throwUnprocessableEntity('Unexpected action result')
              }

              if ('error' in result) {
                throw errorToErrorResponse(result.error)
              }

              setMemories((memories) =>
                memories.map((memory) =>
                  memory.id === tempId
                    ? {
                        ...memory,

                        id: result.id,
                      }
                    : memory
                )
              )

              toast.success('Memory created!', { id: toastId })
            } catch (e) {
              setMemories((memories) =>
                memories.filter((memory) => memory.id !== tempId)
              )

              toast.error(e.message, { id: toastId })
            }
          },

          default: true,
        },
      },
    })
  }, [closePopup, openPopup, setMemories])

  const openUpdateMemoryScreen = useCallback(
    (memory) => {
      openPopup(<MemoryScreen memory={memory} />, {
        title: 'Update Memory',
        actions: {
          Update: {
            fn: async (props) => {
              if (!props.text || !props.text.trim()) {
                toast.error('Memory text is required')

                return
              }

              closePopup()

              const toastId = toast.loading('Updating memory...', {})

              const previousMemories = [..._memories]

              setMemories((memories) =>
                memories.map((m) =>
                  m.id === memory.id ? { ...m, ...props } : m
                )
              )

              try {
                const result = await updateMemory({
                  id: memory.id,
                  ...props,
                })

                if (!result) {
                  return throwUnprocessableEntity('Unexpected action result')
                }

                if ('error' in result) {
                  throw errorToErrorResponse(result.error)
                }

                toast.success('Memory updated!', { id: toastId })
              } catch (e) {
                setMemories(previousMemories)

                toast.error(e.message, { id: toastId })
              }
            },

            default: true,
          },
        },
      })
    },
    [closePopup, openPopup, setMemories, _memories]
  )

  return (
    <>
      {popup}
      <div className="flex flex-col gap-2">
        {_memories.length ? (
          <List
            actions={
              <>
                <button
                  className="primary-button small"
                  type="button"
                  onClick={openCreateMemoryScreen}
                >
                  Add Memory
                </button>
              </>
            }
          >
            {_memories.map(({ id, text, updatedAt }) => {
              return (
                <List.Item
                  key={id}
                  className="cursor-pointer"
                  body={
                    <div className="line-clamp-2">{text || 'Empty memory'}</div>
                  }
                  timestamp={updatedAt}
                  onClick={() => openUpdateMemoryScreen({ id, text })}
                  actions={{
                    Edit: () => openUpdateMemoryScreen({ id, text }),

                    Delete: async () => {
                      if (
                        !(await confirmDelete(
                          'Are you sure you want to delete this memory?'
                        ))
                      ) {
                        return
                      }

                      const toastId = toast.loading('Deleting memory...', {})

                      const previousMemories = _memories

                      setMemories(
                        previousMemories.filter((memory) => memory.id !== id)
                      )

                      try {
                        const result = await deleteMemory({ id })

                        if (!result) {
                          return throwUnprocessableEntity(
                            'Unexpected action result'
                          )
                        }

                        if ('error' in result) {
                          throw errorToErrorResponse(result.error)
                        }

                        toast.success('Memory deleted!', { id: toastId })
                      } catch (e) {
                        setMemories(previousMemories)

                        toast.error(e.message, { id: toastId })
                      }
                    },
                  }}
                />
              )
            })}
          </List>
        ) : null}
        {_memories.length === 0 ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => openCreateMemoryScreen()}
          >
            Add Memory
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
      headline="Manage Your Memories"
      description={manifest.description}
    />
  )
}

export function Main({ memories: _memories }) {
  const [memories, setMemories] = useState(_memories)

  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* memories */}
      <MemoryList memories={memories} setMemories={setMemories} />
    </>
  )
}
