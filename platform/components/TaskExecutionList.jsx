'use client'

import { useCallback, useMemo, useRef } from 'react'

import { useConfirm } from '@/components/Confirm'
import ResourceList from '@/components/ResourceList'
import TimeAgo from '@/components/TimeAgo'

import useFetch from '@/hooks/useFetch'

export default function TaskExecutionList({
  taskId,

  kind = 'task execution',

  listRoute: _listRoute,
  exportRoute = null,

  filter = false,

  refreshInterval = 15_000,

  ...props
}) {
  const confirm = useConfirm()

  const apiRef = useRef(null)

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const listRoute = useMemo(() => {
    return _listRoute || `/api/v1/task/${taskId}/execution/list`
  }, [_listRoute, taskId])

  const nameMapper = useCallback((item) => {
    return item.name || item.id
  }, [])

  const descriptionMapper = useCallback((item) => {
    return (
      item.summary ||
      item.description ||
      'No summary is available for this task execution yet.'
    )
  }, [])

  const extraTags = useCallback((item) => {
    // @note a running execution with a `resumeAt` in the future is paused
    // (waiting out a usage-policy block or an agent-requested delay), not stuck.
    // Surface that instead of a bare "running" tag so the run reads correctly.
    const paused =
      item.status === 'running' &&
      item.resumeAt &&
      new Date(item.resumeAt).getTime() > Date.now()

    return (
      <>
        {paused ? (
          <div className="tag warning">
            paused · resumes <TimeAgo time={item.resumeAt} tooltip={false} />
          </div>
        ) : item.status ? (
          <div className="tag">{item.status}</div>
        ) : null}
        {item.outcome ? <div className="tag">{item.outcome}</div> : null}
      </>
    )
  }, [])

  const extraLinks = useCallback((item) => {
    return item.conversationId
      ? {
          Conversation: `/conversations/${item.conversationId}`,
        }
      : {}
  }, [])

  const extraButtons = useCallback(
    (item) => {
      if (item.status !== 'running') {
        return {}
      }

      return {
        Cancel: async () => {
          if (
            !(await confirm(
              'Are you sure you want to cancel this task execution?'
            ))
          ) {
            return
          }

          const { error } = await fetch(
            `/api/v1/task/${taskId}/execution/${item.id}/cancel`,
            {
              method: 'POST',
              data: {},
              successMessage: 'Task execution canceled.',
              failureMessage: 'Failed to cancel task execution.',
            }
          )

          if (!error) {
            apiRef.current?.reset?.()
          }
        },
      }
    },
    [confirm, fetch, taskId]
  )

  return (
    <ResourceList
      {...props}
      apiRef={apiRef}
      autoLoad={true}
      deleteRoute={null}
      descriptionMapper={descriptionMapper}
      exportRoute={exportRoute}
      extraButtons={extraButtons}
      extraLinks={extraLinks}
      extraTags={extraTags}
      filter={filter}
      instanceRoute={null}
      kind={kind}
      listRoute={listRoute}
      nameMapper={nameMapper}
      quickAccess={true}
      refreshInterval={refreshInterval}
    />
  )
}
