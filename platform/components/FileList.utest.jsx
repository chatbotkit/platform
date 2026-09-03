import { saveUrl } from '@/lib/save'

import ResourceList from '@/components/ResourceList'

import useFetch from '@/hooks/useFetch'

import FileList from './FileList'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

const mockGraphQLFetch = jest.fn()

let mockScope = null

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fetch: jest.fn(),
  })),
}))

jest.mock('@/lib/fetch', () => jest.fn((...args) => mockGraphQLFetch(...args)))

jest.mock('@/hooks/useProjectScope', () => ({
  __esModule: true,
  default: jest.fn(() => ({ hydrated: true, scope: mockScope })),
  scopeListRoute: (route, scope) => {
    if (!scope || typeof route !== 'string') {
      return route
    }

    const url = new URL(route, 'https://chatbotkit.com')

    url.searchParams.set('blueprintId', scope.id)

    return url.pathname + url.search
  },
}))

jest.mock('@/lib/save', () => ({
  saveUrl: jest.fn(),
}))

jest.mock('@/components/ResourceList', () => ({
  __esModule: true,
  default: jest.fn(() => (
    <div data-testid="resource-list">ResourceList Mock</div>
  )),
}))

function expectGraphQLListRoute(listRoute) {
  expect(typeof listRoute).toBe('function')
  expect(listRoute.toJSON()).toBe('/api/v1/graphql')
}

