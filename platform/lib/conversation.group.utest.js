import {
  groupConversationsByDate,
  groupConversationsByTaskAndDate,
} from './conversation.group'

describe('groupConversationsByDate', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => 1705320000000)
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('should return empty array for invalid input', () => {
    expect(groupConversationsByDate(null)).toEqual([])
    expect(groupConversationsByDate(undefined)).toEqual([])
    expect(groupConversationsByDate('invalid')).toEqual([])
    expect(groupConversationsByDate({})).toEqual([])
  })

  it('should return empty array for empty conversations array', () => {
    expect(groupConversationsByDate([])).toEqual([])
  })

  it('should group conversations into Today category', () => {
    const todayMorning = new Date('2024-01-15T08:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv 1', createdAt: todayMorning },
      { id: '2', name: 'Conv 2', createdAt: 1705320000000 }, // Same day, noon
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [
        { id: '1', name: 'Conv 1', createdAt: todayMorning },
        { id: '2', name: 'Conv 2', createdAt: 1705320000000 },
      ],
    })
  })

  it('should group conversations into Yesterday category', () => {
    const yesterdayMorning = new Date('2024-01-14T08:00:00Z').getTime()
    const yesterdayEvening = new Date('2024-01-14T20:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv 1', createdAt: yesterdayMorning },
      { id: '2', name: 'Conv 2', createdAt: yesterdayEvening },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '1', name: 'Conv 1', createdAt: yesterdayMorning },
        { id: '2', name: 'Conv 2', createdAt: yesterdayEvening },
      ],
    })
  })

  it('should group conversations into Last 7 days category', () => {
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()
    const sixDaysAgo = new Date('2024-01-09T14:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv 1', createdAt: threeDaysAgo },
      { id: '2', name: 'Conv 2', createdAt: sixDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Last 7 days',
      conversations: [
        { id: '1', name: 'Conv 1', createdAt: threeDaysAgo },
        { id: '2', name: 'Conv 2', createdAt: sixDaysAgo },
      ],
    })
  })

  it('should group conversations into Last 30 days category', () => {
    const tenDaysAgo = new Date('2024-01-05T10:00:00Z').getTime()
    const twentyDaysAgo = new Date('2023-12-26T14:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv 1', createdAt: tenDaysAgo },
      { id: '2', name: 'Conv 2', createdAt: twentyDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Last 30 days',
      conversations: [
        { id: '1', name: 'Conv 1', createdAt: tenDaysAgo },
        { id: '2', name: 'Conv 2', createdAt: twentyDaysAgo },
      ],
    })
  })

  it('should group conversations across all categories including Older', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()
    const tenDaysAgo = new Date('2024-01-05T10:00:00Z').getTime()
    const fortyDaysAgo = new Date('2023-12-06T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today },
      { id: '2', name: 'Yesterday Conv', createdAt: yesterday },
      { id: '3', name: 'Recent Conv', createdAt: threeDaysAgo },
      { id: '4', name: 'Month Conv', createdAt: tenDaysAgo },
      { id: '5', name: 'Very Old Conv', createdAt: fortyDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [{ id: '1', name: 'Today Conv', createdAt: today }],
    })
    expect(result[1]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '2', name: 'Yesterday Conv', createdAt: yesterday },
      ],
    })
    expect(result[2]).toEqual({
      title: 'Last 7 days',
      conversations: [
        { id: '3', name: 'Recent Conv', createdAt: threeDaysAgo },
      ],
    })
    expect(result[3]).toEqual({
      title: 'Last 30 days',
      conversations: [{ id: '4', name: 'Month Conv', createdAt: tenDaysAgo }],
    })
    expect(result[4]).toEqual({
      title: 'Older',
      conversations: [
        { id: '5', name: 'Very Old Conv', createdAt: fortyDaysAgo },
      ],
    })
  })

  it('should group conversations across multiple categories including Yesterday', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()
    const tenDaysAgo = new Date('2024-01-05T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today },
      { id: '2', name: 'Yesterday Conv', createdAt: yesterday },
      { id: '3', name: 'Recent Conv', createdAt: threeDaysAgo },
      { id: '4', name: 'Older Conv', createdAt: tenDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [{ id: '1', name: 'Today Conv', createdAt: today }],
    })
    expect(result[1]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '2', name: 'Yesterday Conv', createdAt: yesterday },
      ],
    })
    expect(result[2]).toEqual({
      title: 'Last 7 days',
      conversations: [
        { id: '3', name: 'Recent Conv', createdAt: threeDaysAgo },
      ],
    })
    expect(result[3]).toEqual({
      title: 'Last 30 days',
      conversations: [{ id: '4', name: 'Older Conv', createdAt: tenDaysAgo }],
    })
  })

  it('should group conversations across multiple categories', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()
    const tenDaysAgo = new Date('2024-01-05T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today },
      { id: '2', name: 'Recent Conv', createdAt: threeDaysAgo },
      { id: '3', name: 'Older Conv', createdAt: tenDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [{ id: '1', name: 'Today Conv', createdAt: today }],
    })
    expect(result[1]).toEqual({
      title: 'Last 7 days',
      conversations: [
        { id: '2', name: 'Recent Conv', createdAt: threeDaysAgo },
      ],
    })
    expect(result[2]).toEqual({
      title: 'Last 30 days',
      conversations: [{ id: '3', name: 'Older Conv', createdAt: tenDaysAgo }],
    })
  })

  it('should group conversations into Older category', () => {
    const fortyDaysAgo = new Date('2023-12-06T10:00:00Z').getTime()
    const sixtyDaysAgo = new Date('2023-11-16T14:00:00Z').getTime()
    const oneYearAgo = new Date('2023-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv 1', createdAt: fortyDaysAgo },
      { id: '2', name: 'Conv 2', createdAt: sixtyDaysAgo },
      { id: '3', name: 'Conv 3', createdAt: oneYearAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Older',
      conversations: [
        { id: '1', name: 'Conv 1', createdAt: fortyDaysAgo },
        { id: '2', name: 'Conv 2', createdAt: sixtyDaysAgo },
        { id: '3', name: 'Conv 3', createdAt: oneYearAgo },
      ],
    })
  })

  it('should handle conversations older than 30 days (should be in Older group)', () => {
    const forttyDaysAgo = new Date('2023-12-06T10:00:00Z').getTime()
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today },
      { id: '2', name: 'Very Old Conv', createdAt: forttyDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [{ id: '1', name: 'Today Conv', createdAt: today }],
    })
    expect(result[1]).toEqual({
      title: 'Older',
      conversations: [
        { id: '2', name: 'Very Old Conv', createdAt: forttyDaysAgo },
      ],
    })
  })

  it('should handle different timestamp formats', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv 1', createdAt: today }, // number
      { id: '2', name: 'Conv 2', createdAt: '2024-01-15T11:00:00Z' }, // ISO string
      { id: '3', name: 'Conv 3', createdAt: new Date('2024-01-15T12:00:00Z') }, // Date object
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Today')
    expect(result[0].conversations).toHaveLength(3)
  })

  it('should handle conversations without name property', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', createdAt: today }, // no name property
      { id: '2', name: 'Conv 2', createdAt: today },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [
        { id: '1', createdAt: today },
        { id: '2', name: 'Conv 2', createdAt: today },
      ],
    })
  })

  it('should preserve order of conversations within groups', () => {
    const today1 = new Date('2024-01-15T08:00:00Z').getTime()
    const today2 = new Date('2024-01-15T10:00:00Z').getTime()
    const today3 = new Date('2024-01-15T12:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'First', createdAt: today1 },
      { id: '2', name: 'Second', createdAt: today2 },
      { id: '3', name: 'Third', createdAt: today3 },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result[0].conversations).toEqual([
      { id: '1', name: 'First', createdAt: today1 },
      { id: '2', name: 'Second', createdAt: today2 },
      { id: '3', name: 'Third', createdAt: today3 },
    ])
  })

  it('should handle edge case of exactly 1 day ago (start of yesterday)', () => {
    // Exactly at the start of yesterday (1 day ago from start of today)
    const startOfYesterday = new Date('2024-01-14T00:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Edge case', createdAt: startOfYesterday },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Yesterday')
  })

  it('should handle edge case of very late yesterday', () => {
    // Just before midnight (end of yesterday)
    const endOfYesterday = new Date('2024-01-14T23:59:59Z').getTime()

    const conversations = [
      { id: '1', name: 'Edge case', createdAt: endOfYesterday },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Yesterday')
  })

  it('should distinguish between yesterday and 2 days ago', () => {
    const yesterday = new Date('2024-01-14T12:00:00Z').getTime()
    const twoDaysAgo = new Date('2024-01-13T12:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Yesterday Conv', createdAt: yesterday },
      { id: '2', name: 'Two Days Ago Conv', createdAt: twoDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '1', name: 'Yesterday Conv', createdAt: yesterday },
      ],
    })
    expect(result[1]).toEqual({
      title: 'Last 7 days',
      conversations: [
        { id: '2', name: 'Two Days Ago Conv', createdAt: twoDaysAgo },
      ],
    })
  })

  it('should handle edge case of exactly 7 days ago', () => {
    // Exactly 7 days ago from reference time
    const exactlySevenDaysAgo = 1705320000000 - 7 * 24 * 60 * 60 * 1000

    const conversations = [
      { id: '1', name: 'Edge case', createdAt: exactlySevenDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Last 7 days')
  })

  it('should handle edge case of exactly 30 days ago', () => {
    // Exactly 30 days ago from reference time
    const exactlyThirtyDaysAgo = 1705320000000 - 30 * 24 * 60 * 60 * 1000

    const conversations = [
      { id: '1', name: 'Edge case', createdAt: exactlyThirtyDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Last 30 days')
  })

  it('should handle edge case of exactly 31 days ago (should be in Older)', () => {
    // Exactly 31 days ago from reference time - should be in Older group
    const exactlyThirtyOneDaysAgo = 1705320000000 - 31 * 24 * 60 * 60 * 1000

    const conversations = [
      { id: '1', name: 'Edge case', createdAt: exactlyThirtyOneDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Older')
  })

  it('should distinguish between 30 days ago and 31 days ago', () => {
    const exactlyThirtyDaysAgo = 1705320000000 - 30 * 24 * 60 * 60 * 1000
    const exactlyThirtyOneDaysAgo = 1705320000000 - 31 * 24 * 60 * 60 * 1000

    const conversations = [
      { id: '1', name: '30 Days Conv', createdAt: exactlyThirtyDaysAgo },
      { id: '2', name: '31 Days Conv', createdAt: exactlyThirtyOneDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: 'Last 30 days',
      conversations: [
        { id: '1', name: '30 Days Conv', createdAt: exactlyThirtyDaysAgo },
      ],
    })
    expect(result[1]).toEqual({
      title: 'Older',
      conversations: [
        { id: '2', name: '31 Days Conv', createdAt: exactlyThirtyOneDaysAgo },
      ],
    })
  })

  it('should handle timezone differences by using start of day', () => {
    // Test that "today" is determined by start of day in local timezone
    // regardless of the exact hour
    const veryEarlyToday = new Date('2024-01-15T00:00:01Z').getTime()
    const lateToday = new Date('2024-01-15T23:59:59Z').getTime()

    const conversations = [
      { id: '1', name: 'Early', createdAt: veryEarlyToday },
      { id: '2', name: 'Late', createdAt: lateToday },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Today')
    expect(result[0].conversations).toHaveLength(2)
  })

  it('should handle undefined createdAt by defaulting to current time', () => {
    const conversations = [
      { id: '1', name: 'No created date' }, // createdAt is undefined
      { id: '2', name: 'Null created date', createdAt: null }, // createdAt is null
      { id: '3', name: 'Today Conv', createdAt: 1705320000000 },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [
        { id: '1', name: 'No created date' },
        { id: '2', name: 'Null created date', createdAt: null },
        { id: '3', name: 'Today Conv', createdAt: 1705320000000 },
      ],
    })
  })

  it('should handle mixed conversations with some having undefined createdAt', () => {
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Current conv' }, // undefined createdAt - should go to Today
      { id: '2', name: 'Yesterday conv', createdAt: yesterday },
      { id: '3', name: 'Another current conv', createdAt: null }, // null createdAt - should go to Today
      { id: '4', name: 'Old conv', createdAt: threeDaysAgo },
    ]

    const result = groupConversationsByDate(conversations)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [
        { id: '1', name: 'Current conv' },
        { id: '3', name: 'Another current conv', createdAt: null },
      ],
    })
    expect(result[1]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '2', name: 'Yesterday conv', createdAt: yesterday },
      ],
    })
    expect(result[2]).toEqual({
      title: 'Last 7 days',
      conversations: [{ id: '4', name: 'Old conv', createdAt: threeDaysAgo }],
    })
  })
})

