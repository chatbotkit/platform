import { PLATFORM_LIMITS } from '@/config/execution'

import {
  bot,
  createPackTemplate,
  createTaskCreateTemplate,
  createTaskDeleteTemplate,
  createTaskFetchTemplate,
  createTaskListTemplate,
  createTaskRunTemplate,
  createTaskUpdateTemplate,
  field,
  object,
} from '@/lib/ability.template'

/**
 * Optional per-task execution limits, shared by the create/update abilities so a
 * bot can bound the tasks it commissions - e.g. give an orchestrator more than
 * the 15-minute default while it supervises sub-tasks. Values are clamped to
 * platform bounds when the task is written.
 */
const executionLimitFields = () => ({
  maxIterations: field({
    name: 'maxIterations',
    description:
      'optional max reasoning iterations per run (clamped 10–100000; default 1000)',
    type: 'number',
    optional: true,
    min: PLATFORM_LIMITS.minIterations,
    max: PLATFORM_LIMITS.maxIterations,
  }),
  maxTime: field({
    name: 'maxTime',
    description:
      'optional max run time as a duration like "1 day" or "30 minutes" (or milliseconds); clamped 15 minutes–1 day; default 15 minutes',
    type: 'string',
    optional: true,
  }),
  sessionDuration: field({
    name: 'sessionDuration',
    description:
      'optional session duration controlling conversation reuse across runs, like "1 hour" (or milliseconds); 0 = fresh conversation each run',
    type: 'string',
    optional: true,
  }),
})

/**
 * Catalogue of ChatBotKit task abilities.
 */
const abilities = {
  // @note the context of these is all tasks within the ChatBotKit account

  'task/list': createTaskListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Tasks',
    description: 'List scheduled and one-time tasks',
    tags: ['task', 'list', 'beta'],
    commentary: `Lists all tasks belonging to the connected bot across the entire
account. Tasks can be filtered by metadata. Use this when the bot should only
see its own tasks without needing to specify a bot ID.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'task/list[by-bot-id]': createTaskListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Tasks',
    description: 'List scheduled and one-time tasks',
    tags: ['task', 'list', 'beta'],
    commentary: `Lists tasks across the account with an optional bot ID filter. The
bot can query tasks for any bot it has access to, or omit the bot ID to list
all account tasks. Use this when the bot needs to browse tasks across multiple
bots.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
  }),

  'task/create': createTaskCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Task',
    description: 'Create a task using details provided',
    tags: ['task', 'create', 'beta'],
    commentary: `Creates a new task assigned to the connected bot. The task can run
immediately with the "now" schedule, at a specific date-time, or on a recurring
cron-like schedule. Use this when the bot should create tasks for itself.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      name: field({
        name: 'name',
        description: 'the name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'a detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description: 'optional metadata to store on the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'task/create[by-bot-id]': createTaskCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Task',
    description: 'Create a task using details provided',
    tags: ['task', 'create', 'beta'],
    commentary: `Creates a new task with an optional bot ID to assign it to a specific
bot. If no bot ID is provided, the connected bot or context bot is used.
Use this when the bot needs to create tasks for other bots while still keeping
the task assigned to a valid bot.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to assign',
        optional: true,
      }),
      name: field({
        name: 'name',
        description: 'the name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'a detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description: 'optional metadata to store on the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
  }),

  'task/fetch': createTaskFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Task',
    description: 'Fetch details of a specific task',
    tags: ['task', 'fetch', 'beta'],
    commentary: `Fetches the full details of a task by ID, scoped to the connected bot.
Returns the task name, description, schedule, metadata, and current status. Use
this when the bot needs to inspect one of its own tasks.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to fetch',
      }),
    },
    bot: '#bot',
  }),

  'task/fetch[by-bot-id]': createTaskFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Task',
    description: 'Fetch details of a specific task',
    tags: ['task', 'fetch', 'beta'],
    commentary: `Fetches the full details of a task by ID with an optional bot scope.
