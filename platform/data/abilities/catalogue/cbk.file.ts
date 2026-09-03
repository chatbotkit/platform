import {
  createAuxiliaryTemplate,
  createFileAppendTemplate,
  createFilePrependTemplate,
  createFileReadTemplate,
  createFileReplaceTemplate,
  createFileRwTemplate,
  createFileWriteTemplate,
  createPackTemplate,
  field,
  file,
} from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/chatbotkit/file/sql'

/**
 * Catalogue of ChatBotKit file abilities.
 */
const abilities = {
  'file/read': createFileReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read File',
    description:
      'Read the content of a file. Supports optional line range to read specific sections. For efficiency, prefer reading larger chunks rather than many small sequential reads.',
    tags: ['file', 'read'],
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      id: file(),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start reading from (1-indexed, line 1 is the first line)',
        type: 'number',
        min: 1,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end reading at, inclusive (1-indexed). Prefer reading at least 100 lines or more per request to minimize round trips',
        type: 'number',
        min: 1,
      }),
    },
    file: '@file',
  }),

  'file/write': createFileWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write File',
    description:
      'Write content to a file. Without line parameters, overwrites the entire file. With startLine only, inserts before that line. With startLine and endLine, replaces that range. For small files prefer a full rewrite (omit the line parameters); for targeted edits prefer file/replace, which anchors on the surrounding text and cannot break the file with an off-by-one line range.',
    tags: ['file', 'write'],
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      id: file(),
      text: field({
        name: 'content',
        description: 'content to write to the file',
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start writing at (1-indexed). If only startLine is provided, content is inserted before this line. If both startLine and endLine are provided, lines in that range are replaced.',
        type: 'number',
        optional: true,
        min: 1,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end writing at, inclusive (1-indexed). Used with startLine to replace a range of lines.',
        type: 'number',
        optional: true,
        min: 1,
      }),
    },
    file: '@file',
  }),

  'file/prepend': createFilePrependTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Prepend to File',
    description: 'Prepend content to a file',
    tags: ['file', 'prepend'],
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      id: file(),
      text: field({
        name: 'content',
        description: 'content to prepend to the file',
      }),
    },
    file: '@file',
  }),

  'file/append': createFileAppendTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Append to File',
    description: 'Append content to a file',
    tags: ['file', 'append'],
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      id: file(),
      text: field({
        name: 'content',
        description: 'content to append to the file',
      }),
    },
    file: '@file',
  }),

  'file/replace': createFileReplaceTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Replace in File',
    description: 'Replace text in a file',
    tags: ['file', 'replace'],
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      id: file(),
      search: field({
        name: 'search',
        description: 'text to search for',
      }),
      replace: field({
        name: 'replace',
        description: 'text to replace with',
      }),
      count: field({
        name: 'count',
        description:
          'number of occurrences to replace (optional, replaces all if not specified)',
        type: 'number',
      }),
    },
    file: '@file',
  }),

  'file/rw': createFileRwTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read/Write File',
    description:
      'Read or write file content with a single combined operation. Use mode "read" to read content, or mode "write" to write content. Supports optional line ranges for both modes. For write edits, prefer a full rewrite for small files, or file/replace for targeted edits, since line-range writes can break the file if the range is off.',
    tags: ['file', 'rw'],
    commentary:
      'Use this ability to either read from or write to the specified file based on the selected mode. It combines both read and write functionalities into a single operation for convenience and efficiency.',
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      id: file(),
      mode: field({
        name: 'mode',
        description:
          'operation mode: "read" to read content, "write" to write content',
        enum: ['read', 'write'],
      }),
      text: field({
        name: 'content',
        description: 'content to write (required for write mode)',
        optional: true,
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start from (1-indexed). For read: where to start reading. For write: where to start writing.',
        type: 'number',
        optional: true,
        min: 1,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end at, inclusive (1-indexed). For read: where to stop reading. For write: range to replace.',
        type: 'number',
        optional: true,
        min: 1,
      }),
    },
    file: '@file',
  }),

  'file/sql': createAuxiliaryTemplate<Schema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Query File with SQL',
    description:
      'Execute SQL queries on structured data files (CSV, Excel, JSON) to filter, aggregate, and analyze data.',
    tags: ['file', 'sql'],
    setup: '**NOTE:** You must link a file to use this ability.',
    path: '/api/auxiliary/skillset/ability/chatbotkit/file/sql',
    instruction: {
      sql: field({
        name: 'sql',
        description: 'the SQL query to execute for table "table1"',
      }),
      tables: {
        table1: {
          fileId: file(),
        },
      },
    },
    file: '@file',
    options: {
      auth: 'internal',
    },
  }),

  'pack/file': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install File Tools',
    description:
      'Installs tools to read, write, prepend, append, and replace content in the specified file.',
    tags: ['file', 'pack'],
    setup: '**NOTE:** You must link a file to use this ability.',
    instruction: {
      abilities: [
        'file/read',
        'file/write',
        'file/prepend',
        'file/append',
        'file/replace',
      ] satisfies (keyof typeof abilities)[],
    },
    file: '@file',
  }),

  // @todo for the methods bellow we need to make it an option to provide a
  // scope to limit files to the specific user (default), blueprint or contact
  // (if and when contact file associations are supported)

  'file/read[by-id]': createFileReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read File',
    description:
      'Read the content of a file. Supports optional line range to read specific sections. For efficiency, prefer reading larger chunks rather than many small sequential reads.',
    tags: ['file', 'read'],
    file: '@file',
    commentary:
      'This is the dynamic version of the file/read ability that allows the agent to specify automatically the file ID the user wants to read.',
    instruction: {
      fileId: field({
        name: 'fileId',
        description: 'the file Id that you want to read',
        placeholder: true,
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start reading from (1-indexed, line 1 is the first line)',
        type: 'number',
        optional: true,
        min: 1,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end reading at, inclusive (1-indexed). Prefer reading at least 100 lines or more per request to minimize round trips',
        type: 'number',
        optional: true,
        min: 1,
      }),
    },
  }),

  'file/write[by-id]': createFileWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write File',
    description:
      'Write content to a file. Without line parameters, overwrites the entire file. With startLine only, inserts before that line. With startLine and endLine, replaces that range. For small files prefer a full rewrite (omit the line parameters); for targeted edits prefer file/replace, which anchors on the surrounding text and cannot break the file with an off-by-one line range.',
    tags: ['file', 'write'],
    file: '@file',
    commentary:
      'This is the dynamic version of the file/write ability that allows the agent to specify automatically the file ID the user wants to write to.',
    instruction: {
      fileId: field({
        name: 'fileId',
        description: 'the file Id that you want to write to',
        placeholder: true,
      }),
      text: field({
        name: 'content',
        description: 'content to write to the file',
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start writing at (1-indexed). If only startLine is provided, content is inserted before this line. If both startLine and endLine are provided, lines in that range are replaced.',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end writing at, inclusive (1-indexed). Used with startLine to replace a range of lines.',
        type: 'number',
        optional: true,
      }),
    },
  }),

  'file/prepend[by-id]': createFilePrependTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Prepend to File',
    description: 'Prepend content to a file',
    tags: ['file', 'prepend'],
    file: '@file',
    commentary:
      'This is the dynamic version of the file/prepend ability that allows the agent to specify automatically the file ID the user wants to prepend to.',
    instruction: {
      fileId: field({
        name: 'fileId',
        description: 'the file Id that you want to prepend to',
        placeholder: true,
      }),
      text: field({
        name: 'content',
        description: 'content to prepend to the file',
      }),
    },
  }),

  'file/append[by-id]': createFileAppendTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Append to File',
    description: 'Append content to a file',
    tags: ['file', 'append'],
    file: '@file',
    commentary:
      'This is the dynamic version of the file/append ability that allows the agent to specify automatically the file ID the user wants to append to.',
    instruction: {
      fileId: field({
        name: 'fileId',
        description: 'the file Id that you want to append to',
        placeholder: true,
      }),
      text: field({
        name: 'content',
        description: 'content to append to the file',
      }),
    },
  }),

  'file/replace[by-id]': createFileReplaceTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Replace in File',
    description: 'Replace text in a file',
    tags: ['file', 'replace'],
    file: '@file',
    commentary:
      'This is the dynamic version of the file/replace ability that allows the agent to specify automatically the file ID the user wants to replace in.',
    instruction: {
      fileId: field({
        name: 'fileId',
        description: 'the file Id that you want to replace in',
        placeholder: true,
      }),
      search: field({
        name: 'search',
        description: 'text to search for',
      }),
      replace: field({
        name: 'replace',
        description: 'text to replace with',
      }),
      count: field({
        name: 'count',
        description:
          'number of occurrences to replace (optional, replaces all if not specified)',
        type: 'number',
      }),
    },
  }),

  'file/rw[by-id]': createFileRwTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read/Write File',
    description:
      'Read or write file content with a single combined operation. Use mode "read" to read content, or mode "write" to write content. Supports optional line ranges for both modes. For write edits, prefer a full rewrite for small files, or file/replace for targeted edits, since line-range writes can break the file if the range is off.',
    tags: ['file', 'rw'],
    file: '@file',
    commentary:
      'This is the dynamic version of the file/rw ability that allows the agent to specify automatically the file ID the user wants to read from or write to.',
    instruction: {
      fileId: field({
        name: 'fileId',
        description: 'the file Id that you want to read from or write to',
        placeholder: true,
      }),
      mode: field({
        name: 'mode',
        description:
          'operation mode: "read" to read content, "write" to write content',
        enum: ['read', 'write'],
      }),
      text: field({
        name: 'content',
        description: 'content to write (required for write mode)',
        optional: true,
      }),
      startLine: field({
        name: 'startLine',
        description:
          'the line number to start from (1-indexed). For read: where to start reading. For write: where to start writing.',
        type: 'number',
        optional: true,
      }),
      endLine: field({
        name: 'endLine',
        description:
          'the line number to end at, inclusive (1-indexed). For read: where to stop reading. For write: range to replace.',
        type: 'number',
        optional: true,
      }),
    },
  }),

  'file/sql[by-id]': createAuxiliaryTemplate<Schema>({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Query File with SQL',
    description:
      'Execute SQL queries on structured data files (CSV, Excel, JSON) to filter, aggregate, and analyze data.',
    tags: ['file', 'sql'],
    commentary:
      'This is the dynamic version of the file/sql ability that allows the agent to specify automatically the file ID the user wants to query.',
    path: '/api/auxiliary/skillset/ability/chatbotkit/file/sql',
    instruction: {
      sql: field({
        name: 'sql',
        description: 'the SQL query to execute',
      }),
      tables: {
        table1: {
          fileId: field({
            name: 'table1_fileId',
            description:
              'the file ID for the "table1" table where to load the data from',
            placeholder: true,
          }),
        },
      },
    },
    options: {
      auth: 'internal',
    },
  }),

  'pack/file[by-id]': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install File Tools',
    description:
      'Installs file tools into the conversation to read, write, prepend, append, and replace content in files by specifying the file ID.',
    tags: ['file', 'pack'],
    file: '@file',
    instruction: {
      abilities: [
        'file/read[by-id]',
        'file/write[by-id]',
        'file/prepend[by-id]',
        'file/append[by-id]',
        'file/replace[by-id]',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
