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
import { createProject, deleteProject, updateProject } from './server'

import clsx from 'clsx'
import pluralize from 'pluralize'

export function ProjectScreen({ project = {} }) {
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
            defaultValue={project.name}
            placeholder="Enter project name..."
            required
          />
        </div>
        <p className="input-description">The name of the project.</p>
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
            defaultValue={project.description}
            placeholder="Enter project description..."
            rows={4}
          />
        </div>
        <p className="input-description">
          A brief description of what this media graph is for.
        </p>
      </div>
    </div>
  )
}

export function ProjectList({ projects: _projects, setProjects }) {
  const router = useRouter()

  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const openCreateProjectScreen = useCallback(() => {
    openPopup(<ProjectScreen />, {
      title: 'Create Project',
      actions: {
        Create: {
          fn: async (props) => {
            if (!props.name || !props.name.trim()) {
              toast.error('Project name is required')

              return
            }

            closePopup()

            const toastId = toast.loading('Creating project...', {})

            try {
              const result = await createProject(props)

              if (!result) {
                return throwUnprocessableEntity('Unexpected action result')
              }

              if ('error' in result) {
                throw errorToErrorResponse(result.error)
              }

              toast.success('Project created!', { id: toastId })

              router.push(`/apps/${APP_NAME}/${result.id}`)
            } catch (e) {
              toast.error(e.message, { id: toastId })
            }
          },

          default: true,
        },
      },
    })
  }, [closePopup, openPopup, router])

  const openEditProjectScreen = useCallback(
    (project) => {
      openPopup(<ProjectScreen project={project} />, {
        title: 'Edit Project',
        actions: {
          Save: {
            fn: async (props) => {
              if (!props.name || !props.name.trim()) {
                toast.error('Project name is required')

                return
              }

              closePopup()

              const toastId = toast.loading('Updating project...', {})

              const previousProjects = _projects

              setProjects((projects) =>
                projects.map((p) =>
                  p.id === project.id
                    ? {
                        ...p,
                        name: props.name,
                        description: props.description,
                        updatedAt: new Date().toISOString(),
                      }
                    : p
                )
              )

              try {
                const result = await updateProject({
                  id: project.id,
                  name: props.name,
                  description: props.description,
                })

                if (!result) {
                  return throwUnprocessableEntity('Unexpected action result')
                }

                if ('error' in result) {
                  throw errorToErrorResponse(result.error)
                }

                toast.success('Project updated!', { id: toastId })
              } catch (e) {
                setProjects(previousProjects)

                toast.error(e.message, { id: toastId })
              }
            },

            default: true,
          },
        },
      })
    },
    [closePopup, openPopup, setProjects, _projects]
  )

  return (
    <>
      {popup}
      <div className="flex flex-col gap-2">
        {_projects.length ? (
          <List
            actions={
              <>
                <button
                  className="primary-button small"
                  type="button"
                  onClick={openCreateProjectScreen}
                >
                  Add Project
                </button>
              </>
            }
          >
            {_projects.map(
              ({ id, name, description, nodeCount, updatedAt }) => {
                return (
                  <List.Item
                    key={id}
                    className="cursor-pointer"
                    link={`/apps/${APP_NAME}/${id}`}
                    title={name || 'Untitled Project'}
                    body={
                      <div className="line-clamp-2">
                        {description || 'No description'}
                      </div>
                    }
                    timestamp={updatedAt}
                    actions={{
                      Open: () => router.push(`/apps/${APP_NAME}/${id}`),

                      Edit: () =>
                        openEditProjectScreen({
                          id,
                          name,
                          description,
                        }),

                      Delete: async () => {
                        if (
                          !(await confirmDelete(
                            'Are you sure you want to delete this project?'
                          ))
                        ) {
                          return
                        }

                        const toastId = toast.loading(
                          'Deleting project...',
                          {}
                        )

                        const previousProjects = _projects

                        setProjects(
                          previousProjects.filter(
                            (project) => project.id !== id
                          )
                        )

                        try {
                          const result = await deleteProject({ id })

                          if (!result) {
                            return throwUnprocessableEntity(
                              'Unexpected action result'
                            )
                          }

                          if ('error' in result) {
                            throw errorToErrorResponse(result.error)
                          }

                          toast.success('Project deleted!', { id: toastId })
                        } catch (e) {
                          setProjects(previousProjects)

                          toast.error(e.message, { id: toastId })
                        }
                      },
                    }}
                  >
                    {typeof nodeCount === 'number' ? (
                      <span className="tag">
                        {pluralize('image', nodeCount, true)}
                      </span>
                    ) : null}
                  </List.Item>
                )
              }
            )}
          </List>
        ) : null}
        {_projects.length === 0 ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => openCreateProjectScreen()}
          >
            Add Project
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
      headline="Your Media Graphs"
      description={manifest.description}
    />
  )
}

export function Main({ projects: _projects }) {
  const [projects, setProjects] = useState(_projects)

  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* projects */}
      <ProjectList projects={projects} setProjects={setProjects} />
    </>
  )
}
