export const CAPTION_TASKS = 'Tasks'
export const CAPTION_TODAY = 'Today'
export const CAPTION_YESTERDAY = 'Yesterday'
export const CAPTION_LAST_7_DAYS = 'Last 7 days'
export const CAPTION_LAST_30_DAYS = 'Last 30 days'
export const CAPTION_OLDER = 'Older'

export const ALL_GROUPING_CAPTIONS = [
  CAPTION_TASKS,
  CAPTION_TODAY,
  CAPTION_YESTERDAY,
  CAPTION_LAST_7_DAYS,
  CAPTION_LAST_30_DAYS,
  CAPTION_OLDER,
]

export interface ConversationGroupItem {
  id: string

  name?: string

  createdAt?: number | string | Date

  taskId?: string | null

  task?: {
    id: string
    status?: string
    outcome?: string
  } | null
}

export interface ConversationGroup {
  title: string
  conversations: ConversationGroupItem[]
}

/**
 * Groups conversations by date into categories: Today, Yesterday, Last 7 days,
 * Last 30 days, and Older (beyond 30 days)
 */
export function groupConversationsByDate(
  conversations: ConversationGroupItem[]
): ConversationGroup[] {
  if (!Array.isArray(conversations)) {
    return []
  }

  const now = Date.now()

  const oneDayMs = 24 * 60 * 60 * 1000

  // calculate start of today in UTC to match test expectations

  const todayStart = new Date(now)

  todayStart.setUTCHours(0, 0, 0, 0)

  const todayStartMs = todayStart.getTime()

  const yesterdayStart = new Date(todayStart)

  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1)

  const yesterdayStartMs = yesterdayStart.getTime()

  const sevenDaysAgo = now - 7 * oneDayMs
  const thirtyDaysAgo = now - 30 * oneDayMs

  // group conversations by date category

  const groups: { [key: string]: ConversationGroupItem[] } = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: [],
    older: [],
  }

  for (const conversation of conversations) {
    // @note undefined createdAt defaults to current time for new conversations

    const createdAt =
      conversation.createdAt === undefined || conversation.createdAt === null
        ? now
        : typeof conversation.createdAt === 'number'
        ? conversation.createdAt
        : new Date(conversation.createdAt).getTime()

    if (createdAt >= todayStartMs) {
      groups.today.push(conversation)
    } else if (createdAt >= yesterdayStartMs) {
      groups.yesterday.push(conversation)
    } else if (createdAt >= sevenDaysAgo) {
      groups.last7Days.push(conversation)
    } else if (createdAt >= thirtyDaysAgo) {
      groups.last30Days.push(conversation)
    } else {
      groups.older.push(conversation)
    }
  }

  // build result array with only non-empty groups

  const result: ConversationGroup[] = []

  if (groups.today.length > 0) {
    result.push({
      title: CAPTION_TODAY,
      conversations: groups.today,
    })
  }

  if (groups.yesterday.length > 0) {
    result.push({
      title: CAPTION_YESTERDAY,
      conversations: groups.yesterday,
    })
  }

  if (groups.last7Days.length > 0) {
    result.push({
      title: CAPTION_LAST_7_DAYS,
      conversations: groups.last7Days,
    })
  }

  if (groups.last30Days.length > 0) {
    result.push({
      title: CAPTION_LAST_30_DAYS,
      conversations: groups.last30Days,
    })
  }

  if (groups.older.length > 0) {
    result.push({
      title: CAPTION_OLDER,
      conversations: groups.older,
    })
  }

  return result
}

/**
 * Groups conversations by tasks first, then by date.
 * Conversations with associated tasks appear in a "Tasks" section at the top,
 * followed by all other conversations grouped by recency.
 */
export function groupConversationsByTaskAndDate(
  conversations: ConversationGroupItem[]
): ConversationGroup[] {
  if (!Array.isArray(conversations)) {
    return []
  }

  // separate conversations with tasks from those without
  // @note support both taskId (legacy) and task object (new)

  const conversationsWithTasks = conversations.filter(
    (conv) =>
      (conv.taskId !== null && conv.taskId !== undefined) ||
      (conv.task !== null && conv.task !== undefined)
  )
  const conversationsWithoutTasks = conversations.filter(
    (conv) =>
      (conv.taskId === null || conv.taskId === undefined) &&
      (conv.task === null || conv.task === undefined)
  )

  const result: ConversationGroup[] = []

  // add tasks group first if there are any conversations with tasks
  // @note sort by status: running tasks first, then others by creation date

  if (conversationsWithTasks.length > 0) {
    const sortedTasks = [...conversationsWithTasks].sort((a, b) => {
      const aStatus = a.task?.status
      const bStatus = b.task?.status

      // running tasks always come first

      if (aStatus === 'running' && bStatus !== 'running') {
        return -1
      }

      if (aStatus !== 'running' && bStatus === 'running') {
        return 1
      }

      // if both running or both not running, sort by creation date (newest first)

      const aCreatedAt =
        a.createdAt === undefined || a.createdAt === null
          ? Date.now()
          : typeof a.createdAt === 'number'
          ? a.createdAt
          : new Date(a.createdAt).getTime()

      const bCreatedAt =
        b.createdAt === undefined || b.createdAt === null
          ? Date.now()
          : typeof b.createdAt === 'number'
          ? b.createdAt
          : new Date(b.createdAt).getTime()

      return bCreatedAt - aCreatedAt
    })

    result.push({
      title: CAPTION_TASKS,
      conversations: sortedTasks,
    })
  }

  // add date-grouped conversations for those without tasks

  const dateGroups = groupConversationsByDate(conversationsWithoutTasks)

  result.push(...dateGroups)

  return result
}
