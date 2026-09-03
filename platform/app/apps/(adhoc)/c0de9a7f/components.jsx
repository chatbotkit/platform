'use client'

import { useEffect, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import toast from '@/lib/toast'

import { AppNavExtra, AppScene, useApp } from '@/layouts/App'

import AutoTextarea from '@/components/AutoTextarea'
import { useConfirmDelete } from '@/components/Confirm'
import Initials from '@/components/Initials'
import Link from '@/components/Link'

import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'

import { APP_NAME } from './const'
import { createFactory, deleteFactory, updateFactory } from './server'

import clsx from 'clsx'
import { Plus } from 'lucide-react'

function unwrap(result) {
  if (!result) {
    throw new Error('Unexpected action result')
  }

  if ('error' in result) {
    throw errorToErrorResponse(result.error)
  }

  return result
}

function initialsOf(name) {
  return (name || 'Factory')
    .split(/\s+/g)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function FactoryFields({ factory }) {
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
            placeholder="Acme org ops"
            defaultValue={factory?.name || ''}
            required
          />
        </div>
        <p className="input-description">
          A factory is a self-contained agent + GitHub connection + tasks for one
          job or organisation.
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
            rows={3}
            placeholder="What this factory is responsible for…"
            defaultValue={factory?.description || ''}
          />
        </div>
        <p className="input-description">
          A short note on what this factory does. Shown on its card.
        </p>
      </div>
    </div>
  )
}

function CreateFactoryCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group text-left',
        'flex items-center gap-4',
        'overflow-hidden rounded-xl',
        'border border-dashed auto-border-gray-200 hover:auto-border-gray-300',
        'auto-bg-gray-50 hover:auto-bg-white',
        'transition-all duration-200'
      )}
    >
      <div className="flex shrink-0 items-center justify-center p-4 pr-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl auto-bg-gray-100 auto-text-gray-500">
          <Plus className="h-5 w-5" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-4 pr-4">
        <h3 className="text-sm font-medium auto-text-gray-900">
          Create factory
        </h3>
        <p className="line-clamp-1 text-xs auto-text-gray-500">
          Spin up a new agent for a GitHub organisation.
        </p>
      </div>
    </button>
  )
}

function FactoryCard({ factory, onEdit, onDelete }) {
  return (
    <div
      className={clsx(
        'relative group',
        'flex items-center gap-4',
        'overflow-hidden rounded-xl',
        'border auto-border-gray-200 hover:auto-border-gray-300',
        'auto-bg-gray-50 hover:auto-bg-white',
        'hover:shadow-md',
        'transition-all ease-in-out duration-200'
      )}
    >
      <div className="flex shrink-0 items-center justify-center p-4 pr-0">
        <Initials
          className="h-10 w-10 rounded-xl auto-bg-gray-100 auto-text-gray-700"
          initials={initialsOf(factory.name)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-4 pr-4">
        <h3 className="line-clamp-1 text-sm font-medium auto-text-gray-900">
          <Link href={`/apps/${APP_NAME}/${factory.factory}`}>
            <span aria-hidden="true" className="absolute inset-0" />
            {factory.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-xs auto-text-gray-500">
          {factory.description || 'Self-provisioning GitHub agent'}
        </p>
      </div>
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          type="button"
          className="text-xs auto-text-gray-500 hover:auto-text-gray-800"
          onClick={() => onEdit(factory)}
        >
          Edit
        </button>
        <button
          type="button"
          className="danger-link text-xs"
          onClick={() => onDelete(factory)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Factories"
      description="Each factory is a self-provisioning agent for a GitHub organisation, driven by tasks. Create as many as you need."
    />
  )
}

export function FactoriesMain({ factories: _factories }) {
  const router = useRouter()

  const { setSidebarItems } = useApp()

  const [factories, setFactories] = useState(_factories)

  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  useEffect(() => {
    setSidebarItems([])
  }, [setSidebarItems])

  const openCreate = () => {
    openPopup(<FactoryFields />, {
      title: 'New factory',
      actions: {
        'Create factory': {
          fn: async (props) => {
            const name = (props?.name || '').trim()
            const description = (props?.description || '').trim()

            if (!name) {
              toast.error('Name your factory')

              return
            }

            closePopup()

            const toastId = toast.loading('Creating factory...', {})

            try {
              const res = unwrap(await createFactory({ name, description }))

              toast.success('Factory created', { id: toastId })

              router.push(`/apps/${APP_NAME}/${res.factory}`)
            } catch (e) {
              toast.error(e.message, { id: toastId })
            }
          },
        },
      },
    })
  }

  const edit = (f) => {
    openPopup(<FactoryFields factory={f} />, {
      title: 'Edit factory',
      actions: {
        Save: {
          fn: async (props) => {
            const name = (props?.name || '').trim()
            const description = (props?.description || '').trim()

            if (!name) {
              toast.error('Name your factory')

              return
            }

            closePopup()

            try {
              unwrap(
                await updateFactory({ factory: f.factory, name, description })
              )

              setFactories((list) =>
                list.map((x) =>
                  x.factory === f.factory ? { ...x, name, description } : x
                )
              )
            } catch (e) {
              toast.error(e.message)
            }
          },
        },
      },
    })
  }

  const remove = async (f) => {
    const ok = await confirmDelete(
      `Delete factory "${f.name}"? This removes its agent, tasks and workspace. This cannot be undone.`,
      { title: 'Delete factory' }
    )

    if (!ok) {
      return
    }

    try {
      unwrap(await deleteFactory({ factory: f.factory }))

      setFactories((list) => list.filter((x) => x.factory !== f.factory))
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <>
      <Scene compact={true} />

      <AppNavExtra>
        <button type="button" className="primary-button" onClick={openCreate}>
          New factory
        </button>
      </AppNavExtra>

      {popup}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CreateFactoryCard onClick={openCreate} />
        {factories.map((f) => (
          <FactoryCard
            key={f.factory}
            factory={f}
            onEdit={edit}
            onDelete={remove}
          />
        ))}
      </div>
    </>
  )
}