The bot can look up any task in the account, optionally narrowing by bot ID.
Use this when the bot needs to inspect tasks that may belong to other bots.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to fetch',
      }),
    },
  }),

  'task/update': createTaskUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Task',
    description: 'Update an existing task or to-do item',
    tags: ['task', 'update', 'beta'],
    commentary: `Updates an existing task belonging to the connected bot. Any
combination of name, description, schedule, and metadata can be changed.
Metadata updates are merged with the existing values rather than replacing them.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to update',
      }),
      name: field({
        name: 'name',
        description: 'the updated name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'an updated detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to merge into the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'task/update[by-bot-id]': createTaskUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Task',
    description: 'Update an existing task or to-do item',
    tags: ['task', 'update', 'beta'],
    commentary: `Updates an existing task with an optional bot scope. The bot can
modify tasks across the account, optionally narrowing by bot ID. Metadata
updates are merged with existing values rather than replacing them.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to update',
      }),
      name: field({
        name: 'name',
        description: 'the updated name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'an updated detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to merge into the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
  }),

  'task/delete': createTaskDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Task',
    description: 'Delete an existing task',
    tags: ['task', 'delete', 'beta'],
    commentary: `Permanently deletes a task belonging to the connected bot. This
cannot be undone. Any scheduled runs for the task will be cancelled.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to delete',
      }),
    },
    bot: '#bot',
  }),

  'task/delete[by-bot-id]': createTaskDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Task',
    description: 'Delete an existing task',
    tags: ['task', 'delete', 'beta'],
    commentary: `Permanently deletes a task with an optional bot scope. The bot can
remove tasks across the account, optionally narrowing by bot ID. This cannot be
undone and any scheduled runs will be cancelled.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to delete',
      }),
    },
  }),

  'task/run': createTaskRunTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Run Task',
    description: 'Perform a single run of a task using the provided task ID',
    tags: ['task', 'run', 'beta'],
    commentary: `Triggers a single execution of a task belonging to the connected bot.
This runs the task immediately regardless of its schedule. Useful for on-demand
execution or retrying a failed run.`,
    instruction: {
      '@scope': 'user',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to run',
      }),
    },
    bot: '#bot',
  }),

  'task/run[by-bot-id]': createTaskRunTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Run Task',
    description: 'Perform a single run of a task using the provided task ID',
    tags: ['task', 'run', 'beta'],
    commentary: `Triggers a single execution of a task with an optional bot scope. The
bot can run tasks across the account, optionally narrowing by bot ID. This runs
the task immediately regardless of its schedule.`,
    instruction: {
      '@scope': 'user',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to run',
      }),
    },
  }),

  // @note the context of these is all tasks associated with a specific contact

  'task/list[contact]': createTaskListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Tasks',
    description: 'List scheduled and one-time tasks',
    tags: ['task', 'list', 'contact', 'beta'],
    commentary: `Lists tasks belonging to the current contact and connected bot. Only
tasks associated with the person in the conversation are visible. Use this for
personal task management where each contact has their own private tasks.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'task/list[contact][by-bot-id]': createTaskListTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'List Tasks',
    description: 'List scheduled and one-time tasks',
    tags: ['task', 'list', 'contact', 'beta'],
    commentary: `Lists tasks belonging to the current contact with an optional bot ID
filter. Only tasks for the person in the conversation are visible. Use this
when a contact needs to see tasks across different bots.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      meta: object({
        name: 'meta',
        description:
          'optional metadata filter as a JSON object of exact key-value matches',
        optional: true,
        shape: {},
      }),
    },
  }),

  'task/fetch[contact]': createTaskFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Task',
    description: 'Fetch details of a specific task',
    tags: ['task', 'fetch', 'contact', 'beta'],
    commentary: `Fetches the full details of a contact's task by ID, scoped to the
connected bot. Only tasks belonging to the current contact are accessible.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to fetch',
      }),
    },
    bot: '#bot',
  }),

  'task/fetch[contact][by-bot-id]': createTaskFetchTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Fetch Task',
    description: 'Fetch details of a specific task',
    tags: ['task', 'fetch', 'contact', 'beta'],
    commentary: `Fetches the full details of a contact's task by ID with an optional
