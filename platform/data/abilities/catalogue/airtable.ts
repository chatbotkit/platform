import {
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

const abilities = {
  'airtable/base/list': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'List Airtable Bases',
    description: 'List all accessible Airtable bases',
    tags: ['airtable', 'base', 'list'],
    secret: '@platform/airtable',
    instruction: {
      method: 'GET',
      url: 'https://api.airtable.com',
      path: ['/v0/meta/bases'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          bases: bases[*].{
            id: id,
            name: name,
            permissionLevel: permissionLevel
          }
        }`,
      },
    },
  }),

  'airtable/table/list': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'List Airtable Tables',
    description: 'List all tables in an Airtable base',
    tags: ['airtable', 'table', 'list'],
    secret: '@platform/airtable',
    instruction: {
      method: 'GET',
      url: 'https://api.airtable.com',
      path: [
        '/v0/meta/bases/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/tables',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          tables: tables[*].{
            id: id,
            name: name,
            description: description,
            primaryFieldId: primaryFieldId
          }
        }`,
      },
    },
  }),

  'airtable/table/schema/fetch': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Fetch Airtable Table Schema',
    description:
      'Fetch the complete schema for an Airtable table including all fields',
    tags: ['airtable', 'table', 'schema', 'fetch'],
    secret: '@platform/airtable',
    instruction: {
      method: 'GET',
      url: 'https://api.airtable.com',
      path: [
        '/v0/meta/bases/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/tables',
      ],
      query: {
        'include[]': 'schema',
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          table: tables[?id == '${field({
            name: 'tableId',
            description: 'the table ID',
            placeholder: true,
          })}'] | [0].{
            id: id,
            name: name,
            description: description,
            fields: fields[*].{
              id: id,
              name: name,
              type: type,
              options: options
            }
          }
        }`,
      },
    },
  }),

  'airtable/record/list': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'List Airtable Records',
    description:
      'List records from an Airtable table with optional filtering and sorting',
    tags: ['airtable', 'record', 'list'],
    secret: '@platform/airtable',
    instruction: {
      method: 'GET',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
      ],
      query: {
        maxRecords: field({
          name: 'maxRecords',
          type: 'number',
          default: 100,
          description: 'maximum number of records to return',
          placeholder: true,
          optional: true,
        }),
        pageSize: field({
          name: 'pageSize',
          type: 'number',
          default: 25,
          description: 'number of records returned in each page',
          placeholder: true,
          optional: true,
        }),
        filterByFormula: field({
          name: 'filterByFormula',
          description: 'formula to filter records',
          optional: true,
        }),
        'sort[0][field]': field({
          name: 'sortField',
          description: 'field to sort by',
          optional: true,
        }),
        'sort[0][direction]': field({
          name: 'sortDirection',
          enum: ['asc', 'desc'],
          default: 'asc',
          description: 'sort direction',
        }),
        view: field({
          name: 'view',
          description: 'view ID or name to use',
          optional: true,
        }),
        offset: field({
          name: 'offset',
          description: 'pagination offset',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          records: records[*].{
            id: id,
            fields: fields,
            createdTime: createdTime
          },
          offset: offset
        }`,
      },
    },
  }),

  'airtable/record/fetch': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Fetch Airtable Record',
    description: 'Fetch a specific record from an Airtable table',
    tags: ['airtable', 'record', 'fetch'],
    secret: '@platform/airtable',
    instruction: {
      method: 'GET',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
        '/',
        field({
          name: 'recordId',
          description: 'the record ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          id: id,
          fields: fields,
          createdTime: createdTime
        }`,
      },
    },
  }),

  'airtable/record/create': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Create Airtable Record',
    description: 'Create a new record in an Airtable table',
    tags: ['airtable', 'record', 'create'],
    secret: '@platform/airtable',
    instruction: {
      method: 'POST',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        fields: field({
          name: 'fields',
          description:
            'JSON object with field names as keys and values as field data',
          placeholder: true,
        }),
      },
      options: {
        jmespath: `{
          id: id,
          fields: fields,
          createdTime: createdTime
        }`,
      },
    },
  }),

  'airtable/record/update': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Update Airtable Record',
    description: 'Update an existing record in an Airtable table',
    tags: ['airtable', 'record', 'update'],
    secret: '@platform/airtable',
    instruction: {
      method: 'PATCH',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
        '/',
        field({
          name: 'recordId',
          description: 'the record ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        fields: field({
          name: 'fields',
          description: 'JSON object with field names as keys and new values',
          placeholder: true,
        }),
      },
      options: {
        jmespath: `{
          id: id,
          fields: fields,
          createdTime: createdTime
        }`,
      },
    },
  }),

  'airtable/record/delete': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Delete Airtable Record',
    description: 'Delete a record from an Airtable table',
    tags: ['airtable', 'record', 'delete'],
    secret: '@platform/airtable',
    instruction: {
      method: 'DELETE',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
        '/',
        field({
          name: 'recordId',
          description: 'the record ID',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          deleted: deleted,
          id: id
        }`,
      },
    },
  }),

  'airtable/record/batch/create': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Batch Create Airtable Records',
    description: 'Create multiple records in an Airtable table at once',
    tags: ['airtable', 'record', 'batch', 'create'],
    secret: '@platform/airtable',
    instruction: {
      method: 'POST',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        records: field({
          name: 'records',
          description:
            "array of record objects, each with a 'fields' property containing field data",
          placeholder: true,
        }),
      },
      options: {
        jmespath: `{
          records: records[*].{
            id: id,
            fields: fields,
            createdTime: createdTime
          }
        }`,
      },
    },
  }),

  'airtable/record/batch/update': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Batch Update Airtable Records',
    description: 'Update multiple records in an Airtable table at once',
    tags: ['airtable', 'record', 'batch', 'update'],
    secret: '@platform/airtable',
    instruction: {
      method: 'PATCH',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        records: field({
          name: 'records',
          description:
            "array of record objects, each with 'id' and 'fields' properties",
          placeholder: true,
        }),
      },
      options: {
        jmespath: `{
          records: records[*].{
            id: id,
            fields: fields,
            createdTime: createdTime
          }
        }`,
      },
    },
  }),

  'airtable/record/batch/delete': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Batch Delete Airtable Records',
    description: 'Delete multiple records from an Airtable table at once',
    tags: ['airtable', 'record', 'batch', 'delete'],
    secret: '@platform/airtable',
    instruction: {
      method: 'DELETE',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
      ],
      query: {
        'records[]': field({
          name: 'recordIds',
          description: 'comma-separated list of record IDs to delete',
          placeholder: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          records: records[*].{
            deleted: deleted,
            id: id
          }
        }`,
      },
    },
  }),

  'airtable/record/search': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Search Airtable Records',
    description:
      'Search for records using an Airtable formula to filter results',
    tags: ['airtable', 'record', 'search'],
    secret: '@platform/airtable',
    instruction: {
      method: 'GET',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
      ],
      query: {
        filterByFormula: field({
          name: 'filterByFormula',
          description:
            "Airtable formula to filter records, e.g. FIND('keyword', {Field Name})",
        }),
        maxRecords: field({
          name: 'maxRecords',
          type: 'number',
          default: 100,
          description: 'maximum number of records to return',
          optional: true,
        }),
        'sort[0][field]': field({
          name: 'sortField',
          description: 'field to sort by',
          optional: true,
        }),
        'sort[0][direction]': field({
          name: 'sortDirection',
          enum: ['asc', 'desc'],
          default: 'asc',
          description: 'sort direction',
          optional: true,
        }),
      },
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      options: {
        jmespath: `{
          records: records[*].{
            id: id,
            fields: fields,
            createdTime: createdTime
          }
        }`,
      },
    },
  }),

  'airtable/record/comment/create': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Create Comment on Record',
    description: 'Add a comment to an Airtable record',
    tags: ['airtable', 'record', 'comment', 'create'],
    secret: '@platform/airtable',
    instruction: {
      method: 'POST',
      url: 'https://api.airtable.com',
      path: [
        '/v0/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/',
        field({
          name: 'tableId',
          description: 'the table ID or name',
          placeholder: true,
        }),
        '/',
        field({
          name: 'recordId',
          description: 'the record ID',
          placeholder: true,
        }),
        '/comments',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        text: field({
          name: 'text',
          description: 'the comment text',
          placeholder: true,
        }),
      },
      options: {
        jmespath: `{
          id: id,
          text: text,
          createdTime: createdTime,
          author: author
        }`,
      },
    },
  }),

  'airtable/field/create': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Create Field',
    description: 'Create a new field in an Airtable table',
    tags: ['airtable', 'field', 'create'],
    secret: '@platform/airtable',
    instruction: {
      method: 'POST',
      url: 'https://api.airtable.com',
      path: [
        '/v0/meta/bases/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/fields',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the field name',
          placeholder: true,
        }),
        type: field({
          name: 'type',
          description:
            'the field type, e.g. singleLineText, multilineText, number',
          placeholder: true,
        }),
        description: field({
          name: 'description',
          description: 'optional field description',
          optional: true,
        }),
        options: field({
          name: 'options',
          description: 'optional field type-specific options as JSON object',
          optional: true,
        }),
      },
      options: {
        jmespath: `{
          id: id,
          name: name,
          type: type,
          description: description
        }`,
      },
    },
  }),

  'airtable/field/update': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Update Field',
    description: 'Update an existing field in an Airtable table',
    tags: ['airtable', 'field', 'update'],
    secret: '@platform/airtable',
    instruction: {
      method: 'PATCH',
      url: 'https://api.airtable.com',
      path: [
        '/v0/meta/bases/',
        field({
          name: 'baseId',
          description: 'the base ID',
          placeholder: true,
        }),
        '/tables/',
        field({
          name: 'tableId',
          description: 'the table ID',
          placeholder: true,
        }),
        '/fields/',
        field({
          name: 'fieldId',
          description: 'the field ID to update',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'the new field name',
          optional: true,
        }),
        description: field({
          name: 'description',
          description: 'the new field description',
          optional: true,
        }),
      },
      options: {
        jmespath: `{
          id: id,
          name: name,
          type: type,
          description: description
        }`,
      },
    },
  }),

  'airtable/api/call': createFetchTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Call Airtable API',
    description:
      'Make a generic API call to Airtable. This is a flexible template that can be used to call any Airtable API endpoint by specifying the method, URL, and request body.',
    tags: ['airtable', 'api', 'call', 'generic'],
    secret: '@platform/airtable',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Airtable API endpoint to call',
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

  'pack/airtable': createPackTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Install Airtable Tools',
    description:
      'Installs Airtable tools into the conversation. You can list bases and tables, manage records, and perform comprehensive database operations.',
    tags: ['airtable', 'pack', 'beta'],
    secret: '@platform/airtable',
    instruction: {
      abilities: [
        'airtable/base/list',
        'airtable/table/list',
        'airtable/table/schema/fetch',
        'airtable/record/list',
        'airtable/record/fetch',
        'airtable/record/create',
        'airtable/record/update',
        'airtable/record/delete',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/airtable[read-only]': createPackTemplate({
    provider: 'airtable',
    icon: '@logo/airtable.com',
    name: 'Install Airtable Search Tools',
    description:
      'Installs read-only Airtable tools into the conversation. You can list bases, tables, and retrieve records without modification.',
    tags: ['airtable', 'pack', 'beta'],
    secret: '@platform/airtable',
    instruction: {
      // @todo ensure these strictly match the ids in the abilities
      abilities: [
        'airtable/base/list',
        'airtable/table/list',
        'airtable/table/schema/fetch',
        'airtable/record/list',
        'airtable/record/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
