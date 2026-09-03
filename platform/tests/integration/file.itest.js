import { FileClient } from '@chatbotkit/sdk/file/index.js'

import { z } from 'zod'

const env = z
  .object({
    _ITEST_CHATBOTKIT_BASE_URL: z.string(),
    _ITEST_CHATBOTKIT_SECRET: z.string(),
  })
  .parse(process.env)

describe('FileClient', () => {
  const client = new FileClient({
    baseUrl: env._ITEST_CHATBOTKIT_BASE_URL,
    secret: env._ITEST_CHATBOTKIT_SECRET,
  })

  it('should be able to list files', async () => {
    const files = await client.list()

    expect(files).toBeTruthy()
    expect(Array.isArray(files.items)).toBeTruthy()
    expect(files.items.length).toBeTruthy()
  })

  it('should be able to list files with stream', async () => {
    let total = 0

    for await (const _item of client.list().stream()) {
      total++
    }

    expect(total).toBeTruthy()
  })
})
