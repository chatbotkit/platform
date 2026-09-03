import { fetch } from '@/lib/fetch'

import { getExternalHostURL } from '@/lib/host'
import { requiredUrlParam } from '@/lib/query.get'
import { SafeJson } from '@/lib/struct'

import handler from './fetch'

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(),
}))

jest.mock('@/lib/host', () => ({
  ...jest.requireActual('@/lib/host'),

  __esModule: true,

  getLocalHostURL: jest.fn((path) => `http://localhost:3000${path}`),
}))

jest.mock('@/lib/fetch', () => ({
  fetch: jest.fn(),
}))

jest.mock('@/examples', () => ({
  __esModule: true,
  default: [
    {
      slug: 'blueprint-example',
      title: 'Blueprint Example',
      description: 'A blueprint',
      keywords: ['ai', 'support'],
      date: '2025-06-01',
      blueprint: {
        resources: {
          '#bot:::abc123': {
            type: 'bot',
            data: {
              name: 'Test Bot',
              skillsetId: '#skillset:::def456',
            },
          },
          '#skillset:::def456': {
            type: 'skillset',
            data: { name: 'Test Skillset' },
          },
        },
        positions: {
          '#bot:::abc123': { x: 0, y: 0 },
          '#skillset:::def456': { x: 0, y: 200 },
        },
      },
    },
    {
      slug: 'project-example',
      title: 'Project Example',
      description: 'A project',
      keywords: ['project'],
      date: '2025-07-01',
      url: 'https://github.com/org/repo',
      files: [{ name: 'index.js', content: 'console.log("hi")' }],
    },
    {
      slug: 'widget-example',
      title: 'Widget Example',
      description: 'A widget',
      keywords: ['widget'],
      date: '2025-08-01',
      backstory: 'You are helpful.',
      model: 'gpt-4',
      theme: 'dark',
    },
    {
      slug: 'integration-example',
      title: 'Integration Example',
      description: 'An integration',
      keywords: ['slack'],
      integration: 'slack',
    },
    {
      slug: 'github-project',
      title: 'GitHub Project',
      description: 'A github project',
      keywords: ['github'],
      url: 'https://github.com/org/repo2',
      files: [{ name: 'old.js', content: 'old' }],
    },
  ],
}))

// @note links are composed by the route via getExternalHostURL - derive
// the expected origin the same way
const base = getExternalHostURL('/').replace(/\/$/, '')

describe('/api/v1/platform/example/[exampleId]/fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 404 for unknown example', async () => {
    requiredUrlParam.mockReturnValue('nonexistent')

    const response = await handler({}, {})

    expect(response.status).toBe(404)
  })

  describe('blueprint examples', () => {
    it('should return type blueprint with full blueprint config', async () => {
      requiredUrlParam.mockReturnValue('blueprint-example')

      const response = await handler({}, {})

      expect(response.status).toBe(200)
      expect(response.body.type).toBe('blueprint')
      expect(response.body.config.data).toEqual({
        blueprint: {
          resources: {
            '#bot:::abc123': {
              type: 'bot',
              data: {
                name: 'Test Bot',
                skillsetId: '#skillset:::def456',
              },
            },
            '#skillset:::def456': {
              type: 'skillset',
              data: { name: 'Test Skillset' },
            },
          },
          positions: {
            '#bot:::abc123': { x: 0, y: 0 },
            '#skillset:::def456': { x: 0, y: 200 },
          },
        },
      })
    })

    it('should preserve all resource keys including # prefixed ones', async () => {
      requiredUrlParam.mockReturnValue('blueprint-example')

      const response = await handler({}, {})
      const resourceKeys = Object.keys(
        response.body.config.data.blueprint.resources
      )

      expect(resourceKeys).toEqual(['#bot:::abc123', '#skillset:::def456'])
    })

    it('should wrap blueprint config in SafeJson', async () => {
      requiredUrlParam.mockReturnValue('blueprint-example')

      const response = await handler({}, {})

      expect(response.body.config).toBeInstanceOf(SafeJson)
    })
  })

  describe('project examples', () => {
    it('should return type project with files and url', async () => {
      requiredUrlParam.mockReturnValue('project-example')

      const response = await handler({}, {})

      expect(response.status).toBe(200)
      expect(response.body.type).toBe('project')
      expect(response.body.config.url).toBe('https://github.com/org/repo')
      expect(response.body.config.files).toEqual([
        { name: 'index.js', content: 'console.log("hi")' },
      ])
    })

    it('should fetch generated files for github projects', async () => {
      requiredUrlParam.mockReturnValue('github-project')
      fetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { name: 'new.js', content: 'new' },
          { name: 'readme.md', content: '# Hi' },
        ],
      })

      const response = await handler({}, {})

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/examples/github-project/files.json'
      )
      expect(response.body.config.files).toEqual([
        { name: 'new.js', content: 'new' },
        { name: 'readme.md', content: '# Hi' },
      ])
    })

    it('should fall back to original files when fetch fails', async () => {
      requiredUrlParam.mockReturnValue('github-project')
      fetch.mockRejectedValue(new Error('network error'))

      const response = await handler({}, {})

      expect(response.body.config.files).toEqual([
        { name: 'old.js', content: 'old' },
      ])
    })

    it('should fall back to original files when response is not ok', async () => {
      requiredUrlParam.mockReturnValue('github-project')
      fetch.mockResolvedValue({ ok: false })

      const response = await handler({}, {})

      expect(response.body.config.files).toEqual([
        { name: 'old.js', content: 'old' },
      ])
    })

    it('should fall back to original files when generated files is empty', async () => {
      requiredUrlParam.mockReturnValue('github-project')
      fetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      })

      const response = await handler({}, {})

      expect(response.body.config.files).toEqual([
        { name: 'old.js', content: 'old' },
      ])
    })
  })

  describe('widget examples', () => {
    it('should return widget type with backstory, model, and theme', async () => {
      requiredUrlParam.mockReturnValue('widget-example')

      const response = await handler({}, {})

      expect(response.status).toBe(200)
      expect(response.body.type).toBe('widget')
      expect(response.body.config).toEqual({
        backstory: 'You are helpful.',
        model: 'gpt-4',
        theme: 'dark',
      })
    })

    it('should use integration type when present', async () => {
      requiredUrlParam.mockReturnValue('integration-example')

      const response = await handler({}, {})

      expect(response.body.type).toBe('slack')
    })
  })

  describe('common response fields', () => {
    it('should include id, name, description, tags, and link', async () => {
      requiredUrlParam.mockReturnValue('blueprint-example')

      const response = await handler({}, {})

      expect(response.body.id).toBe('blueprint-example')
      expect(response.body.name).toBe('Blueprint Example')
      expect(response.body.description).toBe('A blueprint')
      expect(response.body.tags).toEqual(['ai', 'support'])
      expect(response.body.link).toBe(
        `${base}/examples/blueprint-example`
      )
    })

    it('should compute timestamps from date', async () => {
      requiredUrlParam.mockReturnValue('blueprint-example')

      const response = await handler({}, {})
      const expected = new Date('2025-06-01').getTime()

      expect(response.body.createdAt).toBe(expected)
      expect(response.body.updatedAt).toBe(expected)
    })

    it('should use Date.now() when no date is provided', async () => {
      requiredUrlParam.mockReturnValue('integration-example')

      const before = Date.now()

      const response = await handler({}, {})

      expect(response.body.createdAt).toBeGreaterThanOrEqual(before)
      expect(response.body.updatedAt).toBeGreaterThanOrEqual(before)
    })
  })
})