bot scope. Only tasks belonging to the current contact are accessible.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to fetch',
      }),
    },
  }),

  'task/create[contact]': createTaskCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Task',
    description: 'Create a task using details provided',
    tags: ['task', 'create', 'contact', 'beta'],
    commentary: `Creates a task for the current contact, assigned to the connected bot.
The task is private to this contact and will not appear for others. Supports
immediate execution with "now", one-time scheduling, and recurring schedules.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      name: field({
        name: 'name',
        description: 'the name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'a detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description: 'optional metadata to store on the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'task/create[contact][by-bot-id]': createTaskCreateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Create Task',
    description: 'Create a task using details provided',
    tags: ['task', 'create', 'contact', 'beta'],
    commentary: `Creates a task for the current contact with an optional bot ID
assignment. The task is private to this contact. Use this when a contact needs
to create tasks that may be handled by different bots.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to assign',
        optional: true,
      }),
      name: field({
        name: 'name',
        description: 'the name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'a detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description: 'optional metadata to store on the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
  }),

  'task/update[contact]': createTaskUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Task',
    description: 'Update an existing task or to-do item',
    tags: ['task', 'update', 'contact', 'beta'],
    commentary: `Updates an existing task belonging to the current contact and
connected bot. Metadata updates are merged with existing values. Only tasks
belonging to the current contact can be modified.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to update',
      }),
      name: field({
        name: 'name',
        description: 'the updated name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'an updated detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to merge into the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
    bot: '#bot',
  }),

  'task/update[contact][by-bot-id]': createTaskUpdateTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Update Task',
    description: 'Update an existing task or to-do item',
    tags: ['task', 'update', 'contact', 'beta'],
    commentary: `Updates an existing task belonging to the current contact with an
optional bot scope. Metadata updates are merged with existing values. Only
tasks belonging to the current contact can be modified.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to update',
      }),
      name: field({
        name: 'name',
        description: 'the updated name of the task',
      }),
      description: field({
        name: 'description',
        description:
          'an updated detailed description that captures all the necessary information to complete the task',
      }),
      schedule: field({
        name: 'schedule',
        description:
          'optional schedule - now, 2027-12-31T23:59:59, quarterhourly, halfhourly, hourly, daily, weekly, monthly, or cron 0 0 * * *',
        optional: true,
      }),
      ...executionLimitFields(),
      meta: object({
        name: 'meta',
        description:
          'optional metadata to merge into the task as a JSON object',
        optional: true,
        shape: {},
      }),
    },
  }),

  'task/delete[contact]': createTaskDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Task',
    description: 'Delete an existing task',
    tags: ['task', 'delete', 'contact', 'beta'],
    commentary: `Permanently deletes a task belonging to the current contact and
connected bot. This cannot be undone and any scheduled runs will be cancelled.
Only tasks belonging to the current contact can be deleted.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to delete',
      }),
    },
    bot: '#bot',
  }),

  'task/delete[contact][by-bot-id]': createTaskDeleteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Delete Task',
    description: 'Delete an existing task',
    tags: ['task', 'delete', 'contact', 'beta'],
    commentary: `Permanently deletes a task belonging to the current contact with an
