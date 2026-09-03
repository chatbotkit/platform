import {
  array,
  createFetchTemplate,
  createPackTemplate,
  field,
  object,
  secret,
} from '@/lib/ability.template'

/**
 * Catalogue of Cloudflare Sandbox bridge HTTP abilities.
 *
 * These templates cover the bridge endpoints that map cleanly to fetch-style
 * abilities. The WebSocket PTY route and tar archive persist/hydrate flows are
 * intentionally left out because they do not fit the current ability transport
 * model well.
 *
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/
 */

const CLOUDFLARE_SANDBOX_SETUP = `To use Cloudflare Sandbox bridge abilities:

1. Deploy the Sandbox bridge Worker documented at https://developers.cloudflare.com/sandbox/bridge/
2. Use the deployed Worker origin as the base URL, e.g. https://sandbox.example.com
3. Store your bridge token as the Cloudflare Sandbox bridge API key secret for these abilities

The base URL should point at the bridge origin without a trailing slash. These abilities append the documented /v1 routes automatically.`

function baseUrlField() {
  return field({
    name: 'baseUrl',
    description:
      'the Cloudflare Sandbox bridge base URL without a trailing slash, e.g. https://sandbox.example.com',
    placeholder: true,
  })
}

function sandboxIdField() {
  return field({
    name: 'sandboxId',
    description: 'the sandbox ID returned by the create sandbox ability',
    placeholder: true,
  })
}

function sessionIdField() {
  return field({
    name: 'sessionId',
    description:
      'optional session ID returned by the create session ability for session-scoped exec or file operations',
    placeholder: true,
    optional: true,
  })
}

