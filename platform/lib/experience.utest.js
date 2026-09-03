import {
  getExperienceHostname,
  isBuilderExperienceHostname,
  isPlatformExperienceHostname,
} from './experience'

// @note which hosts serve the builder experience is deployment data - the
// suite pins the hosted-style fixture it was written against
beforeAll(() => {
  process.env.EXPERIENCE_BUILDER_HOSTS = 'chatbotkit.com,*.chatbotkit.com'
})

afterAll(() => {
  delete process.env.EXPERIENCE_BUILDER_HOSTS
})

describe('experience hostname detection', () => {
  describe('getExperienceHostname', () => {
    it('should return first hostname from comma-separated list', () => {
      const result = getExperienceHostname('example.com,other.com')

      expect(result).toBe('example.com')
    })

    it('should trim whitespace from hostname', () => {
      const result = getExperienceHostname('  example.com  ,other.com')

      expect(result).toBe('example.com')
    })

    it('should strip port from hostname', () => {
      const result = getExperienceHostname('example.com:3000')

      expect(result).toBe('example.com')
    })

    it('should handle null or undefined hostname with fallback', () => {
      const result = getExperienceHostname(null)

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should handle undefined hostname with fallback', () => {
      const result = getExperienceHostname(undefined)

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should handle empty string with fallback', () => {
      const result = getExperienceHostname('')

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should extract first part from port in URL format', () => {
      const result = getExperienceHostname('localhost:8080')

      expect(result).toBe('localhost')
    })

    it('should NOT strip trailing dot from hostname', () => {
      const result = getExperienceHostname('example.com.')

      // getExperienceHostname doesn't strip trailing dot
      // that's handled in isBuilderExperienceHostname
      expect(result).toBe('example.com.')
    })

    it('should handle hostname with multiple subdomains', () => {
      const result = getExperienceHostname('api.service.example.com')

      expect(result).toBe('api.service.example.com')
    })
  })

  describe('isBuilderExperienceHostname', () => {
    it('should identify chatbotkit.com as builder hostname', () => {
      const result = isBuilderExperienceHostname('chatbotkit.com')

      expect(result).toBe(true)
    })

    it('should identify subdomains of chatbotkit.com as builder hostname', () => {
      const result = isBuilderExperienceHostname('builder.chatbotkit.com')

      expect(result).toBe(true)
    })

    it('should identify multiple levels of subdomains as builder hostname', () => {
      const result = isBuilderExperienceHostname('app.builder.chatbotkit.com')

      expect(result).toBe(true)
    })

    it('should identify similar hostnames as NOT builder hostname', () => {
      const result = isBuilderExperienceHostname('chatbotkit.io')

      expect(result).toBe(false)
    })

    it('should identify unrelated hostnames as NOT builder hostname', () => {
      const result = isBuilderExperienceHostname('example.com')

      expect(result).toBe(false)
    })

    it('should be case insensitive', () => {
      const result = isBuilderExperienceHostname('CHATBOTKIT.COM')

      expect(result).toBe(true)
    })

    it('should be case insensitive for subdomains', () => {
      const result = isBuilderExperienceHostname('Builder.CHATBOTKIT.COM')

      expect(result).toBe(true)
    })

    it('should handle null or undefined hostname with fallback', () => {
      const result = isBuilderExperienceHostname(null)

      expect(typeof result).toBe('boolean')
    })

    it('should normalize trailing dots before comparison', () => {
      const result = isBuilderExperienceHostname('chatbotkit.com.')

      expect(result).toBe(true)
    })

    it('should normalize trailing dots for subdomains', () => {
      const result = isBuilderExperienceHostname('builder.chatbotkit.com.')

      expect(result).toBe(true)
    })

    it('should reject hostnames ending with chatbotkit.com but with extra prefix', () => {
      const result = isBuilderExperienceHostname('notchatbotkit.com')

      expect(result).toBe(false)
    })

    it('should handle port numbers', () => {
      const result = isBuilderExperienceHostname('chatbotkit.com:3000')

      expect(result).toBe(true)
    })

    it('should handle subdomains with port numbers', () => {
      const result = isBuilderExperienceHostname('builder.chatbotkit.com:3000')

      expect(result).toBe(true)
    })
  })

  describe('isPlatformExperienceHostname', () => {
    it('should identify non-chatbotkit hostnames as platform hostnames', () => {
      const result = isPlatformExperienceHostname('example.com')

      expect(result).toBe(true)
    })

    it('should identify chatbotkit.com as NOT platform hostname', () => {
      const result = isPlatformExperienceHostname('chatbotkit.com')

      expect(result).toBe(false)
    })

    it('should identify chatbotkit subdomains as NOT platform hostnames', () => {
      const result = isPlatformExperienceHostname('builder.chatbotkit.com')

      expect(result).toBe(false)
    })

    it('should identify custom platform domains as platform hostnames', () => {
      const result = isPlatformExperienceHostname('mybot.example.com')

      expect(result).toBe(true)
    })

    it('should identify localhost as platform hostname', () => {
      const result = isPlatformExperienceHostname('localhost')

      expect(result).toBe(true)
    })

    it('should handle null or undefined hostname', () => {
      const result = isPlatformExperienceHostname(null)

      expect(typeof result).toBe('boolean')
    })

    it('should be inverse of isBuilderExperienceHostname', () => {
      const testCases = [
        'chatbotkit.com',
        'builder.chatbotkit.com',
        'example.com',
        'custom.platform.com',
      ]

      testCases.forEach((hostname) => {
        const isBuilder = isBuilderExperienceHostname(hostname)
        const isPlatform = isPlatformExperienceHostname(hostname)

        expect(isBuilder).toBe(!isPlatform)
      })
    })
  })

  describe('hostname detection edge cases', () => {
    it('should handle empty string across all functions', () => {
      const hostname = ''

      const experience = getExperienceHostname(hostname)

      expect(experience).toBeTruthy()

      // The result should be consistent
      const isBuilder = isBuilderExperienceHostname(hostname)
      const isPlatform = isPlatformExperienceHostname(hostname)

      expect(isBuilder).toBe(!isPlatform)
    })

    it('should handle very long hostnames', () => {
      const longHostname = 'very.long.subdomain.chain.example.com'

      const result = getExperienceHostname(longHostname)

      expect(result).toBe(longHostname)
    })

    it('should handle IPv4 addresses', () => {
      const ipv4 = '192.168.1.1'

      const result = getExperienceHostname(ipv4)

      expect(result).toBe('192.168.1.1')
    })

    it('should handle IPv4 addresses with ports', () => {
      const ipv4WithPort = '192.168.1.1:3000'

      const result = getExperienceHostname(ipv4WithPort)

      expect(result).toBe('192.168.1.1')
    })

    it('should handle multiple commas in hostname list', () => {
      const result = getExperienceHostname('first.com,second.com,third.com')

      expect(result).toBe('first.com')
    })

    it('should handle single hostname without commas', () => {
      const result = getExperienceHostname('single.example.com')

      expect(result).toBe('single.example.com')
    })
  })
})
