import 'dotenv/config'

import {
  BlueprintVisibility,
  BotVisibility,
  DatasetFileAttachmentType,
  DatasetVisibility,
  FileVisibility,
  MessageType,
  PolicyType,
  ResourceState,
  Schedule,
  SecretKind,
  SecretType,
  SecretVisibility,
  SkillsetVisibility,
  SyncStatus,
  TaskOutcome,
  TaskStatus,
  Trigger,
} from '@/prisma/types'

import { getExternalAPIHostURL } from '@/lib/host'

import { DatasetFilterSchema } from '@/lib/dataset.filter'
import { exit } from '@/lib/debug'
import { createSwaggerSpec } from '@/lib/swagger'

import {
  InlineDatasetsSchema,
  InlineSkillsetsSchema,
} from '@/schemas/inlineExtensions'

import fs from 'node:fs'
import { zodToJsonSchema } from 'zod-to-json-schema'

export const swaggerDefinitionV1 = {
  failOnErrors: true,

  definition: {
    openapi: '3.0.0',

    info: {
      title: 'CBK API',
      version: `v1 (build ${
        process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 4) || Date.now()
      })`,
    },

    servers: [
      {
        // @note the build-time spec carries the deployment's own API origin,
        // derived the same way the runtime endpoint (pages/api/v1/spec.ts)
        // derives it - the API_URL origin, else the site URL under /api
        url: getExternalAPIHostURL('/v1'),
      },
    ],

    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },

      parameters: {
        TimezoneHeader: {
          name: 'X-Timezone',
          in: 'header',
          description: 'The timezone to use for the request',
          required: false,
          schema: {
            type: 'string',
            example: 'Europe/London',
          },
        },
      },

      schemas: {
        Message: {
          type: 'object',
          description: 'A message in the conversation',
          properties: {
            type: {
              $ref: '#/components/schemas/MessageType',
            },
            text: {
              type: 'string',
              description: 'The text of the message',
            },
            meta: {
              $ref: '#/components/schemas/Meta',
            },
          },
          required: ['type', 'text'],
        },

        Entity: {
          type: 'object',
          description: 'Extracted entity from the message',
          properties: {
            type: {
              type: 'string',
              description: 'The entity type',
            },
            begin: {
              type: 'number',
              description: 'Start offset',
            },
            end: {
              type: 'number',
              description: 'End offset',
            },
            text: {
              type: 'string',
              description: 'The text value of the entity',
            },
            replacement: {
              type: 'object',
              properties: {
                begin: {
                  type: 'number',
                  description: 'Start offset',
                },
                end: {
                  type: 'number',
                  description: 'End offset',
                },
                text: {
                  type: 'string',
                  description: 'The text value of the replacement',
                },
              },
              required: ['begin', 'end', 'text'],
            },
          },
          required: ['type', 'begin', 'end', 'text'],
        },

        // ---

        MessageType: {
          type: 'string',
          description: 'The type of the message',
          enum: Object.keys(MessageType),
        },

        // ---

        Trigger: {
          type: 'string',
          description: 'The type of the trigger',
          enum: Object.keys(Trigger),
        },

        // ---

        Schedule: {
          type: 'string',
          description: 'The schedule',
          enum: Object.keys(Schedule),
        },

        SyncStatus: {
          type: 'string',
          description: 'The sync status of an integration',
          enum: Object.keys(SyncStatus),
        },

        // ---

        TaskStatus: {
          type: 'string',
          description: 'The task execution status',
          enum: Object.keys(TaskStatus),
        },

        TaskOutcome: {
          type: 'string',
          description: 'The task execution outcome',
          enum: Object.keys(TaskOutcome),
        },

        // ---

        BlueprintVisibility: {
          type: 'string',
          description: 'The blueprint visibility',
          enum: Object.keys(BlueprintVisibility),
        },

        // ---

        BotVisibility: {
          type: 'string',
          description: 'The bot visibility',
          enum: Object.keys(BotVisibility),
        },

        // ---

        DatasetVisibility: {
          type: 'string',
          description: 'The dataset visibility',
          enum: Object.keys(DatasetVisibility),
        },

        DatasetFileAttachmentType: {
          type: 'string',
          description: 'The dataset file attachment type',
          enum: Object.keys(DatasetFileAttachmentType),
        },

        DatasetFilter: zodToJsonSchema(DatasetFilterSchema, {
          target: 'openApi3',
        }),

        // ---

        SkillsetVisibility: {
          type: 'string',
          description: 'The skillset visibility',
          enum: Object.keys(SkillsetVisibility),
        },

        ResourceState: {
          type: 'string',
          description:
            'The lifecycle state of a resource - toggle it on/off without deleting it',
          enum: Object.keys(ResourceState),
        },

        // ---

        FileVisibility: {
          type: 'string',
          description: 'The file visibility',
          enum: Object.keys(FileVisibility),
        },

        // ---

        SecretType: {
          type: 'string',
          description: 'The type of the secret',
          enum: Object.keys(SecretType),
        },

        SecretKind: {
          type: 'string',
          description: 'The kind of the secret',
          enum: Object.keys(SecretKind),
        },

        SecretVisibility: {
          type: 'string',
          description: 'The visibility of the secret',
          enum: Object.keys(SecretVisibility),
        },

        // ---

        Usage: {
          type: 'object',
          description: 'Usage information',
          properties: {
            token: {
              type: 'number',
              description: 'The tokens used in this exchange',
            },
          },
          required: ['token'],
        },

        CompleteReason: {
          type: 'string',
          description: 'The reason why the completion ended',
          enum: ['length', 'stop', 'activity', 'abort', 'error', 'iteration'],
        },

        Abort: {
          type: 'object',
          description:
            'Information about an abort event in a streamed response',
          properties: {
            reason: {
              description: 'The abort reason if available',
            },
            functionName: {
              type: 'string',
              description: 'The function or tool associated with the abort',
            },
          },
        },

        CompleteEnd: {
          type: 'object',
          description: 'Information about why the completion ended',
          properties: {
            reason: {
              $ref: '#/components/schemas/CompleteReason',
            },
          },
          required: ['reason'],
        },

        ExecutionLimits: {
          type: 'object',
          description:
            'Execution limits to control conversation processing bounds',
          properties: {
            iterations: {
              type: 'integer',
              minimum: 1,
              description:
                'Maximum number of agentic iterations. Controls how many times the model can iterate through tool calls and responses.',
            },
            continuations: {
              type: 'integer',
              minimum: 1,
              description:
                'Maximum number of model continuations. Controls how many times the model can continue generating after reaching a stop condition.',
            },
            calls: {
              type: 'integer',
              minimum: 1,
              description:
                'Maximum number of function/tool calls. Controls how many total function calls can be made during the conversation.',
            },
          },
        },

        // ---

        PolicyType: {
          type: 'string',
          description: 'The policy type',
          enum: Object.keys(PolicyType),
        },

        // ---

        Limits: {
          type: 'object',
          description: 'Limits information',
          properties: {
            tokens: {
              type: 'number',
              description: 'The tokens limit',
            },
            conversations: {
              type: 'number',
              description: 'The conversations limit',
            },
            messages: {
              type: 'number',
              description: 'The messages limit',
            },
            database: {
              type: 'object',
              description: 'The database limits',
              properties: {
                datasets: {
                  type: 'number',
                  description: 'The datasets limit',
                },
                records: {
                  type: 'number',
                  description: 'The records limit',
                },
                skillsets: {
                  type: 'number',
                  description: 'The skillsets limit',
                },
                abilities: {
                  type: 'number',
                  description: 'The abilities limit',
                },
                files: {
                  type: 'number',
                  description: 'The files limit',
                },
              },
            },
          },
        },

        // ---

        // @note the `meta` column is nullable, but the engine and several
        // SDK message typedefs treat `meta` as an object; marking this shared
        // component nullable cascades through them, so it stays under-declared
        // for now - see advisories/OPENAPI_NULLABILITY_PARITY.md
        Meta: {
          type: 'object',
          description: 'Meta data information',
          additionalProperties: true,
        },

        // ---

        Model: {
          type: 'string',
          description: 'A model definition',
          pattern: '\\w+(?:\\/\\w+=\\w+)*',
          example: 'gpt-5.4',
        },

        // ---

        BotRef: {
          type: 'object',
          description:
            'A bot configuration that can be applied without a dedicated bot instance.',
          properties: {
            botId: {
              type: 'string',
              description: 'The ID of the bot this configuration is using',
              nullable: true,
            },
          },
        },

        BotConfig: {
          type: 'object',
          description:
            'A bot configuration that can be applied without a dedicated bot instance.',
          properties: {
            model: {
              $ref: '#/components/schemas/Model',
            },
            backstory: {
              type: 'string',
              description: 'The backstory this configuration is using',
              nullable: true,
            },
            datasetId: {
              type: 'string',
              description: 'The id of the dataset this configuration is using',
              nullable: true,
            },
            skillsetId: {
              type: 'string',
              description: 'The id of the skillset this configuration is using',
              nullable: true,
            },
            privacy: {
              type: 'boolean',
              description: 'The privacy flag for this configuration',
            },
            moderation: {
              type: 'boolean',
              description: 'The moderation flag for this configuration',
            },
          },
        },

        BotRefOrConfig: {
          description: 'A bot configuration or reference',
          oneOf: [
            { $ref: '#/components/schemas/BotRef' },
            { $ref: '#/components/schemas/BotConfig' },
          ],
        },

        // ---

        BlueprintProps: {
          type: 'object',
          description: 'Blueprint properties',
          properties: {
            blueprintId: {
              type: 'string',
              description: 'The ID of the blueprint',
              nullable: true,
            },
          },
        },

        // ---

        InstanceRefProperties: {
          description: 'Instance reference properties',
          type: 'object',
          properties: {
            alias: {
              type: 'string',
              description: 'The unique alias for the instance',
              nullable: true,
            },
          },
        },

        InstanceMetaProps: {
          description: 'Instance list properties',
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The instance ID',
            },
            createdAt: {
              type: 'number',
              description: 'The timestamp (ms) when the instance was created',
            },
            updatedAt: {
              type: 'number',
              description: 'The timestamp (ms) when the instance was updated',
            },
          },
          required: ['id', 'createdAt', 'updatedAt'],
        },

        InstanceCrudProps: {
          type: 'object',
          description: 'Instance crud properties',
          properties: {
            // @note request validators accept null for name/description, but
            // this component is shared with every resource's response docs
            // (via InstanceListProps) where both columns are non-null - so the
            // request side stays under-declared rather than making every
            // generated response type `string | null`; see
            // advisories/OPENAPI_NULLABILITY_PARITY.md
            name: {
              type: 'string',
              description: 'The associated name',
            },
            description: {
              type: 'string',
              description: 'The associated description',
            },
            meta: {
              $ref: '#/components/schemas/Meta',
            },
          },
        },

        InstanceListProps: {
          description: 'Instance list properties',
          allOf: [
            { $ref: '#/components/schemas/InstanceCrudProps' },
            { $ref: '#/components/schemas/InstanceMetaProps' },
          ],
        },

        // ---

        JsonSchemaObject: {
          description:
            'A JSON Schema object type definition (https://json-schema.org/). Represents an object schema with properties and validation rules.',
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['object'],
              description: 'The schema type, must be "object"',
            },
            title: {
              type: 'string',
              description: 'The schema title',
            },
            description: {
              type: 'string',
              description: 'The schema description',
            },
            properties: {
              type: 'object',
              description: 'Object property definitions',
              additionalProperties: true,
            },
            required: {
              type: 'array',
              description: 'Required property names',
              items: {
                type: 'string',
              },
            },
          },
          required: ['type', 'properties'],
        },

        // ---

        FunctionsDefinition: {
          description: 'An array of functions to be added to the conversation',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                description:
                  'The name of the function (must be a valid JS identifier, max 64 chars)',
                type: 'string',
              },
              description: {
                description: 'The description of the function',
                type: 'string',
              },
              parameters: {
                description:
                  'JSON Schema definition for the function parameters',
                type: 'object',
                properties: {
                  type: {
                    description: 'The schema type, must be "object"',
                    type: 'string',
                    enum: ['object'],
                  },
                  properties: {
                    description: 'Object property definitions',
                    type: 'object',
                    additionalProperties: true,
                  },
                  required: {
                    description: 'Required property names',
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
                required: ['type', 'properties'],
              },
              result: {
                description: 'The result of the function execution',
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      data: {
                        description:
                          'The data returned by the function (can be any type)',
                      },
                    },
                    required: ['data'],
                  },
                  {
                    type: 'object',
                    properties: {
                      channel: {
                        description:
                          'The channel for streaming function results',
                        type: 'string',
                      },
                    },
                    required: ['channel'],
                  },
                ],
              },
              call: {
                description:
                  'Configuration for when this function should be automatically called',
                type: 'object',
                properties: {
                  start: {
                    description:
                      'If true, this function will be force-called at the start of the conversation',
                    type: 'boolean',
                  },
                  end: {
                    description:
                      'If true, this function will be force-called at the end of the conversation',
                    type: 'boolean',
                  },
                },
              },
            },
            required: ['name', 'description', 'parameters'],
          },
        },

        ExtensionsDefinition: {
          description: "Extensions to enhance the bot's capabilities",
          type: 'object',
          properties: {
            backstory: {
              description: 'Additional backstory for the bot',
              type: 'string',
            },
            datasets: zodToJsonSchema(InlineDatasetsSchema, {
              target: 'openApi3',
              $refStrategy: 'none',
            }),
            skillsets: zodToJsonSchema(InlineSkillsetsSchema, {
              target: 'openApi3',
              $refStrategy: 'none',
            }),
            features: {
              description: 'Feature flags to enable specific bot capabilities',
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    description: 'The name of the feature to enable',
                    type: 'string',
                  },
                  options: {
                    description:
                      'Optional configuration options for the feature',
                    type: 'object',
                    additionalProperties: true,
                  },
                },
                required: ['name'],
              },
            },
          },
        },

        // ---

        CompleteStreamingResponseItem: {
          description: 'An item in the streaming completion response',
          oneOf: [
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['error'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {
                    message: {
                      description: 'The error message',
                      type: 'string',
                    },
                  },
                  required: ['message'],
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['token'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {
                    token: {
                      description: 'The token generated',
                      type: 'string',
                    },
                  },
                  required: ['token'],
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['reasoningToken'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {
                    token: {
                      description: 'The token generated',
                      type: 'string',
                    },
                  },
                  required: ['token'],
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['message'],
                },
                data: {
                  allOf: [
                    {
                      $ref: '#/components/schemas/Message',
                    },
                    {
                      type: 'object',
                      properties: {},
                    },
                  ],
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['abort'],
                },
                data: {
                  $ref: '#/components/schemas/Abort',
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['completeBegin'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {},
                  additionalProperties: true,
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['completeEnd'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {},
                  additionalProperties: true,
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['waitForChannelMessageBegin'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {},
                  additionalProperties: true,
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['waitForChannelMessageEnd'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {},
                  additionalProperties: true,
                },
              },
              required: ['type', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['usage'],
                },
                data: {
                  description: 'The data for the event',
                  type: 'object',
                  properties: {
                    model: {
                      description: 'The model used',
                      type: 'string',
                    },
                    inputTokensUsed: {
                      description: 'The number of input tokens used',
                      type: 'number',
                    },
                    outputTokensUsed: {
                      description: 'The number of output tokens used',
                      type: 'number',
                    },
                  },
                  required: ['model', 'inputTokensUsed', 'outputTokensUsed'],
                },
              },
              required: ['type', 'data'],
            },
          ],
        },

        TaskWorkflowStreamingResponseItem: {
          description: 'An item in the task workflow subscription response',
          oneOf: [
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['operationBegin'],
                },
                createdAt: {
                  description:
                    'The event creation timestamp in milliseconds since the Unix epoch',
                  type: 'number',
                },
                data: {
                  description: 'The data for the operation begin event',
                  type: 'object',
                  properties: {
                    id: {
                      description: 'The operation ID',
                      type: 'string',
                    },
                    action: {
                      description: 'The action associated with the operation',
                      type: 'object',
                      properties: {
                        id: {
                          description: 'The action ID',
                          type: 'string',
                        },
                        kind: {
                          description: 'The action kind',
                          type: 'string',
                          enum: ['dataset', 'skillset', 'function'],
                        },
                        name: {
                          description: 'The action name',
                          type: 'string',
                        },
                        input: {
                          description: 'The action input',
                        },
                        justification: {
                          description: 'The action justification',
                          type: 'string',
                        },
                        icon: {
                          description: 'The action icon',
                          type: 'string',
                        },
                      },
                      required: ['id'],
                    },
                  },
                  required: ['id', 'action'],
                },
              },
              required: ['type', 'createdAt', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['operationEnd'],
                },
                createdAt: {
                  description:
                    'The event creation timestamp in milliseconds since the Unix epoch',
                  type: 'number',
                },
                data: {
                  description: 'The data for the operation end event',
                  type: 'object',
                  properties: {
                    id: {
                      description: 'The operation ID',
                      type: 'string',
                    },
                    action: {
                      description: 'The action associated with the operation',
                      type: 'object',
                      properties: {
                        id: {
                          description: 'The action ID',
                          type: 'string',
                        },
                        kind: {
                          description: 'The action kind',
                          type: 'string',
                          enum: ['dataset', 'skillset', 'function'],
                        },
                        name: {
                          description: 'The action name',
                          type: 'string',
                        },
                        input: {
                          description: 'The action input',
                        },
                        justification: {
                          description: 'The action justification',
                          type: 'string',
                        },
                        icon: {
                          description: 'The action icon',
                          type: 'string',
                        },
                      },
                      required: ['id'],
                    },
                  },
                  required: ['id', 'action'],
                },
              },
              required: ['type', 'createdAt', 'data'],
            },
            {
              type: 'object',
              properties: {
                type: {
                  description: 'The type of event',
                  type: 'string',
                  enum: ['error'],
                },
                createdAt: {
                  description:
                    'The event creation timestamp in milliseconds since the Unix epoch',
                  type: 'number',
                },
                data: {
                  description: 'The data for the error event',
                  type: 'object',
                  properties: {
                    code: {
                      description: 'The error code',
                      type: 'string',
                    },
                    message: {
                      description: 'The error message',
                      type: 'string',
                    },
                  },
                  required: ['code', 'message'],
                },
              },
              required: ['type', 'createdAt', 'data'],
            },
          ],
        },
      },

      responses: {
        ErrorResponse: {
          type: 'object',
          description: 'An error response',
          properties: {
            message: {
              type: 'string',
              description: 'The error message',
            },
            code: {
              type: 'string',
              description: 'The error code',
            },
          },
          required: ['message', 'code'],
        },
      },
    },

    security: [{ BearerAuth: [] }],
  },

  apiFolder: 'pages/api/v1',
}

async function main() {
  await fs.promises.mkdir('public/api/v1', { recursive: true })
  await fs.promises.writeFile(
    'public/api/v1/spec.json',
    JSON.stringify(createSwaggerSpec(swaggerDefinitionV1))
  )
}

main().catch(exit)
