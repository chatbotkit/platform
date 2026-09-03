import fetch from '@/lib/fetch'

describe('v1', () => {
  it('fetching widget v1 should return 200 ok with content-type of application/javascript', async () => {
    const response = await fetch(
      new URL(
        '/integrations/widget/v1.js',
        process.env._ITEST_CHATBOTKIT_BASE_URL
      ).href
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain(
      'application/javascript'
    )

    const text = await response.text()

    expect(text).toContain('chatbotkit-widget')
  })
})

describe('v2', () => {
  it('fetching widget v2 should return 200 ok with content-type of application/javascript', async () => {
    const response = await fetch(
      new URL(
        '/integrations/widget/v2.js',
        process.env._ITEST_CHATBOTKIT_BASE_URL
      ).href
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain(
      'application/javascript'
    )

    const text = await response.text()

    expect(text).toContain('chatbotkit-widget')
  })
})
