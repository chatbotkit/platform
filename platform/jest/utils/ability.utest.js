import {
  createOpenApiHandlers,
  createOpenApiHandlersFromDefinition,
  generateAbilityInput,
  getGitHubApiFallbackUrl,
  setupServer,
} from './ability'

const OPENAPI_DEFINITION = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'https://api.example.test',
    },
  ],
  paths: {
    '/items': {
      get: {
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
                example: {
                  ok: true,
                },
              },
            },
          },
        },
      },
    },
  },
}

describe('generateAbilityInput', () => {
  it('generates a flat field object (no `input` wrapper) covering the required fields', () => {
    const ability = {
      instruction: '```text\nProcess ${!alpha} and ${!beta}\n```',
    }

    const input = generateAbilityInput(ability)

    // @note flat contract: fields live at the top level. If the parameter schema
    // ever regresses to the legacy `{ input: { ... } }` wrapper, this generated
    // object would carry an `input` key and drop the actual fields - exactly the
    // bug that silently broke every catalogue template test (the missing fields
    // made the structured transform fall back to LLM extraction). Guard it here
    // so that regression fails as one clear signal instead of a catalogue-wide
    // fan-out.
    expect(input).toBeTruthy()
    expect(input).not.toHaveProperty('input')
    expect(input).toHaveProperty('alpha')
    expect(input).toHaveProperty('beta')
  })

  it('generates an empty object for a fieldless ability', () => {
    const ability = { instruction: 'A static instruction with no fields.' }

    expect(generateAbilityInput(ability)).toEqual({})
  })
})

describe('createOpenApiHandlers', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    } else {
      delete global.fetch
    }
  })

  it('retries transient failures when fetching remote definitions', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('Service Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(OPENAPI_DEFINITION), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      )

    const { handlers, definition } = await createOpenApiHandlers(
      'https://example.test/openapi.json'
    )

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(handlers.length).toBeGreaterThan(0)
    expect(definition.openapi).toBe('3.0.0')
  })

  it('falls back to the GitHub API when raw.githubusercontent.com throttles', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('429: Too Many Requests', {
          status: 429,
          statusText: 'Too Many Requests',
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(OPENAPI_DEFINITION), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        })
      )

    const { handlers, definition } = await createOpenApiHandlers(
      'https://raw.githubusercontent.com/Example/spec/refs/heads/main/reference/openapi.json'
    )

    // @note exactly two fetches: the raw attempt must not burn the retry
    // budget (the throttle is per-IP and outlives any backoff) before the
    // API fallback fires

    expect(global.fetch).toHaveBeenCalledTimes(2)

    const [apiUrl, apiOptions] = global.fetch.mock.calls[1]

    expect(String(apiUrl)).toBe(
      'https://api.github.com/repos/Example/spec/contents/reference/openapi.json?ref=main'
    )
    expect(new Headers(apiOptions?.headers).get('accept')).toBe(
      'application/vnd.github.raw+json'
    )

    expect(handlers.length).toBeGreaterThan(0)
    expect(definition.openapi).toBe('3.0.0')
  })
})

describe('createOpenApiHandlersFromDefinition', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('creates bodyless 204 responses', async () => {
    const { handlers } = await createOpenApiHandlersFromDefinition({
      ...OPENAPI_DEFINITION,
      paths: {
        '/items': {
          delete: {
            responses: {
              204: {
                description: 'Deleted',
                content: {
                  'application/json': {
                    example: {},
                  },
                },
              },
            },
          },
        },
      },
    })

    server.use(...handlers)

    const response = await fetch('https://api.example.test/items', {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
    await expect(response.text()).resolves.toBe('')
  })

  it('normalizes wildcard success statuses', async () => {
    const { handlers } = await createOpenApiHandlersFromDefinition({
      ...OPENAPI_DEFINITION,
      paths: {
        '/items': {
          post: {
            responses: {
              '2XX': {
                description: 'Success',
                content: {
                  'application/json': {
                    example: { ok: true },
                  },
                },
              },
            },
          },
        },
      },
    })

    server.use(...handlers)

    const response = await fetch('https://api.example.test/items', {
      method: 'POST',
    })

    expect(response.status).toBe(200)
  })
})

describe('getGitHubApiFallbackUrl', () => {
  it('maps refs/heads raw URLs to the contents endpoint', () => {
    expect(
      getGitHubApiFallbackUrl(
        'https://raw.githubusercontent.com/PagerDuty/api-schema/refs/heads/main/reference/REST/openapiv3.json'
      )
    ).toBe(
      'https://api.github.com/repos/PagerDuty/api-schema/contents/reference/REST/openapiv3.json?ref=main'
    )
  })

  it('maps bare branch and commit-sha raw URLs to the contents endpoint', () => {
    expect(
      getGitHubApiFallbackUrl(
        'https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero_accounting.yaml'
      )
    ).toBe(
      'https://api.github.com/repos/XeroAPI/Xero-OpenAPI/contents/xero_accounting.yaml?ref=master'
    )

    expect(
      getGitHubApiFallbackUrl(
        'https://raw.githubusercontent.com/firecrawl/firecrawl/2e07269bfa8a5420bf09c79475361c5f340d6b17/apps/api/openapi.json'
      )
    ).toBe(
      'https://api.github.com/repos/firecrawl/firecrawl/contents/apps/api/openapi.json?ref=2e07269bfa8a5420bf09c79475361c5f340d6b17'
    )
  })

  it('returns null for non-GitHub-raw URLs', () => {
    expect(getGitHubApiFallbackUrl('https://example.test/openapi.json')).toBe(
      null
    )
    expect(
      getGitHubApiFallbackUrl('https://raw.githubusercontent.com/owner/repo')
    ).toBe(null)
  })
})
