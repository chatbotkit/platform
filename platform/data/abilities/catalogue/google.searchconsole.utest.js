import { extractDataFromInput } from '@/lib/extract.data'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

import { executeTemplate, setupServer } from '@/jest/utils/ability'

import templates from './google.searchconsole'

import { HttpResponse, http } from 'msw'

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

const SITE_URL = 'https://example.com/'
const SITE_URL_ENCODED = 'https%3A%2F%2Fexample.com%2F'
const PAGE_URL = 'https://example.com/blog/seo-post'

const server = setupServer(
  http.get(
    'https://searchconsole.googleapis.com/invalid-endpoint-that-does-not-exist',
    () => {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
  ),

  http.get('https://searchconsole.googleapis.com/webmasters/v3/sites', () => {
    return HttpResponse.json({
      siteEntry: [
        {
          siteUrl: SITE_URL,
          permissionLevel: 'siteOwner',
        },
      ],
    })
  }),

  http.get(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${SITE_URL_ENCODED}/sitemaps`,
    () => {
      return HttpResponse.json({
        sitemap: [
          {
            path: `${SITE_URL}sitemap.xml`,
            lastSubmitted: '2026-04-01T00:00:00.000Z',
            isPending: false,
          },
        ],
      })
    }
  ),

  http.post(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${SITE_URL_ENCODED}/searchAnalytics/query`,
    async () => {
      return HttpResponse.json({
        rows: [
          {
            keys: ['seo tools'],
            clicks: 42,
            impressions: 1200,
            ctr: 0.035,
            position: 6.4,
          },
        ],
      })
    }
  ),

  http.post(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    async () => {
      return HttpResponse.json({
        inspectionResult: {
          inspectionResultLink: 'https://search.google.com/search-console',
          indexStatusResult: {
            verdict: 'PASS',
            coverageState: 'Submitted and indexed',
          },
        },
      })
    }
  ),

  http.post(
    'https://indexing.googleapis.com/v3/urlNotifications:publish',
    () => {
      return HttpResponse.json({
        urlNotificationMetadata: {
          latestUpdate: {
            url: PAGE_URL,
            type: 'URL_UPDATED',
          },
        },
      })
    }
  )
)

beforeAll(async () => {
  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('litmus tests', () => {
  it('should accept valid endpoints', async () => {
    const response = await fetch(
      'https://searchconsole.googleapis.com/webmasters/v3/sites'
    )

    expect(response.status).toBe(200)
  })

  it('should reject invalid endpoints', async () => {
    const response = await fetch(
      'https://searchconsole.googleapis.com/invalid-endpoint-that-does-not-exist'
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

  const testableTemplates = Object.keys(templates).filter(
    (template) => !template.startsWith('pack')
  )

  it.each(testableTemplates)(`testing template %s`, async (template) => {
    const { error } = await executeTemplate(user, template, {
      processInput: (input) => {
        if (input.siteUrlEncoded) {
          input.siteUrlEncoded = SITE_URL_ENCODED
        }

        if (input.siteUrl) {
          input.siteUrl = SITE_URL
        }

        if (input.inspectionUrl) {
          input.inspectionUrl = PAGE_URL
        }

        if (input.url) {
          input.url = PAGE_URL
        }

        if (input.startDate) {
          input.startDate = '2026-03-01'
        }

        if (input.endDate) {
          input.endDate = '2026-03-31'
        }

        if (input.dimensions) {
          input.dimensions = ['query']
        }

        return input
      },
    })

    expect(error).toBeUndefined()
    expect(extractDataFromInput).not.toHaveBeenCalled()
  })
})