describe('groupConversationsByTaskAndDate', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => 1705320000000)
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it('should return empty array for invalid input', () => {
    expect(groupConversationsByTaskAndDate(null)).toEqual([])
    expect(groupConversationsByTaskAndDate(undefined)).toEqual([])
    expect(groupConversationsByTaskAndDate('invalid')).toEqual([])
    expect(groupConversationsByTaskAndDate({})).toEqual([])
  })

  it('should return empty array for empty conversations array', () => {
    expect(groupConversationsByTaskAndDate([])).toEqual([])
  })

  it('should group conversations with tasks in Tasks section', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Task Conv 1', createdAt: today, taskId: 'task-1' },
      { id: '2', name: 'Task Conv 2', createdAt: today, taskId: 'task-2' },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Tasks',
      conversations: [
        { id: '1', name: 'Task Conv 1', createdAt: today, taskId: 'task-1' },
        { id: '2', name: 'Task Conv 2', createdAt: today, taskId: 'task-2' },
      ],
    })
  })

  it('should group conversations without tasks by date', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today, taskId: null },
      { id: '2', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: 'Today',
      conversations: [
        { id: '1', name: 'Today Conv', createdAt: today, taskId: null },
      ],
    })
    expect(result[1]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '2', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
      ],
    })
  })

  it('should place Tasks section before date groups', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today, taskId: null },
      { id: '2', name: 'Task Conv', createdAt: yesterday, taskId: 'task-1' },
      { id: '3', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(3)
    expect(result[0].title).toBe('Tasks')
    expect(result[1].title).toBe('Today')
    expect(result[2].title).toBe('Yesterday')
  })

  it('should handle mixed conversations with tasks across different dates', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Task', createdAt: today, taskId: 'task-1' },
      { id: '2', name: 'Today Conv', createdAt: today, taskId: null },
      {
        id: '3',
        name: 'Yesterday Task',
        createdAt: yesterday,
        taskId: 'task-2',
      },
      { id: '4', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
      { id: '5', name: 'Old Task', createdAt: threeDaysAgo, taskId: 'task-3' },
      { id: '6', name: 'Old Conv', createdAt: threeDaysAgo, taskId: null },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(4)

    // Tasks section should be first with all task conversations
    expect(result[0]).toEqual({
      title: 'Tasks',
      conversations: [
        { id: '1', name: 'Today Task', createdAt: today, taskId: 'task-1' },
        {
          id: '3',
          name: 'Yesterday Task',
          createdAt: yesterday,
          taskId: 'task-2',
        },
        {
          id: '5',
          name: 'Old Task',
          createdAt: threeDaysAgo,
          taskId: 'task-3',
        },
      ],
    })

    // Date groups should only contain conversations without tasks
    expect(result[1]).toEqual({
      title: 'Today',
      conversations: [
        { id: '2', name: 'Today Conv', createdAt: today, taskId: null },
      ],
    })

    expect(result[2]).toEqual({
      title: 'Yesterday',
      conversations: [
        { id: '4', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
      ],
    })

    expect(result[3]).toEqual({
      title: 'Last 7 days',
      conversations: [
        { id: '6', name: 'Old Conv', createdAt: threeDaysAgo, taskId: null },
      ],
    })
  })

  it('should treat undefined taskId as no task', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Conv with undefined taskId', createdAt: today },
      {
        id: '2',
        name: 'Conv with null taskId',
        createdAt: today,
        taskId: null,
      },
      { id: '3', name: 'Conv with taskId', createdAt: today, taskId: 'task-1' },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(2)

    expect(result[0]).toEqual({
      title: 'Tasks',
      conversations: [
        {
          id: '3',
          name: 'Conv with taskId',
          createdAt: today,
          taskId: 'task-1',
        },
      ],
    })

    expect(result[1]).toEqual({
      title: 'Today',
      conversations: [
        { id: '1', name: 'Conv with undefined taskId', createdAt: today },
        {
          id: '2',
          name: 'Conv with null taskId',
          createdAt: today,
          taskId: null,
        },
      ],
    })
  })

  it('should preserve order of conversations within groups', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'First Task', createdAt: today, taskId: 'task-1' },
      { id: '2', name: 'Second Task', createdAt: today, taskId: 'task-2' },
      { id: '3', name: 'Third Task', createdAt: today, taskId: 'task-3' },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result[0].conversations).toEqual([
      { id: '1', name: 'First Task', createdAt: today, taskId: 'task-1' },
      { id: '2', name: 'Second Task', createdAt: today, taskId: 'task-2' },
      { id: '3', name: 'Third Task', createdAt: today, taskId: 'task-3' },
    ])
  })

  it('should only create Tasks group when there are conversations with tasks', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Today Conv', createdAt: today, taskId: null },
      { id: '2', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    // Should not have a Tasks group
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Today')
    expect(result[1].title).toBe('Yesterday')
  })

  it('should handle all conversations having tasks', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Task 1', createdAt: today, taskId: 'task-1' },
      { id: '2', name: 'Task 2', createdAt: yesterday, taskId: 'task-2' },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    // Should only have Tasks group
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'Tasks',
      conversations: [
        { id: '1', name: 'Task 1', createdAt: today, taskId: 'task-1' },
        { id: '2', name: 'Task 2', createdAt: yesterday, taskId: 'task-2' },
      ],
    })
  })

  it('should support task object field in addition to taskId', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()

    const conversations = [
      {
        id: '1',
        name: 'Task with object',
        createdAt: today,
        task: { id: 'task-1', status: 'idle', outcome: 'pending' },
      },
      {
        id: '2',
        name: 'Task with taskId',
        createdAt: today,
        taskId: 'task-2',
      },
      { id: '3', name: 'No task', createdAt: today, taskId: null },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      title: 'Tasks',
      conversations: [
        {
          id: '1',
          name: 'Task with object',
          createdAt: today,
          task: { id: 'task-1', status: 'idle', outcome: 'pending' },
        },
        {
          id: '2',
          name: 'Task with taskId',
          createdAt: today,
          taskId: 'task-2',
        },
      ],
    })
    expect(result[1]).toEqual({
      title: 'Today',
      conversations: [
        { id: '3', name: 'No task', createdAt: today, taskId: null },
      ],
    })
  })

  it('should sort running tasks to the top', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const twoDaysAgo = new Date('2024-01-13T10:00:00Z').getTime()

    const conversations = [
      {
        id: '1',
        name: 'Oldest idle task',
        createdAt: twoDaysAgo,
        task: { id: 'task-1', status: 'idle', outcome: 'pending' },
      },
      {
        id: '2',
        name: 'Running task (yesterday)',
        createdAt: yesterday,
        task: { id: 'task-2', status: 'running', outcome: 'pending' },
      },
      {
        id: '3',
        name: 'Recent idle task',
        createdAt: today,
        task: { id: 'task-3', status: 'idle', outcome: 'pending' },
      },
      {
        id: '4',
        name: 'Running task (today)',
        createdAt: today,
        task: { id: 'task-4', status: 'running', outcome: 'pending' },
      },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Tasks')

    // Running tasks should be first, sorted by date (newest first)
    // Then idle tasks, sorted by date (newest first)
    expect(result[0].conversations).toEqual([
      {
        id: '4',
        name: 'Running task (today)',
        createdAt: today,
        task: { id: 'task-4', status: 'running', outcome: 'pending' },
      },
      {
        id: '2',
        name: 'Running task (yesterday)',
        createdAt: yesterday,
        task: { id: 'task-2', status: 'running', outcome: 'pending' },
      },
      {
        id: '3',
        name: 'Recent idle task',
        createdAt: today,
        task: { id: 'task-3', status: 'idle', outcome: 'pending' },
      },
      {
        id: '1',
        name: 'Oldest idle task',
        createdAt: twoDaysAgo,
        task: { id: 'task-1', status: 'idle', outcome: 'pending' },
      },
    ])
  })

  it('should handle tasks with different outcomes but not running status', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const twoDaysAgo = new Date('2024-01-13T10:00:00Z').getTime()

    const conversations = [
      {
        id: '1',
        name: 'Failed task (oldest)',
        createdAt: twoDaysAgo,
        task: { id: 'task-1', status: 'idle', outcome: 'failure' },
      },
      {
        id: '2',
        name: 'Success task',
        createdAt: yesterday,
        task: { id: 'task-2', status: 'idle', outcome: 'success' },
      },
      {
        id: '3',
        name: 'Pending task (newest)',
        createdAt: today,
        task: { id: 'task-3', status: 'idle', outcome: 'pending' },
      },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Tasks')

    // All have idle status, so should be sorted by date (newest first)
    expect(result[0].conversations).toEqual([
      {
        id: '3',
        name: 'Pending task (newest)',
        createdAt: today,
        task: { id: 'task-3', status: 'idle', outcome: 'pending' },
      },
      {
        id: '2',
        name: 'Success task',
        createdAt: yesterday,
        task: { id: 'task-2', status: 'idle', outcome: 'success' },
      },
      {
        id: '1',
        name: 'Failed task (oldest)',
        createdAt: twoDaysAgo,
        task: { id: 'task-1', status: 'idle', outcome: 'failure' },
      },
    ])
  })

  it('should handle tasks without status field (legacy taskId)', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()

    const conversations = [
      {
        id: '1',
        name: 'Legacy task (oldest)',
        createdAt: yesterday,
        taskId: 'task-1',
      },
      {
        id: '2',
        name: 'Running task',
        createdAt: yesterday,
        task: { id: 'task-2', status: 'running', outcome: 'pending' },
      },
      {
        id: '3',
        name: 'Legacy task (newest)',
        createdAt: today,
        taskId: 'task-3',
      },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Tasks')

    // Running task should be first, then legacy tasks by date
    expect(result[0].conversations).toEqual([
      {
        id: '2',
        name: 'Running task',
        createdAt: yesterday,
        task: { id: 'task-2', status: 'running', outcome: 'pending' },
      },
      {
        id: '3',
        name: 'Legacy task (newest)',
        createdAt: today,
        taskId: 'task-3',
      },
      {
        id: '1',
        name: 'Legacy task (oldest)',
        createdAt: yesterday,
        taskId: 'task-1',
      },
    ])
  })

  it('should handle conversations spanning all date categories', () => {
    const today = new Date('2024-01-15T10:00:00Z').getTime()
    const yesterday = new Date('2024-01-14T10:00:00Z').getTime()
    const threeDaysAgo = new Date('2024-01-12T10:00:00Z').getTime()
    const tenDaysAgo = new Date('2024-01-05T10:00:00Z').getTime()
    const fortyDaysAgo = new Date('2023-12-06T10:00:00Z').getTime()

    const conversations = [
      { id: '1', name: 'Task Conv', createdAt: today, taskId: 'task-1' },
      { id: '2', name: 'Today Conv', createdAt: today, taskId: null },
      { id: '3', name: 'Yesterday Conv', createdAt: yesterday, taskId: null },
      { id: '4', name: 'Recent Conv', createdAt: threeDaysAgo, taskId: null },
      { id: '5', name: 'Month Conv', createdAt: tenDaysAgo, taskId: null },
      { id: '6', name: 'Old Conv', createdAt: fortyDaysAgo, taskId: null },
    ]

    const result = groupConversationsByTaskAndDate(conversations)

    expect(result).toHaveLength(6)
    expect(result[0].title).toBe('Tasks')
    expect(result[1].title).toBe('Today')
    expect(result[2].title).toBe('Yesterday')
    expect(result[3].title).toBe('Last 7 days')
    expect(result[4].title).toBe('Last 30 days')
    expect(result[5].title).toBe('Older')
  })
})