const abilities = {
  'cloudflare/sandbox/create': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Create Cloudflare Sandbox',
    description: 'Create a new Cloudflare Sandbox instance.',
    commentary:
      'Returns a sandbox ID. Use that ID with the other Cloudflare Sandbox bridge abilities.',
    tags: ['cloudflare', 'sandbox', 'create'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/sandbox'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/delete': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Delete Cloudflare Sandbox',
    description: 'Destroy a Cloudflare Sandbox instance.',
    commentary:
      'This is best-effort on the bridge side. Unknown sandbox IDs return 204.',
    tags: ['cloudflare', 'sandbox', 'delete'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'DELETE',
      url: baseUrlField(),
      path: ['/v1/sandbox/', sandboxIdField()],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/running/fetch': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Check Cloudflare Sandbox Liveness',
    description: 'Check whether a Cloudflare Sandbox container is running.',
    tags: ['cloudflare', 'sandbox', 'running', 'fetch'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'GET',
      url: baseUrlField(),
      path: ['/v1/sandbox/', sandboxIdField(), '/running'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/session/create': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Create Cloudflare Sandbox Session',
    description: 'Create an isolated execution session inside a sandbox.',
    commentary:
      'Sessions isolate working directory, environment variables, and command execution state.',
    tags: ['cloudflare', 'sandbox', 'session', 'create'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/sandbox/', sandboxIdField(), '/session'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        id: field({
          name: 'id',
          description: 'optional custom session ID',
          placeholder: true,
          optional: true,
        }),
        cwd: field({
          name: 'cwd',
          description:
            'optional absolute working directory inside /workspace for the session',
          placeholder: true,
          optional: true,
        }),
        env: object({
          name: 'env',
          description:
            'optional environment variables for the session as a key-value object',
          optional: true,
          shape: {},
        }),
      },
    },
  }),

  'cloudflare/sandbox/session/delete': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Delete Cloudflare Sandbox Session',
    description: 'Delete a session from a Cloudflare Sandbox.',
    tags: ['cloudflare', 'sandbox', 'session', 'delete'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'DELETE',
      url: baseUrlField(),
      path: [
        '/v1/sandbox/',
        sandboxIdField(),
        '/session/',
        field({
          name: 'deleteSessionId',
          description: 'the session ID to delete',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/command/create': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Execute Cloudflare Sandbox Command',
    description: 'Run a command inside a Cloudflare Sandbox via the bridge.',
    commentary:
      'The bridge returns a text/event-stream response with stdout, stderr, exit, and error events.',
    tags: ['cloudflare', 'sandbox', 'command', 'exec', 'create'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/sandbox/', sandboxIdField(), '/exec'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
        'Session-Id': sessionIdField(),
      },
      body: {
        argv: array({
          name: 'argv',
          description:
            'the command and arguments as separate argv items; each item is escaped by the bridge before execution',
          minItems: 1,
          items: field({
            name: 'argvItem',
            description: 'one argv token',
            placeholder: true,
          }),
        }),
        timeout_ms: field({
          name: 'timeoutMs',
          type: 'number',
          description: 'optional command timeout in milliseconds',
          optional: true,
        }),
        cwd: field({
          name: 'cwd',
          description:
            'optional absolute working directory inside /workspace for this command',
          placeholder: true,
          optional: true,
        }),
      },
    },
  }),

  'cloudflare/sandbox/file/fetch': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Read Cloudflare Sandbox File',
    description:
      'Read a text file from /workspace inside a Cloudflare Sandbox.',
    commentary:
      'The bridge returns raw bytes. This template is best suited for text files inside /workspace.',
    tags: ['cloudflare', 'sandbox', 'file', 'fetch'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'GET',
      url: baseUrlField(),
      path: [
        '/v1/sandbox/',
        sandboxIdField(),
        '/file/',
        field({
          name: 'filePath',
          description:
            'path relative to /workspace without a leading slash, e.g. src/index.ts',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Session-Id': sessionIdField(),
      },
    },
  }),

  'cloudflare/sandbox/file/update': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Write Cloudflare Sandbox File',
    description: 'Write text content to a file inside a Cloudflare Sandbox.',
    commentary:
      'The bridge accepts raw bytes. This template is intended for text content written into /workspace.',
    tags: ['cloudflare', 'sandbox', 'file', 'update'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'PUT',
      url: baseUrlField(),
      path: [
        '/v1/sandbox/',
        sandboxIdField(),
        '/file/',
        field({
          name: 'writeFilePath',
          description:
            'path relative to /workspace without a leading slash, e.g. tmp/output.txt',
          placeholder: true,
        }),
      ],
      headers: {
        Authorization: secret(),
        'Session-Id': sessionIdField(),
        'Content-Type': 'application/octet-stream',
      },
      body: field({
        name: 'content',
        description: 'the text content to write to the target file',
      }),
    },
  }),

  'cloudflare/sandbox/mount/create': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Mount Bucket Into Cloudflare Sandbox',
    description: 'Mount an S3-compatible bucket into a Cloudflare Sandbox.',
    commentary:
      'Use this for R2 or other S3-compatible storage. The mount path must be an absolute container path.',
    tags: ['cloudflare', 'sandbox', 'bucket', 'mount', 'create'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/sandbox/', sandboxIdField(), '/mount'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        bucket: field({
          name: 'bucket',
          description: 'the bucket name to mount',
          placeholder: true,
        }),
        mountPath: field({
          name: 'mountPath',
          description:
            'absolute path inside the container where the bucket should be mounted',
          placeholder: true,
        }),
        options: object({
          name: 'options',
          description: 'mount configuration',
          shape: {
            endpoint: field({
              name: 'endpoint',
              description:
                'the S3-compatible endpoint URL, e.g. https://ACCOUNT_ID.r2.cloudflarestorage.com',
              placeholder: true,
            }),
            readOnly: field({
              name: 'readOnly',
              type: 'boolean',
              description: 'whether to mount the bucket as read-only',
              optional: true,
            }),
            prefix: field({
              name: 'prefix',
              description:
                'optional prefix within the bucket - must start and end with /',
              placeholder: true,
              optional: true,
            }),
            credentials: object({
              name: 'credentials',
              description:
                'optional explicit credentials; omit to use worker secrets when available',
              optional: true,
              shape: {
                accessKeyId: field({
                  name: 'accessKeyId',
                  description: 'the S3-compatible access key ID',
                  placeholder: true,
                }),
                secretAccessKey: field({
                  name: 'secretAccessKey',
                  description: 'the S3-compatible secret access key',
                  placeholder: true,
                }),
              },
            }),
          },
        }),
      },
    },
  }),

  'cloudflare/sandbox/mount/delete': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Unmount Bucket From Cloudflare Sandbox',
    description:
      'Unmount a previously mounted bucket from a Cloudflare Sandbox.',
    commentary:
      'The bridge removes the mount and then best-effort cleans up the empty mount directory.',
    tags: ['cloudflare', 'sandbox', 'bucket', 'mount', 'delete'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/sandbox/', sandboxIdField(), '/unmount'],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: {
        mountPath: field({
          name: 'mountPath',
          description: 'absolute mount path to unmount, e.g. /mnt/data',
          placeholder: true,
        }),
      },
    },
  }),

  'cloudflare/sandbox/openapi/fetch': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Fetch Cloudflare Sandbox OpenAPI Schema',
    description: 'Fetch the bridge OpenAPI JSON schema.',
    tags: ['cloudflare', 'sandbox', 'openapi', 'fetch'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'GET',
      url: baseUrlField(),
      path: ['/v1/openapi.json'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/pool/stats/fetch': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Fetch Cloudflare Sandbox Pool Stats',
    description:
      'Fetch warm-pool statistics from the Cloudflare Sandbox bridge.',
    tags: ['cloudflare', 'sandbox', 'pool', 'stats', 'fetch'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'GET',
      url: baseUrlField(),
      path: ['/v1/pool/stats'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/pool/prime/create': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Prime Cloudflare Sandbox Warm Pool',
    description:
      'Start the warm-pool priming loop on the Cloudflare Sandbox bridge.',
    tags: ['cloudflare', 'sandbox', 'pool', 'prime', 'create'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/pool/prime'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/pool/prewarmed/delete': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Shutdown Cloudflare Sandbox Prewarmed Containers',
    description:
      'Stop idle prewarmed containers in the Cloudflare Sandbox warm pool.',
    tags: ['cloudflare', 'sandbox', 'pool', 'prewarmed', 'delete'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    secret: '@cloudflare[key]',
    instruction: {
      method: 'POST',
      url: baseUrlField(),
      path: ['/v1/pool/shutdown-prewarmed'],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'cloudflare/sandbox/health/fetch': createFetchTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Fetch Cloudflare Sandbox Bridge Health',
    description: 'Run the unauthenticated bridge health check.',
    tags: ['cloudflare', 'sandbox', 'health', 'fetch'],
    setup: CLOUDFLARE_SANDBOX_SETUP,
    instruction: {
      method: 'GET',
      url: baseUrlField(),
      path: ['/health'],
    },
  }),

  'pack/cloudflare/sandbox': createPackTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Install Cloudflare Sandbox Tools',
    description:
      'Install Cloudflare Sandbox bridge tools for sandbox lifecycle, sessions, command execution, file access, bucket mounts, and pool operations.',
    tags: ['cloudflare', 'sandbox', 'pack'],
    secret: '@cloudflare[key]',
    instruction: {
      abilities: [
        'cloudflare/sandbox/create',
        'cloudflare/sandbox/delete',
        'cloudflare/sandbox/running/fetch',
        'cloudflare/sandbox/session/create',
        'cloudflare/sandbox/session/delete',
        'cloudflare/sandbox/command/create',
        'cloudflare/sandbox/file/fetch',
        'cloudflare/sandbox/file/update',
        'cloudflare/sandbox/mount/create',
        'cloudflare/sandbox/mount/delete',
        'cloudflare/sandbox/openapi/fetch',
        'cloudflare/sandbox/pool/stats/fetch',
        'cloudflare/sandbox/pool/prime/create',
        'cloudflare/sandbox/pool/prewarmed/delete',
        'cloudflare/sandbox/health/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/cloudflare/sandbox[read-only]': createPackTemplate({
    provider: 'cloudflare',
    icon: '@logo/cloudflare.com',
    name: 'Install Cloudflare Sandbox Read-Only Tools',
    description:
      'Install read-only Cloudflare Sandbox bridge tools for health, OpenAPI inspection, pool stats, sandbox liveness, and text file reads.',
    tags: ['cloudflare', 'sandbox', 'pack'],
    secret: '@cloudflare[key]',
    instruction: {
      abilities: [
        'cloudflare/sandbox/running/fetch',
        'cloudflare/sandbox/file/fetch',
        'cloudflare/sandbox/openapi/fetch',
        'cloudflare/sandbox/pool/stats/fetch',
        'cloudflare/sandbox/health/fetch',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
