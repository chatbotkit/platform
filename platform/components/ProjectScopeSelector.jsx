'use client'

import useProjectScope from '@/hooks/useProjectScope'
import useRouter from '@/hooks/useRouter'

import { Menu } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

/**
 * The project scope selector shown at the top of the dashboard sidebar.
 * Projects are blueprints; selecting one rescopes every scope-aware surface
 * below the ProjectScopeProvider. "All projects" clears the scope.
 */
export default function ProjectScopeSelector({ className }) {
  const { hydrated, projects, scope, setScope } = useProjectScope()

  const router = useRouter()

  if (!hydrated) {
    return null
  }

  function createProject() {
    router.push({
      pathname: '/new',
      query: {
        projectScope: 'true',
        returnTo: router.asPath || '/overview',
      },
    })
  }

  function editProject() {
    if (!scope?.id) {
      return
    }

    router.push(`/blueprints/${scope.id}`)
  }

  return (
    <Menu as="div" className={clsx('relative', className)}>
      <Menu.Button
        className={clsx(
          'w-full',
          'flex flex-row items-center gap-2',
          'px-3 py-2',
          'rounded-lg border',
          'text-sm text-left',
          scope
            ? 'font-semibold auto-border-gray-300 auto-bg-gray-50 auto-text-gray-950'
            : 'font-medium auto-border-gray-200'
        )}
      >
        <span
          className={clsx(
            'w-2 h-2 rounded-full shrink-0',
            scope ? 'auto-bg-gray-900' : 'auto-bg-gray-300'
          )}
        />
        <span className="truncate">{scope ? scope.name : 'All projects'}</span>
        <ChevronUpDownIcon className="ml-auto w-4 h-4 shrink-0 auto-text-gray-400" />
      </Menu.Button>
      <Menu.Items
        className={clsx(
          'absolute z-30 left-0 right-0 mt-1',
          // @note the panel itself never scrolls - it caps its height and hands
          // the overflow to the project list below, so that "All projects" and
          // the edit/new actions stay pinned either side of it
          'flex flex-col max-h-96 overflow-hidden',
          'rounded-lg border border-gray-200 dark:border-gray-800',
          'auto-bg-white shadow-lg',
          'focus:outline-none'
        )}
      >
        <div className="shrink-0 pt-1">
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm',
                  { 'auto-bg-gray-100': active },
                  !scope && 'font-semibold'
                )}
                onClick={() => setScope(null)}
              >
                All projects
              </button>
            )}
          </Menu.Item>
          {projects.length ? (
            <div className="my-1 border-t auto-border-gray-100" />
          ) : null}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-none no-scrollbar">
          {projects.map((project) => (
            <Menu.Item key={project.id}>
              {({ active }) => (
                <button
                  type="button"
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm truncate',
                    { 'auto-bg-gray-100': active },
                    scope?.id === project.id &&
                      'font-semibold auto-text-gray-950'
                  )}
                  onClick={() =>
                    setScope({
                      id: project.id,
                      name: project.name || 'Untitled',
                    })
                  }
                >
                  {project.name || 'Untitled'}
                </button>
              )}
            </Menu.Item>
          ))}
        </div>
        <div className="shrink-0 pb-1">
          <div className="my-1 border-t auto-border-gray-100" />
          {scope ? (
            <Menu.Item>
              {({ active }) => (
                <button
                  type="button"
                  className={clsx('w-full text-left px-3 py-2 text-sm', {
                    'auto-bg-gray-100': active,
                  })}
                  onClick={editProject}
                >
                  Edit project
                </button>
              )}
            </Menu.Item>
          ) : null}
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                className={clsx('w-full text-left px-3 py-2 text-sm', {
                  'auto-bg-gray-100': active,
                })}
                onClick={createProject}
              >
                New project
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  )
}
