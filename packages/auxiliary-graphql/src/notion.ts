import { builder } from './builder'

/**
 * Notion auxiliary schema.
 * This module provides namespaced GraphQL types and operations for Notion integration.
 */

// @note notion search result item type
const NotionSearchResultItem = builder
  .objectRef<{
    id: string
    title: string
    type: string
    url?: string
  }>('NotionSearchResultItem')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id', {
        description: 'Unique identifier of the Notion item',
      }),
      title: t.exposeString('title', {
        description: 'Title of the Notion page or database',
      }),
      type: t.exposeString('type', {
        description: 'Type of the item (page, database, etc.)',
      }),
      url: t.exposeString('url', {
        nullable: true,
        description: 'URL to the Notion item',
      }),
    }),
  })

// @note notion search result type
const NotionSearchResult = builder
  .objectRef<{
    items: Array<{
      id: string
      title: string
      type: string
      url?: string
    }>
    total: number
  }>('NotionSearchResult')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [NotionSearchResultItem],
        resolve: (parent) => parent.items,
        description: 'Array of search result items',
      }),
      total: t.exposeInt('total', {
        description: 'Total number of results found',
      }),
    }),
  })

// @note notion namespace type for organizing all notion-related queries and mutations
export const NotionNamespace = builder
  .objectRef<object>('NotionNamespace')
  .implement({
    fields: (t) => ({
      // @todo add notion-specific query fields here
      version: t.string({
        resolve: () => '1.0.0',
      }),

      // @note search notion content
      search: t.field({
        type: NotionSearchResult,
        args: {
          query: t.arg.string({
            required: true,
            description: 'Search query string',
          }),
        },
        resolve: (_parent, args) => {
          // @todo implement actual notion search logic
          return {
            items: [
              {
                id: 'notion-1',
                title: `Notion result for: ${args.query}`,
                type: 'page',
                url: 'https://notion.so/example',
              },
            ],
            total: 1,
          }
        },
      }),
    }),
  })

// @todo add notion-specific object types
// @todo add notion-specific queries
// @todo add notion-specific mutations
