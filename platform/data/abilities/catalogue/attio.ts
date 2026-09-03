import {
  array,
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/attio/sql'

/**
 * Catalogue of Attio CRM abilities.
 *
 * @see https://docs.attio.com/rest-api/overview
 */
const abilities = {
  // SQL
  'attio/sql/exec': createAuxiliaryTemplate<Schema>({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Execute Attio SQL Query',
    description:
      'Execute a simple SQL query in Attio. Known tables include attio.people, attio.companies. Joining tables and other complex queries are not supported.',
    tags: ['crm', 'attio', 'sql', 'beta', 'features'],
    commentary:
      'A simplified SQL interface for reading and writing Attio CRM data. Best suited for simple queries like looking up contacts, listing companies, or inserting records. Joins, subqueries, and other complex SQL features are not supported.',
    path: '/api/auxiliary/skillset/ability/attio/sql',
    secret: '@platform/attio',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - describe, select, insert, update, delete are supported',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // Objects
  'attio/object/list': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'List Objects',
    description:
      'Get a list of all objects - e.g., People, Companies - in Attio',
    tags: ['attio', 'object', 'list', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2/objects',
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/attribute/list': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'List Attributes',
    description:
      'List live Attio attributes for an object or list so you can discover the correct API slugs, types, and writable fields before using generic record mutation tools.',
    tags: ['attio', 'attribute', 'list', 'crm'],
    commentary:
      'Use this first when you are not sure which attribute slugs or value types an Attio object expects. Look for api_slug, type, is_writable, is_required, is_unique, and is_multiselect in the response.',
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2',
      path: [
        '/',
        field({
          name: 'target',
          description: 'whether to inspect attributes on an object or list',
          enum: ['objects', 'lists'],
        }),
        '/',
        field({
          name: 'identifier',
          description:
            'slug or UUID of the object or list whose attributes you want to inspect, such as people',
          placeholder: true,
        }),
        '/attributes',
      ],
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of attributes to return',
          optional: true,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of attributes to skip',
          optional: true,
          default: 0,
        }),
        show_archived: field({
          name: 'showArchived',
          type: 'boolean',
          description: 'whether archived attributes should be included',
          optional: true,
          default: false,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Records
  'attio/record/list': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'List Records',
    description:
      'List records in an Attio object with optional filtering and sorting',
    tags: ['attio', 'record', 'list', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'POST',
      url: 'https://api.attio.com/v2',
      path: [
        '/objects/',
        field({
          name: 'object',
          description:
            'the object slug or ID - e.g., "people" or "companies" - to list records for',
          placeholder: true,
        }),
        '/records/query',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        filter: object({
          name: 'filter',
          description:
            'filter object to narrow down results. Cannot be used together with filterViewId.',
          optional: true,
          shape: {},
        }),
        filter_view_id: field({
          name: 'filterViewId',
          description:
            'UUID of a saved Attio view to filter by. Cannot be used together with filter.',
          optional: true,
        }),
        sorts: array({
          name: 'sorts',
          description:
            'optional sort instructions. Each item can sort by an attribute or by a traversal path.',
          optional: true,
          items: object({
            shape: {
              direction: field({
                name: 'direction',
                description: 'sort direction',
                enum: ['asc', 'desc'],
              }),
              attribute: field({
                name: 'attribute',
                description: 'attribute slug or ID to sort by',
                optional: true,
              }),
              field: field({
                name: 'field',
                description:
                  'optional field on the attribute value to sort by, such as last_name',
                optional: true,
              }),
              path: array({
                name: 'path',
                description:
                  'optional traversal path expressed as [object, attribute] tuples',
                optional: true,
                items: array({
                  items: field({
                    name: 'pathPart',
                    description: 'object or attribute slug or ID',
                  }),
                  minItems: 2,
                  maxItems: 2,
                }),
              }),
            },
          }),
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results to return',
          optional: true,
          default: 500,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of results to skip',
          optional: true,
          default: 0,
        }),
      },
    },
  }),

  'attio/record/fetch': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Get Record',
    description: 'Retrieve a specific record by its ID from an Attio object',
    tags: ['attio', 'record', 'get', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2',
      path: [
        '/objects/',
        field({
          name: 'object',
          description: 'the object slug or ID - e.g., "people" or "companies"',
          placeholder: true,
        }),
        '/records/',
        field({
          name: 'recordId',
          description: 'the UUID of the record to retrieve',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/record/create': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Create Record',
    description:
      'Advanced: create a record in any Attio object when you already know the exact attribute slugs and value shapes. If you are not sure, call attio/attribute/list first.',
    tags: ['attio', 'record', 'create', 'crm', 'advanced'],
    secret: '@platform/attio',
    instruction: {
      method: 'POST',
      url: 'https://api.attio.com/v2',
      path: [
        '/objects/',
        field({
          name: 'object',
          description:
            'the object slug or ID - e.g., "people" or "companies" - to create the record in',
          placeholder: true,
        }),
        '/records',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          values: object({
            name: 'values',
            description:
              'object keyed by attribute API slug or attribute ID. Each value should match the Attio attribute type for that key.',
            shape: {},
          }),
        },
      },
    },
  }),

  'attio/record/update': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Update Record',
    description:
      'Advanced: update a record in any Attio object when you already know the exact attribute slugs and value shapes. If you are not sure, call attio/attribute/list first.',
    tags: ['attio', 'record', 'update', 'crm', 'advanced'],
    secret: '@platform/attio',
    instruction: {
      method: 'PUT',
      url: 'https://api.attio.com/v2',
      path: [
        '/objects/',
        field({
          name: 'object',
          description: 'the object slug or ID - e.g., "people" or "companies"',
          placeholder: true,
        }),
        '/records/',
        field({
          name: 'recordId',
          description: 'the UUID of the record to update',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          values: object({
            name: 'values',
            description:
              'object keyed by attribute API slug or attribute ID. Each value should match the Attio attribute type for that key.',
            shape: {},
          }),
        },
      },
    },
  }),

  'attio/record/delete': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Delete Record',
    description: 'Delete a record from an Attio object',
    tags: ['attio', 'record', 'delete', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'DELETE',
      url: 'https://api.attio.com/v2',
      path: [
        '/objects/',
        field({
          name: 'object',
          description: 'the object slug or ID - e.g., "people" or "companies"',
          placeholder: true,
        }),
        '/records/',
        field({
          name: 'recordId',
          description: 'the UUID of the record to delete',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Notes
  'attio/note/list': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'List Notes',
    description: 'List notes attached to records in Attio',
    tags: ['attio', 'note', 'list', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2/notes',
      query: {
        parent_object: field({
          name: 'parentObject',
          description:
            'the object slug or ID to filter notes by - e.g., "people"',
          optional: true,
        }),
        parent_record_id: field({
          name: 'parentRecordId',
          description: 'the UUID of the parent record to filter notes by',
          optional: true,
        }),
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results (default: 10, max: 50)',
          optional: true,
          default: 10,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of results to skip (default: 0)',
          optional: true,
          default: 0,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/note/create': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Create Note',
    description: 'Create a note attached to a record in Attio',
    tags: ['attio', 'note', 'create', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'POST',
      url: 'https://api.attio.com/v2/notes',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          parent_object: field({
            name: 'parentObject',
            description:
              'the object slug or ID the note belongs to - e.g., "people"',
          }),
          parent_record_id: field({
            name: 'parentRecordId',
            description: 'the UUID of the record to attach the note to',
          }),
          title: field({
            name: 'title',
            description: 'the title of the note',
          }),
          format: field({
            name: 'format',
            description: 'the format of the content - plaintext or markdown',
            enum: ['plaintext', 'markdown'],
          }),
          content: field({
            name: 'content',
            description: 'the note content in the specified format',
          }),
          created_at: field({
            name: 'createdAt',
            description:
              'optional ISO 8601 timestamp to backdate the note. Must not be in the future.',
            optional: true,
          }),
          meeting_id: field({
            name: 'meetingId',
            description:
              'optional meeting UUID to associate with the note. Use null explicitly if needed.',
            optional: true,
          }),
        },
      },
    },
  }),

  'attio/note/fetch': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Get Note',
    description: 'Retrieve a specific note by its ID',
    tags: ['attio', 'note', 'get', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2',
      path: [
        '/notes/',
        field({
          name: 'noteId',
          description: 'the UUID of the note to retrieve',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/note/delete': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Delete Note',
    description: 'Delete a note from Attio',
    tags: ['attio', 'note', 'delete', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'DELETE',
      url: 'https://api.attio.com/v2',
      path: [
        '/notes/',
        field({
          name: 'noteId',
          description: 'the UUID of the note to delete',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // Tasks
  'attio/task/list': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'List Tasks',
    description: 'List tasks in Attio with optional filtering',
    tags: ['attio', 'task', 'list', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2/tasks',
      query: {
        limit: field({
          name: 'limit',
          type: 'number',
          description: 'maximum number of results (default: 500)',
          optional: true,
          default: 500,
        }),
        offset: field({
          name: 'offset',
          type: 'number',
          description: 'number of results to skip (default: 0)',
          optional: true,
          default: 0,
        }),
        sort: field({
          name: 'sort',
          description:
            'sort order: "created_at:asc" or "created_at:desc" (default: oldest first)',
          enum: ['created_at:asc', 'created_at:desc'],
          optional: true,
        }),
        linked_object: field({
          name: 'linkedObject',
          description:
            'filter by linked record object slug - e.g., "people". Requires linkedRecordId',
          optional: true,
        }),
        linked_record_id: field({
          name: 'linkedRecordId',
          description:
            'filter by linked record ID. Requires linkedObject to be set',
          optional: true,
        }),
        assignee: field({
          name: 'assignee',
          description:
            'filter by assignee (workspace member ID or email). Pass empty string for unassigned',
          optional: true,
        }),
        is_completed: field({
          name: 'isCompleted',
          type: 'boolean',
          description:
            'filter by completion status (true for completed, false for incomplete)',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/task/create': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Create Task',
    description: 'Create a new task in Attio',
    tags: ['attio', 'task', 'create', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'POST',
      url: 'https://api.attio.com/v2/tasks',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          content: field({
            name: 'content',
            description: 'the task description/content',
          }),
          format: field({
            name: 'format',
            description:
              'the format of the content. Attio currently supports plaintext only for task creation.',
            enum: ['plaintext'],
            optional: true,
            default: 'plaintext',
          }),
          deadline_at: field({
            name: 'deadlineAt',
            description: 'deadline in ISO 8601 format - e.g., "2024-01-15"',
            optional: true,
          }),
          is_completed: field({
            name: 'isCompleted',
            type: 'boolean',
            description: 'whether the task is completed (default: false)',
            optional: true,
            default: false,
          }),
          linked_records: array({
            name: 'linkedRecords',
            description:
              'array of linked record references. Each item typically includes target_object and target_record_id. Matching-attribute references can be provided with additional object properties when needed.',
            optional: true,
            items: object({
              shape: {
                target_object: field({
                  name: 'targetObject',
                  description:
                    'slug or ID of the linked object, such as people',
                }),
                target_record_id: field({
                  name: 'targetRecordId',
                  description:
                    'UUID of the linked record when referencing directly',
                  optional: true,
                }),
              },
            }),
          }),
          assignees: array({
            name: 'assignees',
            description:
              'array of assignee objects. Use either referenced_actor_type with referenced_actor_id, or workspace_member_email_address.',
            optional: true,
            items: object({
              shape: {
                referenced_actor_type: field({
                  name: 'referencedActorType',
                  description:
                    'set to workspace-member when assigning by actor ID',
                  enum: ['workspace-member'],
                  optional: true,
                }),
                referenced_actor_id: field({
                  name: 'referencedActorId',
                  description: 'workspace member actor UUID',
                  optional: true,
                }),
                workspace_member_email_address: field({
                  name: 'workspaceMemberEmailAddress',
                  description:
                    'workspace member email address as an alternative to actor ID',
                  optional: true,
                }),
              },
            }),
          }),
        },
      },
    },
  }),

  'attio/task/fetch': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Get Task',
    description: 'Retrieve a specific task by its ID',
    tags: ['attio', 'task', 'get', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'GET',
      url: 'https://api.attio.com/v2',
      path: [
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the UUID of the task to retrieve',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/task/update': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Update Task',
    description: 'Update an existing task in Attio',
    tags: ['attio', 'task', 'update', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'PATCH',
      url: 'https://api.attio.com/v2',
      path: [
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the UUID of the task to update',
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        data: {
          deadline_at: field({
            name: 'deadlineAt',
            description:
              'updated deadline in ISO 8601 format - e.g., "2024-01-15"',
            optional: true,
          }),
          is_completed: field({
            name: 'isCompleted',
            type: 'boolean',
            description: 'updated completion status',
            optional: true,
          }),
          linked_records: array({
            name: 'linkedRecords',
            description:
              'updated linked record references. Each item typically includes target_object and target_record_id. Matching-attribute references can be provided with additional object properties when needed.',
            optional: true,
            items: object({
              shape: {
                target_object: field({
                  name: 'targetObject',
                  description:
                    'slug or ID of the linked object, such as people',
                }),
                target_record_id: field({
                  name: 'targetRecordId',
                  description:
                    'UUID of the linked record when referencing directly',
                  optional: true,
                }),
              },
            }),
          }),
          assignees: array({
            name: 'assignees',
            description:
              'updated assignee objects. Use either referenced_actor_type with referenced_actor_id, or workspace_member_email_address.',
            optional: true,
            items: object({
              shape: {
                referenced_actor_type: field({
                  name: 'referencedActorType',
                  description:
                    'set to workspace-member when assigning by actor ID',
                  enum: ['workspace-member'],
                  optional: true,
                }),
                referenced_actor_id: field({
                  name: 'referencedActorId',
                  description: 'workspace member actor UUID',
                  optional: true,
                }),
                workspace_member_email_address: field({
                  name: 'workspaceMemberEmailAddress',
                  description:
                    'workspace member email address as an alternative to actor ID',
                  optional: true,
                }),
              },
            }),
          }),
        },
      },
    },
  }),

  'attio/task/delete': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Delete Task',
    description: 'Delete a task from Attio',
    tags: ['attio', 'task', 'delete', 'crm'],
    secret: '@platform/attio',
    instruction: {
      method: 'DELETE',
      url: 'https://api.attio.com/v2',
      path: [
        '/tasks/',
        field({
          name: 'taskId',
          description: 'the UUID of the task to delete',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'attio/api/call': createFetchTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Call Attio API',
    description:
      'Make a generic API call to Attio. This is a flexible template that can be used to call any Attio API endpoint by specifying the method, URL, and request body.',
    tags: ['attio', 'api', 'call', 'generic'],
    secret: '@platform/attio',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Attio API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),

  'pack/attio': createPackTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Install Attio Tools',
    description:
      'Installs Attio tools into the conversation. You can manage objects, records, notes, and tasks in your CRM.',
    tags: ['attio', 'pack', 'beta'],
    secret: '@platform/attio',
    instruction: {
      abilities: [
        'attio/object/list',
        'attio/attribute/list',
        'attio/record/list',
        'attio/record/fetch',
        'attio/record/create',
        'attio/record/update',
        'attio/record/delete',
        'attio/note/list',
        'attio/note/create',
        'attio/note/fetch',
        'attio/note/delete',
        'attio/task/list',
        'attio/task/create',
        'attio/task/fetch',
        'attio/task/update',
        'attio/task/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/attio[read-only]': createPackTemplate({
    provider: 'attio',
    icon: '@logo/attio.com',
    name: 'Install Attio Search Tools',
    description:
      'Installs read-only Attio tools into the conversation. You can inspect objects, attributes, records, notes, and tasks without modification.',
    tags: ['attio', 'pack', 'beta'],
    secret: '@platform/attio',
    instruction: {
      abilities: [
        'attio/object/list',
        'attio/attribute/list',
        'attio/record/list',
        'attio/record/fetch',
        'attio/note/list',
        'attio/note/fetch',
        'attio/task/list',
        'attio/task/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