describe('FileList', () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockScope = null
    useFetch.mockReturnValue({ fetch: mockFetch })
  })

  describe('basic rendering', () => {
    it('should render ResourceList with default props', () => {
      render(<FileList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass default kind prop', () => {
      render(<FileList />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'file' }),
        undefined
      )
    })

    it('should pass default routes', () => {
      render(<FileList />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          listRoute: expect.any(Function),
          exportRoute: null,
          deleteRoute: '/api/v1/file/[id]/delete',
          instanceRoute: '/files/[id]',
        }),
        undefined
      )

      expectGraphQLListRoute(ResourceList.mock.calls[0][0].listRoute)
    })

    it('should pass default filter prop', () => {
      render(<FileList />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: false }),
        undefined
      )
    })

    it('should pass the active project to the GraphQL list query', async () => {
      mockScope = { id: 'blueprint_123', name: 'Project' }
      mockGraphQLFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            files: {
              edges: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
      })

      render(<FileList />)

      await ResourceList.mock.calls[0][0].listRoute({ take: 10 })

      const request = JSON.parse(mockGraphQLFetch.mock.calls[0][1].body)

      expect(request.variables.blueprintIds).toEqual(['blueprint_123'])
    })
  })

  describe('with custom props', () => {
    it('should override default kind', () => {
      render(<FileList kind="custom-file" />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'custom-file' }),
        undefined
      )
    })

    it('should override default routes', () => {
      render(
        <FileList
          listRoute="/custom/list"
          exportRoute="/custom/export"
          deleteRoute="/custom/delete"
          instanceRoute="/custom/[id]"
        />
      )

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          listRoute: '/custom/list',
          exportRoute: '/custom/export',
          deleteRoute: '/custom/delete',
          instanceRoute: '/custom/[id]',
        }),
        undefined
      )
    })

    it('should scope a custom route to the active project', () => {
      mockScope = { id: 'blueprint_123', name: 'Project' }

      render(<FileList listRoute="/custom/list?kind=file" />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          listRoute: '/custom/list?kind=file&blueprintId=blueprint_123',
        }),
        undefined
      )
    })

    it('should pass filter prop', () => {
      render(<FileList filter={true} />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: true }),
        undefined
      )
    })

    it('should pass additional props to ResourceList', () => {
      render(<FileList customProp="test-value" anotherProp={123} />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({
          customProp: 'test-value',
          anotherProp: 123,
        }),
        undefined
      )
    })
  })

  describe('extraLinks functionality', () => {
    it('should provide default Download link', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraLinks = call.extraLinks

      expect(typeof extraLinks).toBe('function')
    })

    it('should handle successful download', async () => {
      mockFetch.mockResolvedValue({
        error: null,
        data: { url: 'https://example.com/file.pdf' },
      })

      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraLinks = call.extraLinks({ id: 'file-123' })

      await extraLinks.Download()

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/file/file-123/download', {
        headers: { accept: 'application/json' },
      })
      expect(saveUrl).toHaveBeenCalledWith('https://example.com/file.pdf')
    })

    it('should handle download error gracefully', async () => {
      mockFetch.mockResolvedValue({
        error: { message: 'Download failed' },
        data: null,
      })

      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraLinks = call.extraLinks({ id: 'file-456' })

      await extraLinks.Download()

      expect(mockFetch).toHaveBeenCalled()
      expect(saveUrl).not.toHaveBeenCalled()
    })

    it('should use custom extraLinks when provided', () => {
      const customExtraLinks = jest.fn(() => ({ CustomAction: jest.fn() }))

      render(<FileList extraLinks={customExtraLinks} />)

      const call = ResourceList.mock.calls[0][0]

      expect(call.extraLinks).toBe(customExtraLinks)
    })
  })

  describe('extraTags functionality', () => {
    it('should provide default extraTags function', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags

      expect(typeof extraTags).toBe('function')
    })

    it('should render contentType tag when present', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags({ meta: { contentType: 'image/png' } })

      const { container } = render(<>{extraTags}</>)

      expect(container.textContent).toContain('image/png')
    })

    it('should render app tag when present', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags({ meta: { app: 'my-app' } })

      const { container } = render(<>{extraTags}</>)

      expect(container.textContent).toContain('my-app')
    })

    it('should render both tags when both present', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags({
        meta: { contentType: 'application/pdf', app: 'documents' },
      })

      const { container } = render(<>{extraTags}</>)

      expect(container.textContent).toContain('application/pdf')
      expect(container.textContent).toContain('documents')
    })

    it('should render nothing when meta is empty', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags({ meta: {} })

      const { container } = render(<>{extraTags}</>)

      expect(container.textContent).toBe('')
    })

    it('should handle missing meta gracefully', () => {
      render(<FileList />)

      const call = ResourceList.mock.calls[0][0]
      const extraTags = call.extraTags({})

      const { container } = render(<>{extraTags}</>)

      expect(container.textContent).toBe('')
    })

    it('should use custom extraTags when provided', () => {
      const customExtraTags = jest.fn(() => <div>Custom Tags</div>)

      render(<FileList extraTags={customExtraTags} />)

      const call = ResourceList.mock.calls[0][0]

      expect(call.extraTags).toBe(customExtraTags)
    })
  })

  describe('memoization', () => {
    it('should memoize extraLinks function', () => {
      const { rerender } = render(<FileList />)

      const firstCall = ResourceList.mock.calls[0][0].extraLinks

      rerender(<FileList />)

      const secondCall = ResourceList.mock.calls[1][0].extraLinks

      expect(firstCall).toBe(secondCall)
    })

    it('should update extraLinks when custom extraLinks changes', () => {
      const extraLinks1 = jest.fn()
      const extraLinks2 = jest.fn()

      const { rerender } = render(<FileList extraLinks={extraLinks1} />)

      const firstCall = ResourceList.mock.calls[0][0].extraLinks

      expect(firstCall).toBe(extraLinks1)

      rerender(<FileList extraLinks={extraLinks2} />)

      const secondCall = ResourceList.mock.calls[1][0].extraLinks

      expect(secondCall).toBe(extraLinks2)
    })

    it('should memoize extraTags function', () => {
      const { rerender } = render(<FileList />)

      const firstCall = ResourceList.mock.calls[0][0].extraTags

      rerender(<FileList />)

      const secondCall = ResourceList.mock.calls[1][0].extraTags

      expect(firstCall).toBe(secondCall)
    })

    it('should update extraTags when custom extraTags changes', () => {
      const extraTags1 = jest.fn()
      const extraTags2 = jest.fn()

      const { rerender } = render(<FileList extraTags={extraTags1} />)

      const firstCall = ResourceList.mock.calls[0][0].extraTags

      expect(firstCall).toBe(extraTags1)

      rerender(<FileList extraTags={extraTags2} />)

      const secondCall = ResourceList.mock.calls[1][0].extraTags

      expect(secondCall).toBe(extraTags2)
    })
  })

  describe('edge cases', () => {
    it('should handle null exportRoute', () => {
      render(<FileList exportRoute={null} />)

      expect(ResourceList).toHaveBeenCalledWith(
        expect.objectContaining({ exportRoute: null }),
        undefined
      )
    })

    it('should handle undefined props gracefully', () => {
      render(
        <FileList
          kind={undefined}
          filter={undefined}
          extraLinks={undefined}
          extraTags={undefined}
        />
      )

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })
  })
})
