import {
  createPackTemplate,
  createShellEvalTemplate,
  createShellExecTemplate,
  createShellImportTemplate,
  createShellReadTemplate,
  createShellReplaceTemplate,
  createShellRwTemplate,
  createShellScriptTemplate,
  createShellSkillsetInstallTemplate,
  createShellWriteTemplate,
  field,
} from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit shell abilities.
 */
const abilities = {
  'shell/exec': createShellExecTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute Shell Command',
    description: 'Execute a shell command or script',
    tags: ['shell', 'bash'],
    space: '#space',
    instruction: {
      cmd: field({
        name: 'command',
        description: 'the bash shell command or script',
      }),
      timeout: field({
        name: 'timeout',
        description: 'timeout in milliseconds (max 300000ms/5min)',
        type: 'number',
        default: 60000,
        max: 300000,
        optional: true,
      }),
    },
  }),

  'shell/read': createShellReadTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read File from Shell Environment',
    description:
      'Read the content of a file in a shell environment. Supports optional line range to read specific sections. For efficiency, prefer reading larger chunks rather than many small sequential reads. Supports parallel reads of different sections when needed upfront.',
    tags: ['shell', 'bash', 'file', 'read'],
    space: '#space',
    instruction: {
      file: field({
        name: 'path',
        description: 'absolute path to the file to read',
      }),
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
  }),

  'shell/write': createShellWriteTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Write File in Shell Environment',
    description:
      'Write content to a file in a shell environment. Without line parameters, overwrites the entire file. With startLine only, inserts before that line. With startLine and endLine, replaces that range. For small files prefer a full rewrite (omit the line parameters); for targeted edits prefer shell/replace, which anchors on the surrounding text and cannot break the file with an off-by-one line range.',
    tags: ['shell', 'bash', 'file', 'write'],
    space: '#space',
    instruction: {
      file: field({
        name: 'path',
        description: 'absolute path to the file to write to',
      }),
      contents: field({
        name: 'content',
        description: 'the content to write to the file',
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

  'shell/rw': createShellRwTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Read/Write File in Shell Environment',
    description:
      'Read or write file content in a shell environment with a single combined operation. Use mode "read" to read content, or mode "write" to write content. Supports optional line ranges for both modes. For write edits, prefer a full rewrite for small files, or shell/replace for targeted edits, since line-range writes can break the file if the range is off.',
    tags: ['shell', 'bash', 'file', 'rw'],
    space: '#space',
    instruction: {
      file: field({
        name: 'path',
        description: 'absolute path to the file to read from or write to',
      }),
      mode: field({
        name: 'mode',
        description:
          'operation mode: "read" to read content, "write" to write content',
        enum: ['read', 'write'],
      }),
      contents: field({
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

  'shell/replace': createShellReplaceTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Replace in File in Shell Environment',
    description:
      'Find and replace text in a file in a shell environment. Prefer this over line-range writes for targeted edits: it anchors on the surrounding text instead of line numbers, so it cannot break the file structure with an off-by-one range. The result includes a preview of the edited region so you can verify the change.',
    tags: ['shell', 'bash', 'file', 'replace'],
    space: '#space',
    instruction: {
      file: field({
        name: 'path',
        description: 'absolute path to the file to edit',
      }),
      search: field({
        name: 'search',
        description: 'the exact text to search for',
      }),
      replace: field({
        name: 'replace',
        description: 'the text to replace each match with',
      }),
      count: field({
        name: 'count',
        description:
          'number of occurrences to replace (optional, replaces all if not specified)',
        type: 'number',
        optional: true,
      }),
    },
  }),

  'shell/import': createShellImportTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Import URL to Shell Environment',
    description:
      'Import data from a URL and save it to a file in the shell environment. Supports HTTP/HTTPS URLs and can handle both text and binary content.',
    tags: ['shell', 'bash', 'import', 'url'],
    space: '#space',
    instruction: {
      url: field({
        name: 'url',
        description: 'the URL to import data from (must be http or https)',
      }),
      path: field({
        name: 'path',
        description: 'the destination path in the shell sandbox',
      }),
    },
  }),

  'shell/skillset/install[by-id]': createShellSkillsetInstallTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Skillset as Shell Command',
    description:
      'Install a skillset as an executable shell command in the sandbox environment. The skillset abilities become available as subcommands.',
    tags: ['shell', 'bash', 'skillset', 'install'],
    space: '#space',
    instruction: {
      skillsetId: field({
        name: 'skillsetId',
        description: 'the ID of the skillset to install',
        placeholder: true,
      }),
    },
  }),

  'shell/exec/python': createShellScriptTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute Python Script',
    description: 'Execute a Python script',
    tags: ['shell', 'python', 'script'],
    space: '#space',
    instruction: {
      source: field({
        name: 'script',
        description: 'the Python script content',
      }),
      runtime: 'python',
      timeout: field({
        name: 'timeout',
        description: 'timeout in milliseconds (max 300000ms/5min)',
        type: 'number',
        default: 60000,
        max: 300000,
        optional: true,
      }),
    },
  }),

  'shell/exec/node': createShellScriptTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Execute Node.js Script',
    description: 'Execute a Node.js script',
    tags: ['shell', 'node', 'script'],
    space: '#space',
    instruction: {
      source: field({
        name: 'script',
        description: 'the Node.js script content',
      }),
      runtime: 'node',
      timeout: field({
        name: 'timeout',
        description: 'timeout in milliseconds (max 300000ms/5min)',
        type: 'number',
        default: 60000,
        max: 300000,
        optional: true,
      }),
    },
  }),

  'shell/eval/python': createShellEvalTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Evaluate Python Code',
    description: 'Evaluate Python code using a code interpreter (python3)',
    tags: ['shell', 'python', 'eval', 'interpreter'],
    space: '#space',
    instruction: {
      code: field({
        name: 'code',
        description: 'the Python code to evaluate',
      }),
      runtime: 'python',
      timeout: field({
        name: 'timeout',
        description: 'timeout in milliseconds (max 300000ms/5min)',
        type: 'number',
        default: 60000,
        max: 300000,
        optional: true,
      }),
    },
  }),

  'shell/eval/node': createShellEvalTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Evaluate Node.js Code',
    description: 'Evaluate JavaScript code using a code interpreter (node.js)',
    tags: ['shell', 'node', 'eval', 'interpreter'],
    space: '#space',
    instruction: {
      code: field({
        name: 'code',
        description: 'the JavaScript code to evaluate',
      }),
      runtime: 'node',
      timeout: field({
        name: 'timeout',
        description: 'timeout in milliseconds (max 300000ms/5min)',
        type: 'number',
        default: 60000,
        max: 300000,
        optional: true,
      }),
    },
  }),

  'pack/shell': createPackTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install Shell Tools',
    description:
      'Installs shell tools into the conversation to execute commands and scripts.',
    tags: ['shell', 'bash'],
    space: '#space',
    instruction: {
      abilities: [
        'shell/exec',
        'shell/rw',
        'shell/replace',
        'shell/import',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
