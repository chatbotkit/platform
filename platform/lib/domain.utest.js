/* eslint-disable @typescript-eslint/no-require-imports */
import {
  getRegisterableName,
  getRootDomain,
  tryGetRegistrableName,
  tryGetRootDomain,
} from './domain'

import { ParseResultType } from 'parse-domain'

jest.mock('parse-domain', () => ({
  ParseResultType: {
    Invalid: 'INVALID',
    NotListed: 'NOT_LISTED',
    Reserved: 'RESERVED',
    Ip: 'IP',
    Listed: 'LISTED',
  },
  parseDomain: jest.fn(),
}))

const { parseDomain } = require('parse-domain')

describe('domain', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getRootDomain', () => {
    describe('basic functionality', () => {
      it('should extract root domain from a standard domain', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'example.com',
        })

        const result = getRootDomain('example.com')

        expect(result).toBe('example.com')
      })

      it('should extract root domain from subdomain', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'subdomain.example.com',
        })

        const result = getRootDomain('subdomain.example.com')

        expect(result).toBe('example.com')
      })

      it('should handle multi-level TLDs', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['co', 'uk'],
          hostname: 'example.co.uk',
        })

        const result = getRootDomain('example.co.uk')

        expect(result).toBe('example.co.uk')
      })

      it('should lowercase the domain', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'Example',
          topLevelDomains: ['COM'],
          hostname: 'Example.COM',
        })

        const result = getRootDomain('Example.COM')

        expect(result).toBe('example.com')
      })

      it('should remove trailing dots', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'example.com.',
        })

        const result = getRootDomain('example.com.')

        expect(result).toBe('example.com')
      })
    })

    describe('special domain types', () => {
      it('should handle reserved domains', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Reserved,
          hostname: 'localhost',
        })

        const result = getRootDomain('localhost')

        expect(result).toBe('localhost')
      })

      it('should handle IP addresses', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Ip,
          hostname: '192.168.1.1',
        })

        const result = getRootDomain('192.168.1.1')

        expect(result).toBe('192.168.1.1')
      })

      it('should handle IPv6 addresses', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Ip,
          hostname: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        })

        const result = getRootDomain('2001:0db8:85a3:0000:0000:8a2e:0370:7334')

        expect(result).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
      })

      it('should handle hostname when domain is missing', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: null,
          topLevelDomains: ['com'],
          hostname: 'single',
        })

        const result = getRootDomain('single')

        expect(result).toBe('single')
      })
    })

    describe('edge cases', () => {
      it('should handle domains with multiple trailing dots', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'example.com...',
        })

        const result = getRootDomain('example.com...')

        expect(result).toBe('example.com')
      })

      it('should handle mixed case domains', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'ExAmPlE',
          topLevelDomains: ['CoM'],
          hostname: 'ExAmPlE.CoM',
        })

        const result = getRootDomain('ExAmPlE.CoM')

        expect(result).toBe('example.com')
      })

      it('should handle deeply nested subdomains', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'a.b.c.d.example.com',
        })

        const result = getRootDomain('a.b.c.d.example.com')

        expect(result).toBe('example.com')
      })
    })

    describe('error handling', () => {
      it('should throw error for invalid domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Invalid,
        })

        expect(() => getRootDomain('invalid domain with spaces')).toThrow(
          'Invalid domain'
        )
      })

      it('should throw error for not listed domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.NotListed,
        })

        expect(() => getRootDomain('example.unknowntld')).toThrow(
          'Not listed domain'
        )
      })
    })
  })

  describe('tryGetRootDomain', () => {
    describe('basic functionality', () => {
      it('should return root domain on success', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'example.com',
        })

        const result = tryGetRootDomain('example.com')

        expect(result).toBe('example.com')
      })

      it('should return null for invalid domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Invalid,
        })

        const result = tryGetRootDomain('invalid domain')

        expect(result).toBeNull()
      })

      it('should return null for not listed domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.NotListed,
        })

        const result = tryGetRootDomain('example.unknowntld')

        expect(result).toBeNull()
      })

      it('should not throw errors', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Invalid,
        })

        expect(() => tryGetRootDomain('invalid')).not.toThrow()
      })
    })
  })

  describe('getRegisterableName', () => {
    describe('basic functionality', () => {
      it('should extract registerable name from domain', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'example.com',
        })

        const result = getRegisterableName('example.com')

        expect(result).toBe('example')
      })

      it('should extract name from subdomain', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'google',
          topLevelDomains: ['com'],
          hostname: 'mail.google.com',
        })

        const result = getRegisterableName('mail.google.com')

        expect(result).toBe('google')
      })

      it('should lowercase the name', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'Google',
          topLevelDomains: ['com'],
          hostname: 'Google.com',
        })

        const result = getRegisterableName('Google.com')

        expect(result).toBe('google')
      })

      it('should handle multi-level TLDs', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['co', 'uk'],
          hostname: 'example.co.uk',
        })

        const result = getRegisterableName('example.co.uk')

        expect(result).toBe('example')
      })
    })

    describe('special domain types', () => {
      it('should return full hostname for reserved domains', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Reserved,
          hostname: 'localhost',
        })

        const result = getRegisterableName('localhost')

        expect(result).toBe('localhost')
      })

      it('should return full hostname for IP addresses', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Ip,
          hostname: '192.168.1.1',
        })

        const result = getRegisterableName('192.168.1.1')

        expect(result).toBe('192.168.1.1')
      })

      it('should return hostname when domain is null', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: null,
          topLevelDomains: ['com'],
          hostname: 'single',
        })

        const result = getRegisterableName('single')

        expect(result).toBe('single')
      })
    })

    describe('edge cases', () => {
      it('should handle empty domain string', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: '',
          topLevelDomains: ['com'],
          hostname: 'hostname',
        })

        const result = getRegisterableName('hostname')

        expect(result).toBe('hostname')
      })

      it('should handle mixed case input', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'ExAmPlE',
          topLevelDomains: ['com'],
          hostname: 'ExAmPlE.com',
        })

        const result = getRegisterableName('ExAmPlE.com')

        expect(result).toBe('example')
      })
    })

    describe('error handling', () => {
      it('should throw error for invalid domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Invalid,
        })

        expect(() => getRegisterableName('invalid domain')).toThrow(
          'Invalid domain'
        )
      })

      it('should throw error for not listed domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.NotListed,
        })

        expect(() => getRegisterableName('example.unknowntld')).toThrow(
          'Not listed domain'
        )
      })
    })
  })

  describe('tryGetRegistrableName', () => {
    describe('basic functionality', () => {
      it('should return registerable name on success', () => {
        parseDomain.mockReturnValue({
          type: 'LISTED',
          domain: 'example',
          topLevelDomains: ['com'],
          hostname: 'example.com',
        })

        const result = tryGetRegistrableName('example.com')

        expect(result).toBe('example')
      })

      it('should return null for invalid domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Invalid,
        })

        const result = tryGetRegistrableName('invalid domain')

        expect(result).toBeNull()
      })

      it('should return null for not listed domain', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.NotListed,
        })

        const result = tryGetRegistrableName('example.unknowntld')

        expect(result).toBeNull()
      })

      it('should not throw errors', () => {
        parseDomain.mockReturnValue({
          type: ParseResultType.Invalid,
        })

        expect(() => tryGetRegistrableName('invalid')).not.toThrow()
      })
    })
  })
})
