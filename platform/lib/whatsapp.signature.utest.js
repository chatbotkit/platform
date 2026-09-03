import { getHeader } from '@/lib/header'
import { createHmacHexDigest } from '@/lib/webcrypto'

import {
  extractWhatsAppSignature,
  validateWhatsAppRequest,
  validateWhatsAppSignature,
} from './whatsapp.signature'

jest.mock('@/lib/webcrypto', () => ({
  ...jest.requireActual('@/lib/webcrypto'),

  createHmacHexDigest: jest.fn(),
}))

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
}))

describe('WhatsApp signature validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates the raw request body with the Meta app secret', async () => {
    createHmacHexDigest.mockResolvedValue('abc123')

    await expect(
      validateWhatsAppSignature(
        '{"entry":[]}',
        'sha256=abc123',
        'meta-app-secret'
      )
    ).resolves.toBe(true)

    expect(createHmacHexDigest).toHaveBeenCalledWith(
      'sha256',
      'meta-app-secret',
      '{"entry":[]}'
    )
  })

  it('rejects an invalid signature', async () => {
    createHmacHexDigest.mockResolvedValue('expected')

    await expect(
      validateWhatsAppSignature(
        '{"entry":[]}',
        'sha256=invalid',
        'meta-app-secret'
      )
    ).rejects.toThrow('Invalid signature')
  })

  it('rejects a missing app secret', async () => {
    await expect(
      validateWhatsAppSignature('{"entry":[]}', 'sha256=abc123', '')
    ).rejects.toThrow('Missing WhatsApp app secret')

    expect(createHmacHexDigest).not.toHaveBeenCalled()
  })

  it('extracts X-Hub-Signature-256', () => {
    const req = { headers: {} }

    getHeader.mockReturnValue('sha256=abc123')

    expect(extractWhatsAppSignature(req)).toBe('sha256=abc123')
    expect(getHeader).toHaveBeenCalledWith(req, 'x-hub-signature-256')
  })

  it('rejects a missing or malformed signature header', () => {
    const req = { headers: {} }

    getHeader.mockReturnValueOnce(null)
    expect(() => extractWhatsAppSignature(req)).toThrow(
      'Missing X-Hub-Signature-256 header'
    )

    getHeader.mockReturnValueOnce('md5=abc123')
    expect(() => extractWhatsAppSignature(req)).toThrow(
      'Invalid signature format'
    )
  })

  it('validates a complete request', async () => {
    const req = { headers: {} }

    getHeader.mockReturnValue('sha256=abc123')
    createHmacHexDigest.mockResolvedValue('abc123')

    await expect(
      validateWhatsAppRequest(req, '{"entry":[]}', 'meta-app-secret')
    ).resolves.toBe(true)
  })
})
