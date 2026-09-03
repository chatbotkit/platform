import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import {
  createOpenApiHandlers,
  executeTemplate,
  setupServer,
} from '@/jest/utils/ability'

import templates from './reddit'

import { HttpResponse, http } from 'msw'
import { join } from 'path'

jest.mock('@/lib/usage.record', () => ({
  recordFetchUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => {
  const originalModule = jest.requireActual('@/lib/limit.core')

  return {
    ...originalModule,

    accountLimitsOk: jest.fn(),
  }
})

jest.mock('@/lib/extract.data', () => ({
  extractDataFromInput: jest.fn(),
}))

jest.retryTimes(3)

const DEFINITION = join(__dirname, 'reddit.openapi.yaml')

// @note mock RSS/XML response for Reddit feeds
const MOCK_RSS_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock Reddit Feed</title>
    <link>https://www.reddit.com</link>
    <description>Mock RSS feed for testing</description>
    <item>
      <title>Test Post</title>
      <link>https://www.reddit.com/r/test/comments/abc123/test_post/</link>
      <description>This is a test post</description>
    </item>
  </channel>
</rss>`

// @note custom handlers for RSS endpoints that return XML
const rssHandlers = [
  // Front page
  http.get('https://www.reddit.com/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // Subreddit feeds (with sort)
  http.get('https://www.reddit.com/r/:subreddit/:sort/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // Subreddit feeds (default)
  http.get('https://www.reddit.com/r/:subreddit/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // Domain feeds
  http.get('https://www.reddit.com/domain/:domain/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // Post comments
  http.get('https://www.reddit.com/r/:subreddit/comments/:postId/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // User feeds
  http.get('https://www.reddit.com/user/:username/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  http.get('https://www.reddit.com/user/:username/:feedType/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  http.get('https://www.reddit.com/user/:username/comments/.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // Search feeds
  http.get('https://www.reddit.com/r/:subreddit/search.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  http.get('https://www.reddit.com/search.rss', () => {
    return HttpResponse.xml(MOCK_RSS_RESPONSE)
  }),
  // OAuth API - post and comment creation
  http.post('https://oauth.reddit.com/api/submit', () => {
    return HttpResponse.json({
      success: true,
      jquery: [],
      data: {
        url: 'https://www.reddit.com/r/test/comments/abc123/test/',
        id: 'abc123',
        name: 't3_abc123',
      },
    })
  }),
  http.post('*/api/auxiliary/skillset/ability/reddit/post', () => {
    return HttpResponse.json({
      id: 'abc123',
      name: 't3_abc123',
      url: 'https://www.reddit.com/r/test/comments/abc123/test/',
    })
  }),
  http.post('https://oauth.reddit.com/api/comment', () => {
    return HttpResponse.json({
      success: true,
      jquery: [],
      data: { things: [] },
    })
  }),
]

const server = setupServer()

beforeAll(async () => {
  const { handlers } = await createOpenApiHandlers(DEFINITION)

  // @note add RSS handlers before OpenAPI handlers for priority
  server.use(...rssHandlers, ...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid RSS endpoints', async () => {
    const response = await fetch(
      'https://www.reddit.com/r/programming/new/.rss?sort=new'
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://www.reddit.com/invalid-endpoint-that-does-not-exist'
    )

    expect(response.status).not.toBe(200)
  })
})

describe('templates', () => {
  const user = {
    id: 'user-123',
  }

  beforeEach(() => {
    fastGetUserById.mockResolvedValue(user)
    accountLimitsOk.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const untestableTemplates = [
    'reddit/api/call',
    'pack/reddit',
    'pack/reddit[read-only]',
  ]

  const testableTemplates = Object.keys(templates).filter(
    (template) =>
      !template.startsWith('pack') && !untestableTemplates.includes(template)
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        // @note ensure domain is valid
        if (input.domain) {
          input.domain = 'example.com'
        }

        // @note ensure subreddit name is valid
        if (input.subreddit) {
          input.subreddit = 'programming'
        }

        // @note ensure subreddits (multi) is valid
        if (input.subreddits) {
          input.subreddits = 'programming+javascript'
        }

        // @note ensure username is valid
        if (input.username) {
          input.username = 'testuser'
        }

        // @note ensure postId is valid
        if (input.postId) {
          input.postId = 'abc123'
        }

        // @note ensure query is valid for search
        if (input.query) {
          input.query = 'marketing'
        }

        // @note ensure subreddit name is valid for post creation
        if (input.sr) {
          input.sr = 'test'
        }

        // @note provide valid parent full name for comment creation
        if (input.parent) {
          input.parent = 't3_abc123'
        }

        // @note provide minimal post body for text posts
        if (input.text !== undefined) {
          input.text = 'This is a test post or comment.'
        }

        // @note provide valid title for posts
        if (input.title !== undefined) {
          input.title = 'Test post title'
        }

        // @note provide valid kind for post type
        if (input.kind !== undefined) {
          input.kind = 'self'
        }

        return input
      },
    })

    expect(error).toBeUndefined()

    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
