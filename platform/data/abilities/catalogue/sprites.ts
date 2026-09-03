import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Sprites.dev abilities.
 *
 * Sprites.dev provides programmable virtual environments (Sprites) with APIs for
 * command execution, filesystem management, checkpoints, and service management.
 *
 * @see https://docs.sprites.dev/api/v001-rc30/
 */
const abilities = {
  // ===== SPRITE MANAGEMENT =====

  'sprites/sprite/create': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Create Sprite',
    description: 'Create a new sprite with a unique name.',
    commentary:
      'The sprite starts in a cold state and warms up on first request.',
    tags: ['sprites', 'sprite', 'create', 'virtual-environment'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1/sprites',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        name: field({
          name: 'name',
          description: 'unique name for the sprite within the organization',
        }),
        wait_for_capacity: field({
          name: 'waitForCapacity',
          type: 'boolean',
          description: 'whether to wait for VM capacity before returning',
          optional: true,
          default: false,
        }),
        auth: field({
          name: 'auth',
          description: 'authentication mode for the sprite',
          enum: ['sprite', 'public'],
          optional: true,
          default: 'sprite',
        }),
      },
    },
  }),

  'sprites/sprite/list': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'List Sprites',
    description:
      'List all sprites for the authenticated organization with optional filtering and pagination.',
    tags: ['sprites', 'sprite', 'list'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1/sprites',
      headers: {
        Authorization: secret(),
      },
      query: {
        prefix: field({
          name: 'prefix',
          description: 'filter sprites by name prefix',
          optional: true,
        }),
        max_results: field({
          name: 'maxResults',
          type: 'number',
          description: 'maximum results to return (1-50, default: 50)',
          optional: true,
          default: 50,
        }),
        continuation_token: field({
          name: 'continuationToken',
          description: 'token from previous response for pagination',
          optional: true,
        }),
      },
    },
  }),

  'sprites/sprite/fetch': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Get Sprite',
    description: 'Retrieve details for a specific sprite by name.',
    tags: ['sprites', 'sprite', 'get', 'fetch'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/sprite/update': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Update Sprite',
    description: 'Update settings for an existing sprite.',
    commentary: 'Currently supports updating URL authentication settings.',
    tags: ['sprites', 'sprite', 'update'],
    secret: '@sprites',
    instruction: {
      method: 'PUT',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        url_settings: {
          auth: field({
            name: 'auth',
            description: 'authentication mode for the sprite',
            enum: ['sprite', 'public'],
          }),
        },
      },
    },
  }),

  'sprites/sprite/delete': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Delete Sprite',
    description: 'Permanently delete a sprite and all associated resources.',
    commentary: 'This action cannot be undone.',
    tags: ['sprites', 'sprite', 'delete'],
    secret: '@sprites',
    instruction: {
      method: 'DELETE',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // ===== CHECKPOINT MANAGEMENT =====

  'sprites/checkpoint/create': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Create Checkpoint',
    description: 'Create a new checkpoint of the current sprite state.',
    commentary: 'Captures complete filesystem for instant rollback.',
    tags: ['sprites', 'checkpoint', 'create', 'snapshot'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/checkpoint',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        comment: field({
          name: 'comment',
          description: 'optional comment describing the checkpoint',
          optional: true,
        }),
      },
    },
  }),

  'sprites/checkpoint/list': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'List Checkpoints',
    description: 'List all checkpoints for a sprite.',
    tags: ['sprites', 'checkpoint', 'list'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/checkpoints',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/checkpoint/fetch': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Get Checkpoint',
    description: 'Get details of a specific checkpoint.',
    tags: ['sprites', 'checkpoint', 'get', 'fetch'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/checkpoints/',
        field({
          name: 'checkpointId',
          description: 'the checkpoint ID (e.g., v1, v2)',
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/checkpoint/restore': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Restore Checkpoint',
    description: 'Restore a sprite to a specific checkpoint.',
    commentary: 'Returns streaming progress.',
    tags: ['sprites', 'checkpoint', 'restore', 'rollback'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/checkpoints/',
        field({
          name: 'checkpointId',
          description: 'the checkpoint ID to restore to',
        }),
        '/restore',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  // ===== EXEC (COMMAND EXECUTION) =====

  'sprites/exec/run': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Execute Command',
    description:
      'Execute a command inside a sprite and return the output. Use this to run shell commands, scripts, or any executable in the virtual environment.',
    commentary:
      'This endpoint uses HTTP POST for non-TTY command execution. For interactive sessions requiring TTY, use WebSocket connections instead.',
    tags: ['sprites', 'exec', 'command', 'run'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/exec',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        cmd: field({
          name: 'command',
          description:
            'command to execute (can be repeated for command + args)',
        }),
        path: field({
          name: 'execPath',
          description:
            'explicit path to executable (defaults to first cmd value or bash)',
          optional: true,
        }),
        stdin: field({
          name: 'stdin',
          type: 'boolean',
          description: 'enable stdin from request body (default: false)',
          optional: true,
        }),
        env: field({
          name: 'env',
          description:
            'environment variables in KEY=VALUE format (can be repeated)',
          optional: true,
        }),
        dir: field({
          name: 'workingDir',
          description: 'working directory for the command',
          optional: true,
        }),
      },
    },
  }),

  'sprites/exec/list': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'List Exec Sessions',
    description: 'List active exec sessions for a sprite.',
    tags: ['sprites', 'exec', 'session', 'list'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/exec',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/exec/kill': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Kill Exec Session',
    description: 'Kill an exec session by session ID.',
    commentary: 'Returns streaming progress.',
    tags: ['sprites', 'exec', 'session', 'kill', 'terminate'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/exec/',
        field({
          name: 'sessionId',
          description: 'the session ID to kill',
        }),
        '/kill',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        signal: field({
          name: 'signal',
          description: 'signal to send to the process',
          optional: true,
          default: 'SIGTERM',
        }),
        timeout: field({
          name: 'timeout',
          description:
            'timeout waiting for process to exit, e.g., "10s", "30s"',
          optional: true,
        }),
      },
    },
  }),

  // ===== FILESYSTEM =====

  'sprites/fs/read': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Read File',
    description: 'Read file contents from the sprite filesystem.',
    commentary: 'Returns raw file bytes.',
    tags: ['sprites', 'filesystem', 'file', 'read'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/read',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        path: field({
          name: 'filePath',
          description: 'path to the file to read',
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
      },
    },
  }),

  'sprites/fs/write': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Write File',
    description: 'Write content to a file in the sprite filesystem.',
    commentary: 'Request body contains raw file bytes.',
    tags: ['sprites', 'filesystem', 'file', 'write'],
    secret: '@sprites',
    instruction: {
      method: 'PUT',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/write',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/octet-stream',
      },
      query: {
        path: field({
          name: 'filePath',
          description: 'path to the file to write',
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
        mode: field({
          name: 'mode',
          description: "file permissions in octal (e.g., '0644')",
          optional: true,
        }),
        mkdir: field({
          name: 'mkdir',
          type: 'boolean',
          description: "create parent directories if they don't exist",
          optional: true,
        }),
      },
    },
  }),

  'sprites/fs/list': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'List Directory',
    description: 'List directory contents in the sprite filesystem.',
    tags: ['sprites', 'filesystem', 'directory', 'list'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/list',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        path: field({
          name: 'dirPath',
          description: 'path to the directory to list',
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
      },
    },
  }),

  'sprites/fs/delete': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Delete File or Directory',
    description: 'Delete a file or directory from the sprite filesystem.',
    tags: ['sprites', 'filesystem', 'file', 'directory', 'delete'],
    secret: '@sprites',
    instruction: {
      method: 'DELETE',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/delete',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        path: field({
          name: 'path',
          description: 'path to the file or directory to delete',
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
        recursive: field({
          name: 'recursive',
          type: 'boolean',
          description: 'delete directories recursively',
          optional: true,
          default: false,
        }),
        asRoot: field({
          name: 'asRoot',
          type: 'boolean',
          description: 'run operation as root user',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'sprites/fs/rename': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Rename File or Directory',
    description: 'Rename or move a file or directory in the sprite filesystem.',
    tags: ['sprites', 'filesystem', 'file', 'directory', 'rename', 'move'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/rename',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        source: field({
          name: 'source',
          description: 'source path of the file or directory',
        }),
        dest: field({
          name: 'dest',
          description: 'destination path',
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
        asRoot: field({
          name: 'asRoot',
          type: 'boolean',
          description: 'run operation as root user',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'sprites/fs/copy': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Copy File or Directory',
    description: 'Copy a file or directory in the sprite filesystem.',
    tags: ['sprites', 'filesystem', 'file', 'directory', 'copy'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/copy',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        source: field({
          name: 'source',
          description: 'source path of the file or directory',
        }),
        dest: field({
          name: 'dest',
          description: 'destination path',
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
        recursive: field({
          name: 'recursive',
          type: 'boolean',
          description: 'copy directories recursively',
          optional: true,
          default: false,
        }),
        preserveAttrs: field({
          name: 'preserveAttrs',
          type: 'boolean',
          description: 'preserve file attributes',
          optional: true,
          default: false,
        }),
        asRoot: field({
          name: 'asRoot',
          type: 'boolean',
          description: 'run operation as root user',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'sprites/fs/chmod': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Change File Mode',
    description:
      'Change file or directory permissions in the sprite filesystem.',
    tags: ['sprites', 'filesystem', 'file', 'permissions', 'chmod'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/chmod',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        path: field({
          name: 'path',
          description: 'path to the file or directory',
        }),
        mode: field({
          name: 'mode',
          description: "file permissions mode (e.g., '0644', '0755')",
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
        recursive: field({
          name: 'recursive',
          type: 'boolean',
          description: 'apply permissions recursively',
          optional: true,
          default: false,
        }),
        asRoot: field({
          name: 'asRoot',
          type: 'boolean',
          description: 'run operation as root user',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  'sprites/fs/chown': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Change File Owner',
    description: 'Change file or directory ownership in the sprite filesystem.',
    tags: ['sprites', 'filesystem', 'file', 'ownership', 'chown'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/fs/chown',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        path: field({
          name: 'path',
          description: 'path to the file or directory',
        }),
        uid: field({
          name: 'uid',
          description: 'user ID or username for the new owner',
          optional: true,
        }),
        gid: field({
          name: 'gid',
          description: 'group ID or group name for the new group',
          optional: true,
        }),
        workingDir: field({
          name: 'workingDir',
          description: 'working directory for resolving relative paths',
          optional: true,
        }),
        recursive: field({
          name: 'recursive',
          type: 'boolean',
          description: 'apply ownership changes recursively',
          optional: true,
          default: false,
        }),
        asRoot: field({
          name: 'asRoot',
          type: 'boolean',
          description: 'run operation as root user',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  // ===== NETWORK POLICY =====

  'sprites/policy/fetch': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Get Network Policy',
    description: 'Get the current network policy configuration for a sprite.',
    commentary:
      'Policies control outbound network access using DNS-based filtering.',
    tags: ['sprites', 'policy', 'network', 'get', 'fetch'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/policy/network',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/policy/update': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Set Network Policy',
    description: 'Update the network policy configuration for a sprite.',
    commentary: 'Changes apply immediately.',
    tags: ['sprites', 'policy', 'network', 'update', 'set'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/policy/network',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        rules: array({
          items: object({
            shape: {
              domain: field({
                name: 'domain',
                description:
                  'domain to match (e.g., "github.com", "*.npmjs.org", "*" for all)',
              }),
              action: field({
                name: 'action',
                description: 'policy action for the domain',
                enum: ['allow', 'deny'],
              }),
            },
          }),
        }),
      },
    },
  }),

  // ===== SERVICES =====

  'sprites/service/list': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'List Services',
    description:
      'List all configured services and their current state for a sprite.',
    tags: ['sprites', 'service', 'list'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/services',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/service/fetch': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Get Service',
    description: 'Get details of a specific service.',
    tags: ['sprites', 'service', 'get', 'fetch'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/services/',
        field({ name: 'serviceName', description: 'the name of the service' }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'sprites/service/create': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Create Service',
    description: 'Create or update a service definition for a sprite.',
    tags: ['sprites', 'service', 'create', 'update'],
    secret: '@sprites',
    instruction: {
      method: 'PUT',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/services/',
        field({ name: 'serviceName', description: 'the name of the service' }),
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      query: {
        duration: field({
          name: 'duration',
          description:
            'time to monitor logs after starting (default: 5s), e.g., "5s", "10s"',
          optional: true,
        }),
      },
      body: {
        cmd: field({
          name: 'cmd',
          description: 'command to execute (e.g., "python", "node")',
        }),
        args: array({
          items: field({
            name: 'arg',
            description: 'command argument',
          }),
        }),
        needs: array({
          items: field({
            name: 'dependency',
            description: 'service dependency (started first)',
          }),
        }),
        http_port: field({
          name: 'httpPort',
          type: 'number',
          description: 'HTTP port for proxy routing',
          optional: true,
        }),
      },
    },
  }),

  'sprites/service/start': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Start Service',
    description: 'Start a service.',
    commentary: 'Returns streaming NDJSON with stdout/stderr.',
    tags: ['sprites', 'service', 'start'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/services/',
        field({ name: 'serviceName', description: 'the name of the service' }),
        '/start',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        duration: field({
          name: 'duration',
          description:
            'time to monitor logs after starting (default: 5s), e.g., "5s", "10s"',
          optional: true,
        }),
      },
    },
  }),

  'sprites/service/stop': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Stop Service',
    description: 'Stop a running service.',
    commentary: 'Returns streaming NDJSON with stop progress.',
    tags: ['sprites', 'service', 'stop'],
    secret: '@sprites',
    instruction: {
      method: 'POST',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/services/',
        field({ name: 'serviceName', description: 'the name of the service' }),
        '/stop',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        timeout: field({
          name: 'timeout',
          description:
            'timeout waiting for service to stop (default: 10s), e.g., "10s", "30s"',
          optional: true,
        }),
      },
    },
  }),

  'sprites/service/logs': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Get Service Logs',
    description: 'Stream logs for a service.',
    tags: ['sprites', 'service', 'logs'],
    secret: '@sprites',
    instruction: {
      method: 'GET',
      url: 'https://api.sprites.dev/v1',
      path: [
        '/sprites/',
        field({ name: 'spriteName', description: 'the name of the sprite' }),
        '/services/',
        field({ name: 'serviceName', description: 'the name of the service' }),
        '/logs',
      ],
      headers: {
        Authorization: secret(),
      },
      query: {
        lines: field({
          name: 'lines',
          type: 'number',
          description:
            'number of lines to return from log buffer (default: all)',
          optional: true,
        }),
        duration: field({
          name: 'duration',
          description:
            'time to follow new logs (default: 0, no follow), e.g., "10s", "1m"',
          optional: true,
        }),
      },
    },
  }),

  'sprites/api/call': createFetchTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Call Sprites API',
    description:
      'Make a generic API call to Sprites. This is a flexible template that can be used to call any Sprites API endpoint by specifying the method, URL, and request body.',
    tags: ['sprites', 'api', 'call', 'generic'],
    secret: '@sprites',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Sprites API endpoint to call',
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

  // ===== PACK TEMPLATES =====

  'pack/sprites': createPackTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Install Sprites Tools',
    description:
      'Installs Sprites tools into the conversation.dev. You can manage virtual environments (sprites), execute commands, manage filesystems, create checkpoints, and configure services.',
    tags: ['sprites', 'pack', 'beta'],
    secret: '@sprites',
    instruction: {
      abilities: [
        'sprites/sprite/create',
        'sprites/sprite/list',
        'sprites/sprite/fetch',
        'sprites/sprite/update',
        'sprites/sprite/delete',
        'sprites/checkpoint/create',
        'sprites/checkpoint/list',
        'sprites/checkpoint/fetch',
        'sprites/checkpoint/restore',
        'sprites/exec/run',
        'sprites/exec/list',
        'sprites/exec/kill',
        'sprites/fs/read',
        'sprites/fs/write',
        'sprites/fs/list',
        'sprites/fs/delete',
        'sprites/fs/rename',
        'sprites/fs/copy',
        'sprites/fs/chmod',
        'sprites/fs/chown',
        'sprites/policy/fetch',
        'sprites/policy/update',
        'sprites/service/list',
        'sprites/service/fetch',
        'sprites/service/create',
        'sprites/service/start',
        'sprites/service/stop',
        'sprites/service/logs',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/sprites[read-only]': createPackTemplate({
    provider: 'sprites',
    icon: '@logo/sprites.dev',
    name: 'Install Sprites Search Tools',
    description:
      'Installs read-only Sprites tools into the conversation.dev. You can list sprites, view checkpoints, list exec sessions, browse filesystems, and view service status without modification.',
    tags: ['sprites', 'pack', 'beta'],
    secret: '@sprites',
    instruction: {
      abilities: [
        'sprites/sprite/list',
        'sprites/sprite/fetch',
        'sprites/checkpoint/list',
        'sprites/checkpoint/fetch',
        'sprites/exec/list',
        'sprites/fs/read',
        'sprites/fs/list',
        'sprites/policy/fetch',
        'sprites/service/list',
        'sprites/service/fetch',
        'sprites/service/logs',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
