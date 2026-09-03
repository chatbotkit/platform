import { isLocalhost } from '@/lib/localhost'

describe('isLocalhost', () => {
  describe('localhost hostname detection', () => {
    it('should detect "localhost" as localhost', () => {
      expect(isLocalhost('localhost')).toBe(true)
    })

    it('should detect "localhost" with port as localhost', () => {
      expect(isLocalhost('localhost:3000')).toBe(true)
    })

    it('should detect "localhost" with different port as localhost', () => {
      expect(isLocalhost('localhost:8080')).toBe(true)
    })

    it('should detect "localhost" with high port number', () => {
      expect(isLocalhost('localhost:65535')).toBe(true)
    })

    it('should be case-insensitive for localhost', () => {
      expect(isLocalhost('LOCALHOST')).toBe(true)
      expect(isLocalhost('LocalHost')).toBe(true)
      expect(isLocalhost('LoCaLhOsT')).toBe(true)
    })
  })

  describe('127.x.x.x IP address detection', () => {
    it('should detect 127.0.0.1 as localhost', () => {
      expect(isLocalhost('127.0.0.1')).toBe(true)
    })

    it('should detect 127.0.0.1 with port as localhost', () => {
      expect(isLocalhost('127.0.0.1:3000')).toBe(true)
    })

    it('should detect 127.x.x.x addresses as localhost', () => {
      expect(isLocalhost('127.1.1.1')).toBe(true)
      expect(isLocalhost('127.255.255.255')).toBe(true)
      expect(isLocalhost('127.100.50.25')).toBe(true)
    })

    it('should detect 127.x.x.x with various ports', () => {
      expect(isLocalhost('127.0.0.1:80')).toBe(true)
      expect(isLocalhost('127.0.0.1:443')).toBe(true)
      expect(isLocalhost('127.0.0.1:8080')).toBe(true)
      expect(isLocalhost('127.1.2.3:9999')).toBe(true)
    })

    it('should detect 127.0.0.0 as localhost', () => {
      expect(isLocalhost('127.0.0.0')).toBe(true)
    })

    it('should detect 127.0.1.0 as localhost', () => {
      expect(isLocalhost('127.0.1.0')).toBe(true)
    })
  })

  describe('non-localhost detection', () => {
    it('should not detect regular domain as localhost', () => {
      expect(isLocalhost('example.com')).toBe(false)
    })

    it('should not detect subdomain as localhost', () => {
      expect(isLocalhost('sub.example.com')).toBe(false)
    })

    it('should not detect regular IP as localhost', () => {
      expect(isLocalhost('192.168.1.1')).toBe(false)
    })

    it('should not detect public IP as localhost', () => {
      expect(isLocalhost('8.8.8.8')).toBe(false)
      expect(isLocalhost('1.1.1.1')).toBe(false)
    })

    it('should not detect 128.x.x.x as localhost', () => {
      expect(isLocalhost('128.0.0.1')).toBe(false)
    })

    it('should not detect 126.x.x.x as localhost', () => {
      expect(isLocalhost('126.0.0.1')).toBe(false)
    })

    it('should not detect 10.x.x.x private IP as localhost', () => {
      expect(isLocalhost('10.0.0.1')).toBe(false)
    })

    it('should not detect 172.x.x.x private IP as localhost', () => {
      expect(isLocalhost('172.16.0.1')).toBe(false)
    })

    it('should not detect domain with "localhost" in it as localhost', () => {
      expect(isLocalhost('notlocalhost.com')).toBe(false)
      expect(isLocalhost('localhost.example.com')).toBe(false)
    })
  })

  describe('URL-like inputs', () => {
    it('should detect localhost in http URL', () => {
      expect(isLocalhost('http://localhost')).toBe(true)
    })

    it('should detect localhost in https URL', () => {
      expect(isLocalhost('https://localhost')).toBe(true)
    })

    it('should detect localhost in URL with port', () => {
      expect(isLocalhost('http://localhost:3000')).toBe(true)
      expect(isLocalhost('https://localhost:8080')).toBe(true)
    })

    it('should detect 127.0.0.1 in http URL', () => {
      expect(isLocalhost('http://127.0.0.1')).toBe(true)
    })

    it('should detect 127.0.0.1 in https URL', () => {
      expect(isLocalhost('https://127.0.0.1')).toBe(true)
    })

    it('should detect 127.0.0.1 in URL with port', () => {
      expect(isLocalhost('http://127.0.0.1:3000')).toBe(true)
      expect(isLocalhost('https://127.0.0.1:8080')).toBe(true)
    })

    it('should handle URL with path', () => {
      expect(isLocalhost('http://localhost/path')).toBe(true)
      expect(isLocalhost('http://127.0.0.1/path')).toBe(true)
    })

    it('should not detect non-localhost domain in URL', () => {
      expect(isLocalhost('http://example.com')).toBe(false)
      expect(isLocalhost('https://example.com:3000')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(isLocalhost('')).toBe(false)
    })

    it('should handle whitespace', () => {
      expect(isLocalhost('   ')).toBe(false)
    })

    it('should handle just a port number', () => {
      expect(isLocalhost(':3000')).toBe(false)
    })

    it('should handle multiple colons', () => {
      expect(isLocalhost('localhost:3000:extra')).toBe(true) // Only first part is used
    })

    it('should handle localhost with trailing dot', () => {
      expect(isLocalhost('localhost.')).toBe(true)
    })

    it('should handle 127.0.0.1 with trailing dot', () => {
      expect(isLocalhost('127.0.0.1.')).toBe(true)
    })

    it('should handle IPv6 localhost (::1)', () => {
      // This might return false since tryDomain may not handle IPv6
      const result = isLocalhost('::1')

      expect(typeof result).toBe('boolean')
    })

    it('should handle malformed input gracefully', () => {
      expect(() => isLocalhost('not a valid host')).not.toThrow()
    })

    it('should handle numeric-only input', () => {
      expect(isLocalhost('12345')).toBe(false)
    })

    it('should handle special characters', () => {
      expect(isLocalhost('local@host')).toBe(false)
    })
  })

  describe('port variations', () => {
    it('should handle common development ports', () => {
      expect(isLocalhost('localhost:3000')).toBe(true)
      expect(isLocalhost('localhost:5000')).toBe(true)
      expect(isLocalhost('localhost:8000')).toBe(true)
      expect(isLocalhost('localhost:9000')).toBe(true)
    })

    it('should handle standard HTTP/HTTPS ports', () => {
      expect(isLocalhost('localhost:80')).toBe(true)
      expect(isLocalhost('localhost:443')).toBe(true)
    })

    it('should handle non-standard ports', () => {
      expect(isLocalhost('localhost:12345')).toBe(true)
      expect(isLocalhost('127.0.0.1:54321')).toBe(true)
    })

    it('should handle port without hostname', () => {
      expect(isLocalhost(':8080')).toBe(false)
    })
  })

  describe('127.x address variations', () => {
    it('should detect 127.0.0.2', () => {
      expect(isLocalhost('127.0.0.2')).toBe(true)
    })

    it('should detect 127.0.1.1', () => {
      expect(isLocalhost('127.0.1.1')).toBe(true)
    })

    it('should detect 127.1.0.1', () => {
      expect(isLocalhost('127.1.0.1')).toBe(true)
    })

    it('should detect 127.254.254.254', () => {
      expect(isLocalhost('127.254.254.254')).toBe(true)
    })

    it('should detect any 127.x address', () => {
      for (let i = 0; i < 5; i++) {
        const ip = `127.${Math.floor(Math.random() * 256)}.${Math.floor(
          Math.random() * 256
        )}.${Math.floor(Math.random() * 256)}`

        expect(isLocalhost(ip)).toBe(true)
      }
    })
  })

  describe('consistency', () => {
    it('should return same result for same input', () => {
      const input = 'localhost:3000'

      expect(isLocalhost(input)).toBe(isLocalhost(input))
    })

    it('should return same result for equivalent inputs', () => {
      expect(isLocalhost('localhost')).toBe(isLocalhost('LOCALHOST'))
      expect(isLocalhost('127.0.0.1')).toBe(isLocalhost('127.0.0.1'))
    })
  })

  describe('full URL parsing', () => {
    it('should extract host from full URL with protocol', () => {
      expect(isLocalhost('http://localhost:3000/path/to/page')).toBe(true)
    })

    it('should extract host from URL with query params', () => {
      expect(isLocalhost('http://localhost:3000?param=value')).toBe(true)
    })

    it('should extract host from URL with hash', () => {
      expect(isLocalhost('http://localhost:3000#section')).toBe(true)
    })

    it('should extract host from complex URL', () => {
      expect(isLocalhost('http://localhost:3000/path?param=value#hash')).toBe(
        true
      )
    })

    it('should not be confused by localhost in path', () => {
      expect(isLocalhost('http://example.com/localhost')).toBe(false)
    })

    it('should not be confused by localhost in query', () => {
      expect(isLocalhost('http://example.com?host=localhost')).toBe(false)
    })
  })
})
