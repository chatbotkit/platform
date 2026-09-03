/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 */
import { fromOpenApi } from '@msw/source/open-api'

import { setupServer } from 'msw/node'

const DEFINITION = 'https://petstore.swagger.io/v2/swagger.json'

const server = setupServer()

beforeAll(async () => {
  const response = await fetch(DEFINITION)

  if (!response.ok) {
    throw new Error(`Cannot fetch ${DEFINITION}`)
  }

  const definition = await response.json()

  if (definition.swagger && !definition.openapi) {
    const scheme = definition.schemes?.[0] || 'https'
    const host = definition.host || 'petstore.swagger.io'
    const basePath = definition.basePath || ''

    definition.openapi = '3.0.0'

    definition.servers = [{ url: `${scheme}://${host}${basePath}` }]

    delete definition.swagger
    delete definition.host
    delete definition.basePath
    delete definition.schemes
  }

  const handlers = await fromOpenApi(definition)

  server.use(...handlers)

  server.listen()
})

afterAll(async () => {
  server.close()
})

describe('HTTP Mocking Test', () => {
  it('should handle valid GET requests', async () => {
    const response = await fetch('https://petstore.swagger.io/v2/pet/1')

    expect(response.status).toBe(200)
  })
})
