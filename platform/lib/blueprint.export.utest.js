import {
  CLONE_EXPORT_BUCKETS,
  FULL_EXPORT_BUCKETS,
  JSON_EXPORT_BUCKETS,
  TERRAFORM_EXPORT_BUCKETS,
  exportResourceCategoryMap,
  exportResourceDocument,
} from '@/lib/blueprint.export'

jest.mock('@/lib/blueprint.fields', () => ({
  isUnmanagedBlueprintField: jest.fn((key) => {
    // Mock: treat fields ending with 'token', 'secret', or 'key' as unmanaged
    return (
      key.includes('token') ||
      key.includes('secret') ||
      key.toLowerCase().includes('key')
    )
  }),
}))

describe('blueprint.export', () => {
  describe('exportResourceCategoryMap', () => {
    it('should export resources grouped by category', () => {
      const resources = {
        basic: {
          bot: [
            { id: 'bot-1', name: 'Test Bot' },
            { id: 'bot-2', name: 'Another Bot' },
          ],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.bot).toHaveLength(2)
      expect(result.bot[0]).toEqual({ id: 'bot-1', name: 'Test Bot' })
      expect(result.bot[1]).toEqual({ id: 'bot-2', name: 'Another Bot' })
    })

    it('should apply integration suffix to integration category', () => {
      const resources = {
        integration: {
          slack: [{ id: 'integration-1', name: 'Slack' }],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['integration'],
      })

      expect(result.slackIntegration).toBeDefined()
      expect(result.slackIntegration).toHaveLength(1)
    })

    it('should not apply integration suffix to non-integration categories', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.bot).toBeDefined()
      expect(result.botIntegration).toBeUndefined()
    })

    it('should strip sensitive fields in public sensitivity mode', () => {
      const resources = {
        basic: {
          slackIntegration: [
            {
              id: 'slack-1',
              name: 'Slack',
              token: 'secret-token-123',
              description: 'Slack integration',
            },
          ],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'public',
        buckets: ['basic'],
      })

      expect(result.slackIntegration[0]).toEqual({
        id: 'slack-1',
        name: 'Slack',
        description: 'Slack integration',
      })
      expect(result.slackIntegration[0].token).toBeUndefined()
    })

    it('should preserve all fields in internal sensitivity mode', () => {
      const resources = {
        basic: {
          slackIntegration: [
            {
              id: 'slack-1',
              name: 'Slack',
              token: 'secret-token-123',
              description: 'Slack integration',
            },
          ],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.slackIntegration[0]).toEqual({
        id: 'slack-1',
        name: 'Slack',
        token: 'secret-token-123',
        description: 'Slack integration',
      })
    })

    it('should handle multiple buckets', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
        },
        object: {
          dataset: [{ id: 'dataset-1', name: 'Dataset' }],
        },
        compliance: {
          policy: [{ id: 'policy-1', name: 'Policy' }],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic', 'object', 'compliance'],
      })

      expect(result.bot).toBeDefined()
      expect(result.dataset).toBeDefined()
      expect(result.policy).toBeDefined()
    })

    it('should skip buckets not in the requested list', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
        },
        oauth: {
          oAuthConnection: [{ id: 'oauth-1', name: 'OAuth' }],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.bot).toBeDefined()
      expect(result.oAuthConnection).toBeUndefined()
    })

    it('should skip empty buckets', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic', 'object'],
      })

      expect(result.bot).toBeDefined()
      expect(result.object).toBeUndefined()
    })

    it('should handle empty resource lists', () => {
      const resources = {}

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic', 'object'],
      })

      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should handle large resource sets', () => {
      const resources = {
        basic: {
          bot: Array.from({ length: 1000 }, (_, i) => ({
            id: `bot-${i}`,
            name: `Bot ${i}`,
          })),
        },
      }

      const result = exportResourceCategoryMap({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.bot).toHaveLength(1000)
    })
  })

  describe('exportResourceDocument', () => {
    it('should create token-keyed resource document', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-123', name: 'Test Bot' }],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.resources['#bot:::bot-123']).toEqual({
        type: 'bot',
        data: { name: 'Test Bot' },
      })
    })

    it('should generate correct token format', () => {
      const resources = {
        basic: {
          bot: [{ id: 'abc-def-ghi', name: 'Bot' }],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(Object.keys(result.resources)[0]).toBe('#bot:::abc-def-ghi')
    })

    it('should apply integration suffix to integration types', () => {
      const resources = {
        integration: {
          slack: [{ id: 'slack-1', name: 'Slack' }],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['integration'],
      })

      expect(result.resources['#slackIntegration:::slack-1']).toBeDefined()
      expect(result.resources['#slackIntegration:::slack-1'].type).toBe(
        'slackIntegration'
      )
    })

    it('should exclude id from data section', () => {
      const resources = {
        basic: {
          bot: [
            {
              id: 'bot-1',
              name: 'Bot',
              description: 'A bot',
              metadata: { key: 'value' },
            },
          ],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      const data = result.resources['#bot:::bot-1'].data

      expect(data).not.toHaveProperty('id')
      expect(data.name).toBe('Bot')
      expect(data.description).toBe('A bot')
      expect(data.metadata).toEqual({ key: 'value' })
    })

    it('should strip sensitive fields in public sensitivity mode', () => {
      const resources = {
        basic: {
          slackIntegration: [
            {
              id: 'slack-1',
              name: 'Slack',
              token: 'secret-123',
              apiKey: 'key-456',
              description: 'Integration',
            },
          ],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'public',
        buckets: ['basic'],
      })

      const data = result.resources['#slackIntegration:::slack-1'].data

      expect(data.token).toBeUndefined()
      expect(data.apiKey).toBeUndefined()
      expect(data.description).toBe('Integration')
    })

    it('should handle multiple resources in same category', () => {
      const resources = {
        basic: {
          bot: [
            { id: 'bot-1', name: 'Bot 1' },
            { id: 'bot-2', name: 'Bot 2' },
            { id: 'bot-3', name: 'Bot 3' },
          ],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.resources['#bot:::bot-1']).toBeDefined()
      expect(result.resources['#bot:::bot-2']).toBeDefined()
      expect(result.resources['#bot:::bot-3']).toBeDefined()
    })

    it('should handle multiple categories', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
          dataset: [{ id: 'dataset-1', name: 'Dataset' }],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.resources['#bot:::bot-1']).toBeDefined()
      expect(result.resources['#dataset:::dataset-1']).toBeDefined()
    })

    it('should handle multiple buckets', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
        },
        integration: {
          slack: [{ id: 'slack-1', name: 'Slack' }],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic', 'integration'],
      })

      expect(result.resources['#bot:::bot-1']).toBeDefined()
      expect(result.resources['#slackIntegration:::slack-1']).toBeDefined()
    })

    it('should skip unrequested buckets', () => {
      const resources = {
        basic: {
          bot: [{ id: 'bot-1', name: 'Bot' }],
        },
        oauth: {
          oAuthConnection: [{ id: 'oauth-1', name: 'OAuth' }],
        },
      }

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(result.resources['#bot:::bot-1']).toBeDefined()
      expect(result.resources['#oAuthConnection:::oauth-1']).toBeUndefined()
    })

    it('should return empty resources for empty input', () => {
      const resources = {}

      const result = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      expect(Object.keys(result.resources)).toHaveLength(0)
    })

    it('should preserve non-sensitive fields through multiple exports', () => {
      const resources = {
        basic: {
          bot: [
            {
              id: 'bot-1',
              name: 'Test Bot',
              description: 'Test description',
              config: { key: 'value' },
            },
          ],
        },
      }

      const publicExport = exportResourceDocument({
        resources,
        sensitivity: 'public',
        buckets: ['basic'],
      })

      const internalExport = exportResourceDocument({
        resources,
        sensitivity: 'internal',
        buckets: ['basic'],
      })

      const publicData = publicExport.resources['#bot:::bot-1'].data
      const internalData = internalExport.resources['#bot:::bot-1'].data

      expect(publicData.name).toBe(internalData.name)
      expect(publicData.description).toBe(internalData.description)
      expect(publicData.config).toEqual(internalData.config)
    })
  })

  describe('export bucket constants', () => {
    it('should define JSON_EXPORT_BUCKETS without oauth', () => {
      expect(JSON_EXPORT_BUCKETS).toContain('basic')
      expect(JSON_EXPORT_BUCKETS).toContain('object')
      expect(JSON_EXPORT_BUCKETS).toContain('compliance')
      expect(JSON_EXPORT_BUCKETS).toContain('integration')
      expect(JSON_EXPORT_BUCKETS).not.toContain('oauth')
    })

    it('should define TERRAFORM_EXPORT_BUCKETS without oauth', () => {
      expect(TERRAFORM_EXPORT_BUCKETS).toContain('basic')
      expect(TERRAFORM_EXPORT_BUCKETS).toContain('object')
      expect(TERRAFORM_EXPORT_BUCKETS).toContain('compliance')
      expect(TERRAFORM_EXPORT_BUCKETS).toContain('integration')
      expect(TERRAFORM_EXPORT_BUCKETS).not.toContain('oauth')
    })

    it('should define FULL_EXPORT_BUCKETS with oauth', () => {
      expect(FULL_EXPORT_BUCKETS).toContain('basic')
      expect(FULL_EXPORT_BUCKETS).toContain('object')
      expect(FULL_EXPORT_BUCKETS).toContain('compliance')
      expect(FULL_EXPORT_BUCKETS).toContain('oauth')
      expect(FULL_EXPORT_BUCKETS).toContain('integration')
    })

    it('should define CLONE_EXPORT_BUCKETS without oauth', () => {
      expect(CLONE_EXPORT_BUCKETS).toContain('basic')
      expect(CLONE_EXPORT_BUCKETS).toContain('object')
      expect(CLONE_EXPORT_BUCKETS).toContain('compliance')
      expect(CLONE_EXPORT_BUCKETS).toContain('integration')
      expect(CLONE_EXPORT_BUCKETS).not.toContain('oauth')
    })
  })
})