optional bot scope. This cannot be undone and any scheduled runs will be
cancelled. Only tasks belonging to the current contact can be deleted.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to delete',
      }),
    },
  }),

  'task/run[contact]': createTaskRunTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Run Task',
    description: 'Perform a single run of a task using the provided task ID',
    tags: ['task', 'run', 'contact', 'beta'],
    commentary: `Triggers a single execution of a task belonging to the current contact
and connected bot. Runs immediately regardless of the task's schedule. Only
tasks belonging to the current contact can be triggered.`,
    instruction: {
      '@scope': 'contact',
      botId: bot(),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to run',
      }),
    },
    bot: '#bot',
  }),

  'task/run[contact][by-bot-id]': createTaskRunTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Run Task',
    description: 'Perform a single run of a task using the provided task ID',
    tags: ['task', 'run', 'contact', 'beta'],
    commentary: `Triggers a single execution of a contact's task with an optional bot
scope. Runs immediately regardless of the task's schedule. Only tasks belonging
to the current contact can be triggered.`,
    instruction: {
      '@scope': 'contact',
      botId: field({
        name: 'botId',
        description: 'optional bot ID to scope by',
        placeholder: true,
      }),
      taskId: field({
        name: 'taskId',
        description: 'the ID of the task to run',
      }),
    },
  }),

  // --- Pack Abilities ---

  'pack/task': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Task Management Tools',
    description:
      'Installs all task management tools scoped to the connected bot. You can list, create, fetch, update, delete, and run tasks.',
    tags: ['task', 'pack', 'beta'],
    commentary: `Bundles the six account-scoped task tools (list, create, fetch,
update, delete, run), all bound to the connected bot. Tasks are visible across
the whole account but always belong to this one bot, and the bot ID is fixed -
the model never has to supply it. This is the default pack: install it when a
single bot manages its own tasks. Choose the [by-bot-id] variant instead if the
bot must reach tasks belonging to other bots, or the [contact] variant if each
end-user needs their own private tasks.`,
    instruction: {
      abilities: [
        'task/list',
        'task/create',
        'task/fetch',
        'task/update',
        'task/delete',
        'task/run',
      ] satisfies (keyof typeof abilities)[],
    },
    bot: '#bot',
  }),

  'pack/task[by-bot-id]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Task Management Tools',
    description:
      'Installs all task management tools with dynamic bot scoping. You can manage tasks across any bot by specifying the bot ID.',
    tags: ['task', 'pack', 'beta'],
    commentary: `Bundles the six account-scoped task tools, but each one takes an
optional bot ID so the bot can list and manage tasks across any bot in the
account, not just itself. Omit the bot ID to fall back to all account tasks.
Install this for orchestrator or admin bots that supervise tasks belonging to
several bots. For the common single-bot case prefer the plain task pack, which
hides the bot ID entirely.`,
    instruction: {
      abilities: [
        'task/list[by-bot-id]',
        'task/create[by-bot-id]',
        'task/fetch[by-bot-id]',
        'task/update[by-bot-id]',
        'task/delete[by-bot-id]',
        'task/run[by-bot-id]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/task[contact]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Contact Task Management Tools',
    description:
      'Installs task management tools scoped to the current contact and connected bot. Each contact can only see and manage their own tasks.',
    tags: ['task', 'contact', 'pack', 'beta'],
    commentary: `Bundles the six task tools scoped to the current contact - the
person in the conversation - and bound to the connected bot. Each contact only
ever sees and manages their own private tasks; one contact can never read or
touch another's. Install this for personal assistants where tasks must stay
isolated per end-user. Use the account-scoped task pack instead when tasks are
shared org-wide rather than owned by an individual contact.`,
    instruction: {
      abilities: [
        'task/list[contact]',
        'task/create[contact]',
        'task/fetch[contact]',
        'task/update[contact]',
        'task/delete[contact]',
        'task/run[contact]',
      ] satisfies (keyof typeof abilities)[],
    },
    bot: '#bot',
  }),

  'pack/task[contact][by-bot-id]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Contact Task Management Tools',
    description:
      'Installs task management tools scoped to the current contact with dynamic bot scoping. Each contact can only see and manage their own tasks across any bot.',
    tags: ['task', 'contact', 'pack', 'beta'],
    commentary: `Bundles the six contact-scoped task tools, with each one taking an
optional bot ID. Tasks stay private to the current contact, but the contact's
tasks can span multiple bots rather than just the connected one. Install this
when a contact has personal tasks that may be handled by different bots. If
those tasks only ever run on a single bot, prefer the plain contact task pack,
which drops the bot ID.`,
    instruction: {
      abilities: [
        'task/list[contact][by-bot-id]',
        'task/create[contact][by-bot-id]',
        'task/fetch[contact][by-bot-id]',
        'task/update[contact][by-bot-id]',
        'task/delete[contact][by-bot-id]',
        'task/run[contact][by-bot-id]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  // @todo add [bot] scope variants for tasks if bots need to manage their own tasks
}

export default abilities
