'use client'

import { useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import Toggle from '@/components/Toggle'

import useControlledState from '@/hooks/useControlledState'

import manifest from './app.manifest'
import { toggleTask } from './server'

import clsx from 'clsx'

export function TaskList({ tasks: _tasks, setTasks: _setTasks }) {
  const [tasks, setTasks] = useControlledState([], _tasks, _setTasks)

  return (
    <div className="flex flex-col gap-2">
      <List emptyMessage="No predefined tasks available. Configure tasks in the app settings.">
        {tasks.map(
          ({ id, name, description, schedule, icon, defaultSchedule }) => {
            return (
              <List.Item
                key={id}
                className="cursor-default"
                icon={
                  icon ? (
                    <DynamicIcon
                      className="rounded-full w-12 h-12"
                      icon={icon}
                    />
                  ) : null
                }
                title={name || id}
                body={
                  description || (
                    <span className="italic">A task without description</span>
                  )
                }
                timestamp={null}
                focusable={false}
              >
                <Toggle
                  checked={schedule !== 'never'}
                  setChecked={async (checked) => {
                    setTasks((tasks) =>
                      tasks.map((task) =>
                        task.id === id
                          ? {
                              ...task,
                              schedule: checked ? defaultSchedule : 'never',
                            }
                          : task
                      )
                    )

                    try {
                      const result = await toggleTask({
                        id,
                        enabled: checked,
                      })

                      if (!result) {
                        return throwUnprocessableEntity(
                          'Unexpected action result'
                        )
                      }

                      if ('error' in result) {
                        throw errorToErrorResponse(result.error)
                      }
                    } catch (e) {
                      toast.error(e.message)
                    }
                  }}
                />
              </List.Item>
            )
          }
        )}
      </List>
    </div>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Pilot"
      description={manifest.description}
    />
  )
}

export function Main({ tasks: _tasks }) {
  const [tasks, setTasks] = useState(_tasks)

  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* tasks */}
      <TaskList tasks={tasks} setTasks={setTasks} />
    </>
  )
}
