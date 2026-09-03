import { parseMessage } from '@/lib/email.message'

describe('parseMessage', () => {
  it('should parse a valid email message', async () => {
    const mockMessage = 'Subject: Test\n\nThis is a test message'

    const result = await parseMessage(mockMessage)

    expect(result).toEqual({
      attachments: [],
      headers: new Map(Object.entries({ subject: 'Test' })),
      headerLines: [{ key: 'subject', line: 'Subject: Test' }],
      text: 'This is a test message',
      textAsHtml: '<p>This is a test message</p>',
      subject: 'Test',
      html: false,
    })
  })
})
