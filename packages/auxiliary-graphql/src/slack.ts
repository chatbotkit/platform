import { builder } from './builder'

/**
 * Slack auxiliary schema.
 * This module provides namespaced GraphQL types and operations for Slack integration.
 */

// @note slack search result item type
const SlackSearchResultItem = builder
  .objectRef<{
    id: string
    text: string
    channel: string
    user?: string
    timestamp: string
  }>('SlackSearchResultItem')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id', {
        description: 'Unique identifier of the Slack message',
      }),
      text: t.exposeString('text', {
        description: 'Message text content',
      }),
      channel: t.exposeString('channel', {
        description: 'Channel ID or name where the message was posted',
      }),
      user: t.exposeString('user', {
        nullable: true,
        description: 'User ID who posted the message',
      }),
      timestamp: t.exposeString('timestamp', {
        description: 'Message timestamp',
      }),
    }),
  })

// @note slack search result type
const SlackSearchResult = builder
  .objectRef<{
    items: Array<{
      id: string
      text: string
      channel: string
      user?: string
      timestamp: string
    }>
    total: number
  }>('SlackSearchResult')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [SlackSearchResultItem],
        resolve: (parent) => parent.items,
        description: 'Array of search result items',
      }),
      total: t.exposeInt('total', {
        description: 'Total number of results found',
      }),
    }),
  })

// @note slack send message result type
const SlackSendMessageResult = builder
  .objectRef<{
    success: boolean
    messageId?: string
    timestamp?: string
    error?: string
  }>('SlackSendMessageResult')
  .implement({
    fields: (t) => ({
      success: t.exposeBoolean('success', {
        description: 'Whether the message was sent successfully',
      }),
      messageId: t.exposeString('messageId', {
        nullable: true,
        description: 'ID of the sent message',
      }),
      timestamp: t.exposeString('timestamp', {
        nullable: true,
        description: 'Timestamp of the sent message',
      }),
      error: t.exposeString('error', {
        nullable: true,
        description: 'Error message if the operation failed',
      }),
    }),
  })

// @note slack namespace type for organizing all slack-related queries and mutations
export const SlackNamespace = builder
  .objectRef<object>('SlackNamespace')
  .implement({
    fields: (t) => ({
      // @todo add slack-specific query fields here
      version: t.string({
        resolve: () => '1.0.0',
      }),

      // @note search slack messages and channels
      search: t.field({
        type: SlackSearchResult,
        args: {
          query: t.arg.string({
            required: true,
            description: 'Search query string',
          }),
        },
        resolve: (_parent, args) => {
          // @todo implement actual slack search logic
          return {
            items: [
              {
                id: 'slack-1',
                text: `Slack message containing: ${args.query}`,
                channel: 'general',
                user: 'U12345',
                timestamp: new Date().toISOString(),
              },
            ],
            total: 1,
          }
        },
      }),

      // @note send a message to a slack channel
      sendMessage: t.field({
        type: SlackSendMessageResult,
        args: {
          channel: t.arg.string({
            required: true,
            description: 'Channel ID or name to send the message to',
          }),
          text: t.arg.string({
            required: true,
            description: 'Message text content',
          }),
        },
        resolve: (_parent, _args) => {
          // @todo implement actual slack send message logic
          return {
            success: true,
            messageId: `msg-${Date.now()}`,
            timestamp: new Date().toISOString(),
          }
        },
      }),
    }),
  })

// @todo add slack-specific object types
// @todo add slack-specific queries
// @todo add slack-specific mutations

/**
 * Example usage of createHttpField helper:
 *
 * import { createHttpField } from './http-field'
 *
 * getChannels: t.field({
 *   type: ChannelListResult,
 *   args: {
 *     limit: t.arg.int({ required: false }),
 *   },
 *   ...createHttpField({
 *     method: 'GET',
 *     url: (args) => `https://slack.com/api/conversations.list?limit=${args.limit || 100}`,
 *     headers: (args) => ({
 *       'Authorization': `Bearer ${process.env.SLACK_TOKEN}`,
 *     }),
 *     transform: (data) => ({
 *       channels: data.channels,
 *       total: data.channels.length,
 *     }),
 *     onError: (error) => ({
 *       channels: [],
 *       total: 0,
 *       error: error.message,
 *     }),
 *   }),
 * }),
 */
