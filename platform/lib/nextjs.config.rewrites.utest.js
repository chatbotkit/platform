import { buildCaptureAllSource } from './nextjs.config.rewrites'

describe('buildCaptureAllSource', () => {
  describe('basic functionality', () => {
    it('should generate default pattern with standard excludes', () => {
      const result = buildCaptureAllSource()

      expect(result).toContain('/:path(')
      expect(result).toContain('(?!')
      expect(result).toContain('.*)')
      expect(result).toContain('_next')
      expect(result).toContain('api')
    })

    it('should include all default allowed extensions', () => {
      const result = buildCaptureAllSource()

      expect(result).toContain('jpg')
      expect(result).toContain('png')
      expect(result).toContain('gif')
      expect(result).toContain('svg')
      expect(result).toContain('ico')
      expect(result).toContain('js')
      expect(result).toContain('css')
      expect(result).toContain('ttf')
      expect(result).toContain('woff')
      expect(result).toContain('woff2')
    })

    it('should include all default standard excludes', () => {
      const result = buildCaptureAllSource()

      expect(result).toContain('_next')
      expect(result).toContain('api')
      expect(result).toContain('monitoring-tunnel')
      expect(result).toContain('oauth\\/')
      expect(result).toContain('s\\/')
    })
  })

  describe('custom excludes', () => {
    it('should add custom excludes to pattern', () => {
      const result = buildCaptureAllSource({
        excludes: ['custom-path', 'another-path'],
      })

      expect(result).toContain('custom-path')
      expect(result).toContain('another-path')
    })

    it('should combine custom and standard excludes', () => {
      const result = buildCaptureAllSource({
        excludes: ['custom-path'],
      })

      expect(result).toContain('custom-path')
      expect(result).toContain('_next')
      expect(result).toContain('api')
    })

    it('should handle empty custom excludes array', () => {
      const result = buildCaptureAllSource({
        excludes: [],
      })

      expect(result).toContain('_next')
      expect(result).toContain('api')
    })
  })

  describe('custom allowed extensions', () => {
    it('should use custom allowed extensions', () => {
      const result = buildCaptureAllSource({
        allowedExtensions: ['txt', 'pdf'],
      })

      expect(result).toContain('txt')
      expect(result).toContain('pdf')
    })

    it('should replace default extensions with custom ones', () => {
      const result = buildCaptureAllSource({
        allowedExtensions: ['txt'],
      })

      expect(result).toContain('txt')
      expect(result).not.toContain('jpg')
      expect(result).not.toContain('png')
    })

    it('should handle empty allowed extensions array', () => {
      const result = buildCaptureAllSource({
        allowedExtensions: [],
      })

      expect(result).toContain('/:path(')
      expect(result).toContain('_next')
    })
  })

  describe('custom standard excludes', () => {
    it('should use custom standard excludes', () => {
      const result = buildCaptureAllSource({
        standardExcludes: ['my-exclude'],
      })

      expect(result).toContain('my-exclude')
    })

    it('should replace default standard excludes with custom ones', () => {
      const result = buildCaptureAllSource({
        standardExcludes: ['my-exclude'],
      })

      expect(result).toContain('my-exclude')
      expect(result).not.toContain('_next')
      expect(result).not.toContain('api')
    })

    it('should combine custom excludes with custom standard excludes', () => {
      const result = buildCaptureAllSource({
        excludes: ['custom'],
        standardExcludes: ['standard'],
      })

      expect(result).toContain('custom')
      expect(result).toContain('standard')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined options', () => {
      const result = buildCaptureAllSource(undefined)

      expect(result).toContain('/:path(')
      expect(result).toContain('_next')
    })

    it('should handle null excludes', () => {
      const result = buildCaptureAllSource({
        excludes: null,
      })

      expect(result).toContain('/:path(')
    })

    it('should handle options with all custom values', () => {
      const result = buildCaptureAllSource({
        excludes: ['custom1', 'custom2'],
        allowedExtensions: ['ext1', 'ext2'],
        standardExcludes: ['std1', 'std2'],
      })

      expect(result).toContain('custom1')
      expect(result).toContain('custom2')
      expect(result).toContain('std1')
      expect(result).toContain('std2')
    })
  })

  describe('pattern format', () => {
    it('should return valid Next.js rewrite pattern format', () => {
      const result = buildCaptureAllSource()

      expect(result).toMatch(/^\/:path\(.*\)$/)
    })

    it('should include negative lookahead when excludes exist', () => {
      const result = buildCaptureAllSource()

      expect(result).toMatch(/\(\?\!.*\)/)
    })

    it('should end pattern with .*', () => {
      const result = buildCaptureAllSource()

      expect(result).toMatch(/\.\*\)$/)
    })
  })
})
