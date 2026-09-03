import {
  createAuxiliaryTemplate,
  createPackTemplate,
  field,
} from '@/lib/ability.template'

import type {
  DRAFT_CREATE_HANDLER_NAME,
  DRAFT_DELETE_HANDLER_NAME,
  DRAFT_FETCH_HANDLER_NAME,
  DRAFT_LIST_HANDLER_NAME,
  DRAFT_SEND_HANDLER_NAME,
  DraftCreateSchema,
  DraftDeleteSchema,
  DraftFetchSchema,
  DraftListSchema,
  DraftSendSchema,
  LABEL_CREATE_HANDLER_NAME,
  LABEL_DELETE_HANDLER_NAME,
  LABEL_LIST_HANDLER_NAME,
  LabelCreateSchema,
  LabelDeleteSchema,
  LabelListSchema,
  MESSAGE_FETCH_HANDLER_NAME,
  MESSAGE_LABEL_HANDLER_NAME,
  MESSAGE_LIST_HANDLER_NAME,
  MESSAGE_SEND_HANDLER_NAME,
  MESSAGE_TRASH_HANDLER_NAME,
  MessageFetchSchema,
  MessageLabelSchema,
  MessageListSchema,
  MessageSendSchema,
  MessageTrashSchema,
  THREAD_FETCH_HANDLER_NAME,
  THREAD_LIST_HANDLER_NAME,
  THREAD_TRASH_HANDLER_NAME,
  ThreadFetchSchema,
  ThreadListSchema,
  ThreadTrashSchema,
  USER_PROFILE_FETCH_HANDLER_NAME,
  UserProfileFetchSchema,
} from '@/pages/api/auxiliary/skillset/ability/google/mail'

// --- Path Constants ---

const MAIL_API_PATH = '/api/auxiliary/skillset/ability/google/mail'

/**
 * Catalogue of Google Mail abilities.
 */
