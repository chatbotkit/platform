import type {
  PublishChannelMessageOptions,
  StreamChannelEventsOptions,
} from '@/lib/channel.user'
import { publishChannelMessage, streamChannelEvents } from '@/lib/channel.user'
import {
  createSinkEvent,
  type EngineSinkEvent,
  type EngineSinkItem,
  type Sink,
  TAG_ERROR,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
} from '@/lib/conversation.tag'
import { captureError } from '@/lib/error'

// --- Constants ---

export const TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH = 1000
export const TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS = 60 * 60

// --- Types & Interfaces ---

export type TaskWorkflowEvent = Extract<
  EngineSinkEvent,
  {
    type:
      | typeof TAG_OPERATION_BEGIN
      | typeof TAG_OPERATION_END
      | typeof TAG_ERROR
  }
>

export type TaskWorkflowEventStream = {
  push: (event: TaskWorkflowEvent) => Promise<void>
  abortSignal: AbortSignal
}

type TaskWorkflowChannelMessage = Record<string, unknown>

type TaskWorkflowStreamOptions = Omit<StreamChannelEventsOptions, 'abortSignal'>

// --- Helpers ---

function getTaskWorkflowChannelName(taskId: string): string {
  return `task[${taskId}]:workflow`
}

function isTaskWorkflowEvent(item: EngineSinkEvent): item is TaskWorkflowEvent {
  return (
    item.type === TAG_OPERATION_BEGIN ||
    item.type === TAG_OPERATION_END ||
    item.type === TAG_ERROR
  )
}

export function getTaskWorkflowHistoryOptions(): PublishChannelMessageOptions {
  return {
    historyLength: TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
    historyExpireSeconds: TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS,
  }
}

export async function publishTaskWorkflowEvent(
  userId: string,
  taskId: string,
  event: TaskWorkflowEvent,
  options: PublishChannelMessageOptions = getTaskWorkflowHistoryOptions()
): Promise<void> {
  await publishChannelMessage(
    userId,
    getTaskWorkflowChannelName(taskId),
    event as unknown as TaskWorkflowChannelMessage,
    options
  )
}

export async function* streamTaskWorkflowEvents(
  userId: string,
  taskId: string,
  options?: StreamChannelEventsOptions
) {
  yield* streamChannelEvents(
    userId,
    getTaskWorkflowChannelName(taskId),
    options
  )
}

// --- Main ---

export function createTaskWorkflowOperationSink({
  userId,
  taskId,
}: {
  userId: string
  taskId: string
}): Sink {
  const push = (async (...[type, data]) => {
    const event = createSinkEvent(
      {
        type,
        data,
      } as EngineSinkItem
    )

    if (!isTaskWorkflowEvent(event)) {
      return event
    }

    try {
      await publishTaskWorkflowEvent(userId, taskId, event)
    } catch (e) {
      await captureError(e)
    }

    return event
  }) as Sink['push']

  return {
    push,
  }
}

export async function pipeTaskWorkflowEventsToStream(
  userId: string,
  taskId: string,
  stream: TaskWorkflowEventStream,
  options?: TaskWorkflowStreamOptions
): Promise<void> {
  for await (const event of streamTaskWorkflowEvents(userId, taskId, {
    ...options,
    abortSignal: stream.abortSignal,
  })) {
    switch (event.type) {
      case 'message': {
        const taskWorkflowEvent = event.data as unknown as TaskWorkflowEvent

        await stream.push(taskWorkflowEvent)

        break
      }
    }
  }
}
