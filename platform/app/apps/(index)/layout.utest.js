/**
 * @jest-environment node
 */
import { headers } from 'next/headers'

import {
  getPublicAppConfig,
  getUserAppConfig,
} from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import {
  getContextRequestHost,
  getContextRequestUserAgent,
} from '@/lib/context.store'

import Layout, { generateMetadata } from './layout'

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}))

jest.mock('@/lib/app.router.app.config', () => ({
  getPublicAppConfig: jest.fn(),
  getUserAppConfig: jest.fn(),
}))

jest.mock('@/lib/app.router.app.manifest', () => ({
  getAppManifestPath: jest.fn(),
}))

describe('apps index metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize request context before resolving metadata', async () => {
    headers.mockReturnValue(
      new Headers({
        host: 'portal.example.com',
        'user-agent': 'Metadata Test',
      })
    )
    getPublicAppConfig.mockImplementation(async () => ({
      name: getContextRequestHost(),
      description: getContextRequestUserAgent(),
    }))
    getAppManifestPath.mockImplementation(() => getContextRequestHost())

    await expect(generateMetadata()).resolves.toMatchObject({
      title: 'portal.example.com',
      description: 'Metadata Test',
      manifest: 'portal.example.com',
    })
  })

  it('should initialize request context before rendering the child layout', async () => {
    headers.mockReturnValue(new Headers({ host: 'portal.example.com' }))
    getPublicAppConfig.mockResolvedValue(null)
    getUserAppConfig.mockImplementation(async () => ({
      name: getContextRequestHost(),
    }))

    const result = await Layout({ children: null })

    expect(result.props.config).toEqual({ name: 'portal.example.com' })
  })
})
