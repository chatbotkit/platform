import {
  ALLOWED_FRAME_ANCESTORS,
  DEFAULT_SECURITY_HEADERS,
  EMBEDDABLE_PATHS,
  EMBEDDABLE_SECURITY_HEADERS,
  EXCLUDE_PATHS,
  buildOriginRestrictedCsp,
} from '@/lib/security.headers'

describe('Security Headers Configuration', () => {
  describe('DEFAULT_SECURITY_HEADERS', () => {
    it('should be defined as an object with security properties', () => {
      expect(DEFAULT_SECURITY_HEADERS).toBeInstanceOf(Object)
      expect(Object.keys(DEFAULT_SECURITY_HEADERS).length).toBeGreaterThan(0)
    })

    it('should have restrictive framing protection', () => {
      expect(DEFAULT_SECURITY_HEADERS.xFrameOptions).toBeTruthy()
      expect(typeof DEFAULT_SECURITY_HEADERS.xFrameOptions).toBe('string')
    })

    it('should have content security policy configured', () => {
      expect(DEFAULT_SECURITY_HEADERS.contentSecurityPolicy).toBeTruthy()
      expect(typeof DEFAULT_SECURITY_HEADERS.contentSecurityPolicy).toBe(
        'string'
      )
      expect(
        DEFAULT_SECURITY_HEADERS.contentSecurityPolicy.length
      ).toBeGreaterThan(10)
    })

    it('should include essential security headers', () => {
      const requiredHeaders = [
        'xFrameOptions',
        'contentSecurityPolicy',
        'xContentTypeOptions',
        'strictTransportSecurity',
        'xXssProtection',
      ]

      requiredHeaders.forEach((header) => {
        expect(DEFAULT_SECURITY_HEADERS[header]).toBeDefined()
      })
    })
  })

  describe('EMBEDDABLE_SECURITY_HEADERS', () => {
    const csp = EMBEDDABLE_SECURITY_HEADERS.contentSecurityPolicy

    const directives = Object.fromEntries(
      csp.split(';').map((d) => {
        const [name, ...values] = d.trim().split(/\s+/)

        return [name, values.join(' ')]
      })
    )

    const defaultDirectives = Object.fromEntries(
      DEFAULT_SECURITY_HEADERS.contentSecurityPolicy.split(';').map((d) => {
        const [name, ...values] = d.trim().split(/\s+/)

        return [name, values.join(' ')]
      })
    )

    it('allows framing by any origin, including hybrid app schemes', () => {
      expect(directives['frame-ancestors']).toBe(ALLOWED_FRAME_ANCESTORS)
      expect(directives['frame-ancestors']).toMatch(/^\* /)
      expect(directives['frame-ancestors']).toContain('capacitor:')
      expect(directives['frame-ancestors']).toContain('ionic:')
    })

    it('omits X-Frame-Options so it cannot override frame-ancestors', () => {
      expect(EMBEDDABLE_SECURITY_HEADERS.xFrameOptions).toBe(false)
    })

    it('differs from the default policy only in who may frame it', () => {
      const { 'frame-ancestors': _a, ...rest } = directives
      const { 'frame-ancestors': _b, ...defaultRest } = defaultDirectives

      expect(rest).toEqual(defaultRest)
    })

    it('constrains scripts, connections, forms and base URL', () => {
      expect(directives['default-src']).toBe("'self'")
      expect(directives['script-src']).toMatch(/^'self'/)
      expect(directives['connect-src']).toMatch(/^'self'/)
      expect(directives['form-action']).toBe("'self'")
      expect(directives['base-uri']).toBe("'self'")
    })

    it('keeps the non-framing protections', () => {
      expect(EMBEDDABLE_SECURITY_HEADERS.xContentTypeOptions).toBe('nosniff')
      expect(EMBEDDABLE_SECURITY_HEADERS.referrerPolicy).toBe(
        'strict-origin-when-cross-origin'
      )
      expect(EMBEDDABLE_SECURITY_HEADERS.permissionsPolicy).toBe(
        DEFAULT_SECURITY_HEADERS.permissionsPolicy
      )
      expect(EMBEDDABLE_SECURITY_HEADERS.xXssProtection).toBeTruthy()
    })

    it('does not make transport commitments for custom domains', () => {
      expect(EMBEDDABLE_SECURITY_HEADERS.strictTransportSecurity).toBe(
        'max-age=31536000'
      )
      expect(EMBEDDABLE_SECURITY_HEADERS.strictTransportSecurity).not.toMatch(
        /includeSubDomains|preload/
      )
    })

    it('lets COEP pages load the widget while never isolating the frame', () => {
      expect(EMBEDDABLE_SECURITY_HEADERS.crossOriginResourcePolicy).toBe(
        'cross-origin'
      )
      expect(EMBEDDABLE_SECURITY_HEADERS.crossOriginEmbedderPolicy).toBe(false)
      expect(EMBEDDABLE_SECURITY_HEADERS.crossOriginOpenerPolicy).toBe(false)
    })
  })

  describe('EMBEDDABLE_PATHS', () => {
    it('should be defined as a non-empty array', () => {
      expect(Array.isArray(EMBEDDABLE_PATHS)).toBe(true)
      expect(EMBEDDABLE_PATHS.length).toBeGreaterThan(0)
    })

    it('should contain only string patterns', () => {
      EMBEDDABLE_PATHS.forEach((path) => {
        expect(typeof path).toBe('string')
        expect(path.length).toBeGreaterThan(0)
      })
    })

    it('should include widget-related paths', () => {
      const hasWidgetPaths = EMBEDDABLE_PATHS.some((path) =>
        path.includes('widget')
      )

      expect(hasWidgetPaths).toBe(true)
    })

    it.each([
      ['/integrations/widget/v1.js'],
      ['/integrations/widget/v2.js'],
      ['/integrations/widget/plugins/plugin1.js'],
      ['/integrations/widget/plugins/plugin2.js'],
      ['/integrations/widget/abc/frame'],
      ['/integrations/widget/abc/frame?xyz=123'],
    ])('should match an embeddable path %s', (path) => {
      const match = EMBEDDABLE_PATHS.find((p) => path.match(new RegExp(p)))

      expect(match).toBeDefined()
    })

    it.each([
      ['/'],
      ['/bots'],
      ['/integrations/widget/widget123'],
      ['/integrations/widget/widget123/test'],
      ['/api/v1/status/ping'],
      ['/examples/abc123'],
    ])('should not match an embeddable path %s', (path) => {
      const match = EMBEDDABLE_PATHS.find((p) => path.match(new RegExp(p)))

      expect(match).toBeUndefined()
    })
  })

  describe('EXCLUDE_PATHS', () => {
    it('should be defined as an array', () => {
      expect(Array.isArray(EXCLUDE_PATHS)).toBe(true)
    })

    it('should contain only string patterns if not empty', () => {
      EXCLUDE_PATHS.forEach((path) => {
        expect(typeof path).toBe('string')
        expect(path.length).toBeGreaterThan(0)
      })
    })
  })

  describe('buildOriginRestrictedCsp', () => {
    const parse = (csp) =>
      Object.fromEntries(
        csp.split(';').map((d) => {
          const [name, ...values] = d.trim().split(/\s+/)

          return [name, values.join(' ')]
        })
      )

    it('returns undefined when no valid origin is configured', () => {
      expect(buildOriginRestrictedCsp()).toBeUndefined()
      expect(buildOriginRestrictedCsp('')).toBeUndefined()
      expect(buildOriginRestrictedCsp('example.com, javascript:')).toBeUndefined()
    })

    it('restricts frame-ancestors to self plus the whitelisted origins', () => {
      const directives = parse(
        buildOriginRestrictedCsp(
          'https://a.example/, https://a.example;http://b.example\ncapacitor://localhost ionic://localhost'
        )
      )

      expect(directives['frame-ancestors']).toBe(
        "'self' https://a.example http://b.example capacitor://localhost ionic://localhost"
      )
    })

    it('keeps every other embeddable directive intact', () => {
      const {
        'frame-ancestors': _a,
        'report-uri': _r,
        ...rest
      } = parse(buildOriginRestrictedCsp('https://a.example'))
      const { 'frame-ancestors': _b, ...embeddableRest } = Object.fromEntries(
        EMBEDDABLE_SECURITY_HEADERS.contentSecurityPolicy
          .split(';')
          .map((d) => {
            const [name, ...values] = d.trim().split(/\s+/)

            return [name, values.join(' ')]
          })
      )

      expect(rest).toEqual(embeddableRest)
    })
  })
})