const abilities = {
  // --- Message Abilities ---

  'google/mail/message/search': createAuxiliaryTemplate<MessageListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Search Gmail Messages',
    description: 'Searches for messages in Gmail.',
    tags: ['gmail', 'email', 'search', 'messages'],
    path: MAIL_API_PATH,
    handler: 'message/list' satisfies typeof MESSAGE_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      q: field({
        name: 'q',
        description:
          'Return messages matching the specified query - supports the same query format as the gmail search box',
        placeholder: true,
      }),
      maxResults: field({
        name: 'maxResults',
        description: 'Maximum number of results to return',
        type: 'number',
        placeholder: true,
        optional: true,
        default: 25,
      }),
      returnMessageText: field({
        name: 'returnMessageText',
        description: 'Whether to return the full message text',
        type: 'boolean',
        placeholder: true,
        optional: true,
        default: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/message/list': createAuxiliaryTemplate<MessageListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Gmail Messages',
    description: 'Get a list of all gmail messages sorted in descending order.',
    tags: ['gmail', 'email', 'list', 'messages'],
    path: MAIL_API_PATH,
    handler: 'message/list' satisfies typeof MESSAGE_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      maxResults: field({
        name: 'maxResults',
        description: 'Maximum number of results to return',
        type: 'number',
        placeholder: true,
        optional: true,
        default: 25,
      }),
      returnMessageText: field({
        name: 'returnMessageText',
        description: 'Whether to return the full message text',
        type: 'boolean',
        placeholder: true,
        optional: true,
        default: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/message/list[pending]':
    createAuxiliaryTemplate<MessageListSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'List Pending Gmail Messages',
      description:
        'Get a list of pending gmail messages from personal inbox sorted in descending order.',
      tags: ['gmail', 'email', 'list', 'messages', 'pending'],
      path: MAIL_API_PATH,
      handler: 'message/list' satisfies typeof MESSAGE_LIST_HANDLER_NAME,
      secret: '@platform/google/mail',
      instruction: {
        maxResults: field({
          name: 'maxResults',
          description: 'Maximum number of results to return',
          type: 'number',
          placeholder: true,
          optional: true,
          default: 25,
        }),
        returnMessageText: field({
          name: 'returnMessageText',
          description: 'Whether to return the full message text',
          type: 'boolean',
          placeholder: true,
          optional: true,
          default: false,
        }),
        filterPending: true,
      },
      options: {
        auth: 'internal',
      },
    }),

  'google/mail/message/fetch': createAuxiliaryTemplate<MessageFetchSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Fetch Gmail Message',
    description: 'Get a specific gmail message by id.',
    tags: ['gmail', 'email', 'fetch', 'message'],
    path: MAIL_API_PATH,
    handler: 'message/fetch' satisfies typeof MESSAGE_FETCH_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The message ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/message/send': createAuxiliaryTemplate<MessageSendSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Send Gmail Message',
    description: 'Send an email using Gmail.',
    tags: ['gmail', 'email', 'send', 'message'],
    path: MAIL_API_PATH,
    handler: 'message/send' satisfies typeof MESSAGE_SEND_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      threadId: field({
        name: 'threadId',
        description: 'The thread ID this message belongs to',
        optional: true,
      }),
      to: field({
        name: 'to',
        description: 'The recipient email address',
        placeholder: true,
      }),
      subject: field({
        name: 'subject',
        description: 'The subject of the email',
        placeholder: true,
      }),
      content: field({
        name: 'content',
        description: 'The content of the email',
      }),
      attachments: field({
        name: 'attachments',
        description: 'A space separated list of attachment URLs',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Draft Abilities ---

  'google/mail/draft/fetch': createAuxiliaryTemplate<DraftFetchSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Fetch Gmail Draft',
    description: 'Get a specific gmail draft by id.',
    tags: ['gmail', 'email', 'fetch', 'draft'],
    path: MAIL_API_PATH,
    handler: 'draft/fetch' satisfies typeof DRAFT_FETCH_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The draft ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/draft/create': createAuxiliaryTemplate<DraftCreateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Gmail Draft Email',
    description: 'Create a draft email in Gmail.',
    tags: ['gmail', 'email', 'create', 'draft'],
    path: MAIL_API_PATH,
    handler: 'draft/create' satisfies typeof DRAFT_CREATE_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      threadId: field({
        name: 'threadId',
        description: 'The thread ID this draft belongs to',
        optional: true,
      }),
      to: field({
        name: 'to',
        description: 'The recipient email address',
        placeholder: true,
      }),
      subject: field({
        name: 'subject',
        description: 'The subject of the email',
        placeholder: true,
      }),
      content: field({
        name: 'content',
        description: 'The content of the email',
      }),
      attachments: field({
        name: 'attachments',
        description: 'A space separated list of attachment URLs',
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Thread Abilities ---

  'google/mail/thread/search': createAuxiliaryTemplate<ThreadListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Search Gmail Threads',
    description: 'Search for threads in Gmail.',
    tags: ['gmail', 'email', 'search', 'threads'],
    path: MAIL_API_PATH,
    handler: 'thread/list' satisfies typeof THREAD_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      q: field({
        name: 'q',
        description:
          'Return email threads matching the specified query - supports the same query format as the gmail search box',
        placeholder: true,
      }),
      maxResults: field({
        name: 'maxResults',
        description: 'Maximum number of threads to return',
        type: 'number',
        placeholder: true,
        optional: true,
        default: 25,
      }),
      returnMessageText: field({
        name: 'returnMessageText',
        description: 'Return the full message text',
        type: 'boolean',
        placeholder: true,
        optional: true,
        default: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/thread/list': createAuxiliaryTemplate<ThreadListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Gmail Threads',
    description: 'Get a list of all gmail threads sorted in descending order.',
    tags: ['gmail', 'email', 'list', 'threads'],
    path: MAIL_API_PATH,
    handler: 'thread/list' satisfies typeof THREAD_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      maxResults: field({
        name: 'maxResults',
        description: 'Maximum number of threads to return',
        type: 'number',
        placeholder: true,
        optional: true,
        default: 25,
      }),
      returnMessageText: field({
        name: 'returnMessageText',
        description: 'Return the full message text',
        type: 'boolean',
        placeholder: true,
        optional: true,
        default: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/thread/list[pending]': createAuxiliaryTemplate<ThreadListSchema>(
    {
      provider: 'google',
      icon: '@logo/google.com',
      name: 'List Pending Gmail Threads',
      description: 'List threads that have not been answered yet.',
      tags: ['gmail', 'email', 'list', 'threads', 'pending'],
      path: MAIL_API_PATH,
      handler: 'thread/list' satisfies typeof THREAD_LIST_HANDLER_NAME,
      secret: '@platform/google/mail',
      instruction: {
        maxResults: field({
          name: 'maxResults',
          description: 'Maximum number of threads to return',
          type: 'number',
          placeholder: true,
          optional: true,
          default: 25,
        }),
        returnMessageText: field({
          name: 'returnMessageText',
          description: 'Return the full message text',
          type: 'boolean',
          placeholder: true,
          optional: true,
          default: false,
        }),
        filterPending: true,
      },
      options: {
        auth: 'internal',
      },
    }
  ),

  'google/mail/thread/fetch': createAuxiliaryTemplate<ThreadFetchSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Fetch Gmail Thread',
    description: 'Get a specific gmail thread by id.',
    tags: ['gmail', 'email', 'fetch', 'thread'],
    path: MAIL_API_PATH,
    handler: 'thread/fetch' satisfies typeof THREAD_FETCH_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The thread ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- User Profile Abilities ---

  'google/mail/user/profile/fetch':
    createAuxiliaryTemplate<UserProfileFetchSchema>({
      provider: 'google',
      icon: '@logo/google.com',
      name: 'Fetch Gmail User Profile',
      description: 'Fetch the profile of the authenticated user.',
      tags: ['gmail', 'email', 'profile', 'user'],
      path: MAIL_API_PATH,
      handler:
        'user/profile/fetch' satisfies typeof USER_PROFILE_FETCH_HANDLER_NAME,
      secret: '@platform/google/mail',
      instruction: {},
      options: {
        auth: 'internal',
      },
    }),

  // --- Additional Draft Abilities ---

  'google/mail/draft/search': createAuxiliaryTemplate<DraftListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Search Gmail Drafts',
    description: 'Search for drafts in Gmail.',
    tags: ['gmail', 'email', 'search', 'drafts'],
    path: MAIL_API_PATH,
    handler: 'draft/list' satisfies typeof DRAFT_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      q: field({
        name: 'q',
        description:
          'Return draft messages matching the specified query - supports the same query format as the gmail search box',
        placeholder: true,
      }),
      maxResults: field({
        name: 'maxResults',
        description: 'The maximum number of drafts to return',
        type: 'number',
        placeholder: true,
        optional: true,
        default: 25,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/draft/list': createAuxiliaryTemplate<DraftListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Gmail Drafts',
    description: 'Get a list of all gmail drafts sorted in descending order.',
    tags: ['gmail', 'email', 'list', 'drafts'],
    path: MAIL_API_PATH,
    handler: 'draft/list' satisfies typeof DRAFT_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      maxResults: field({
        name: 'maxResults',
        description: 'The maximum number of drafts to return',
        type: 'number',
        placeholder: true,
        optional: true,
        default: 25,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/draft/send': createAuxiliaryTemplate<DraftSendSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Send Gmail Draft Email',
    description: 'Send a draft email in Gmail.',
    tags: ['gmail', 'email', 'send', 'draft'],
    path: MAIL_API_PATH,
    handler: 'draft/send' satisfies typeof DRAFT_SEND_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The draft ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/draft/delete': createAuxiliaryTemplate<DraftDeleteSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Gmail Draft Email',
    description: 'Delete a draft email in Gmail.',
    tags: ['gmail', 'email', 'delete', 'draft'],
    path: MAIL_API_PATH,
    handler: 'draft/delete' satisfies typeof DRAFT_DELETE_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The draft ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Additional Message Abilities ---

  'google/mail/message/trash': createAuxiliaryTemplate<MessageTrashSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Trash Gmail Message',
    description: 'Move a specific gmail message to the trash.',
    tags: ['gmail', 'email', 'trash', 'message'],
    path: MAIL_API_PATH,
    handler: 'message/trash' satisfies typeof MESSAGE_TRASH_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The message ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/message/label': createAuxiliaryTemplate<MessageLabelSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Label Gmail Message',
    description: 'Label a specific gmail message.',
    tags: ['gmail', 'email', 'label', 'message'],
    path: MAIL_API_PATH,
    handler: 'message/label' satisfies typeof MESSAGE_LABEL_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The message ID',
        placeholder: true,
      }),
      addLabelId: field({
        name: 'addLabelId',
        description: 'The label ID to add',
        placeholder: true,
        optional: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Additional Thread Abilities ---

  'google/mail/thread/trash': createAuxiliaryTemplate<ThreadTrashSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Trash Gmail Thread',
    description: 'Move a specific gmail thread to the trash.',
    tags: ['gmail', 'email', 'trash', 'thread'],
    path: MAIL_API_PATH,
    handler: 'thread/trash' satisfies typeof THREAD_TRASH_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The thread ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Label Abilities ---

  'google/mail/label/list': createAuxiliaryTemplate<LabelListSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'List Gmail Labels',
    description: 'Get a list of all gmail labels.',
    tags: ['gmail', 'email', 'list', 'labels'],
    path: MAIL_API_PATH,
    handler: 'label/list' satisfies typeof LABEL_LIST_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {},
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/label/create': createAuxiliaryTemplate<LabelCreateSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Create Gmail Label',
    description: 'Create a new label in Gmail.',
    tags: ['gmail', 'email', 'create', 'label'],
    path: MAIL_API_PATH,
    handler: 'label/create' satisfies typeof LABEL_CREATE_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      name: field({
        name: 'name',
        description: 'The name of the label',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'google/mail/label/delete': createAuxiliaryTemplate<LabelDeleteSchema>({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Delete Gmail Label',
    description: 'Delete a specific gmail label by id.',
    tags: ['gmail', 'email', 'delete', 'label'],
    path: MAIL_API_PATH,
    handler: 'label/delete' satisfies typeof LABEL_DELETE_HANDLER_NAME,
    secret: '@platform/google/mail',
    instruction: {
      id: field({
        name: 'id',
        description: 'The label ID',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Pack Abilities ---

  'pack/google/mail': createPackTemplate({
    provider: 'google',
    icon: '@logo/google.com',
    name: 'Install Google Mail Tools',
    description:
      'Installs Google Mail tools into the conversation to manage emails, drafts, and labels and search messages and threads.',
    tags: ['beta'],
    secret: '@platform/google/mail',
    instruction: {
      abilities: [
        'google/mail/user/profile/fetch',
        'google/mail/draft/search',
        'google/mail/draft/list',
        'google/mail/draft/fetch',
        'google/mail/draft/create',
        'google/mail/draft/send',
        'google/mail/draft/delete',
        'google/mail/message/list[pending]',
        'google/mail/message/fetch',
        'google/mail/message/send',
        'google/mail/message/label',
        'google/mail/message/trash',
        'google/mail/thread/search',
        'google/mail/thread/fetch',
        'google/mail/thread/trash',
        'google/mail/label/list',
        'google/mail/label/create',
        'google/mail/label/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
