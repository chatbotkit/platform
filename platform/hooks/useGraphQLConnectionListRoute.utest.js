import useGraphQLConnectionListRoute from './useGraphQLConnectionListRoute'

import { act, renderHook } from '@testing-library/react'

import fetch from '@/lib/fetch'

jest.mock('@/lib/fetch', () => jest.fn())

const QUERY = `
  query TestItems(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
  ) {
    items(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
    ) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

describe('useGraphQLConnectionListRoute', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it('should traverse a descending connection with first and after', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: {
            edges: [{ node: { id: 'item-2' } }],
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: true,
              startCursor: 'cursor-2',
              endCursor: 'cursor-2',
            },
          },
        },
      }),
    })

    const { result } = renderHook(() =>
      useGraphQLConnectionListRoute({
        query: QUERY,
        connection: 'items',
      })
    )

    let response

    await act(async () => {
      response = await result.current({
        cursor: 'cursor-1',
        take: 10,
        order: 'desc',
      })
    })

    const request = JSON.parse(fetch.mock.calls[0][1].body)

    expect(request.variables).toEqual({
      first: 10,
      after: 'cursor-1',
      last: null,
      before: null,
      order: 'desc',
    })
    expect(response).toEqual({
      items: [{ id: 'item-2' }],
      cursor: 'cursor-2',
    })
  })

  it('should change server ordering without reversing connection traversal', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: {
            edges: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      }),
    })

    const { result } = renderHook(() =>
      useGraphQLConnectionListRoute({
        query: QUERY,
        connection: 'items',
      })
    )

    await act(async () => {
      await result.current({ cursor: 'cursor-1', take: 5, order: 'asc' })
    })

    const request = JSON.parse(fetch.mock.calls[0][1].body)

    expect(request.variables).toEqual({
      first: 5,
      after: 'cursor-1',
      last: null,
      before: null,
      order: 'asc',
    })
  })
})
