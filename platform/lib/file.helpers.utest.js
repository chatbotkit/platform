import { extname, joinName, tryExtname } from '@/lib/file.helpers'

describe('file.helpers utilities', () => {
  describe('extname', () => {
    describe('basic functionality', () => {
      it('should extract extension from simple filename', () => {
        expect(extname('document.pdf')).toBe('.pdf')
      })

      it('should extract extension from filename with path', () => {
        expect(extname('/path/to/file.txt')).toBe('.txt')
      })

      it('should extract extension from relative path', () => {
        expect(extname('./folder/file.jpg')).toBe('.jpg')
      })

      it('should extract extension from nested path', () => {
        expect(extname('dir1/dir2/dir3/file.png')).toBe('.png')
      })
    })

    describe('multiple dots in filename', () => {
      it('should extract only last extension', () => {
        expect(extname('archive.tar.gz')).toBe('.gz')
      })

      it('should handle file with dots in name', () => {
        expect(extname('my.awesome.file.txt')).toBe('.txt')
      })

      it('should handle path with dots in directory names', () => {
        expect(extname('/path.with.dots/file.pdf')).toBe('.pdf')
      })
    })

    describe('edge cases', () => {
      it('should return null for filename without extension', () => {
        expect(extname('README')).toBeNull()
      })

      it('should return null for filename ending with dot', () => {
        expect(extname('file.')).toBeNull()
      })

      it('should handle hidden files with extension', () => {
        expect(extname('.gitignore')).toBe('.gitignore')
      })

      it('should handle hidden files in path', () => {
        expect(extname('/path/.hidden/file.txt')).toBe('.txt')
      })

      it('should return null for path without filename', () => {
        expect(extname('/path/to/directory/')).toBeNull()
      })

      it('should return null for empty string', () => {
        expect(extname('')).toBeNull()
      })

      it('should handle single character extension', () => {
        expect(extname('file.c')).toBe('.c')
      })

      it('should handle long extension', () => {
        expect(extname('file.configuration')).toBe('.configuration')
      })
    })

    describe('special characters', () => {
      it('should handle spaces in filename', () => {
        expect(extname('my document.pdf')).toBe('.pdf')
      })

      it('should handle spaces in path', () => {
        expect(extname('/my folder/my file.txt')).toBe('.txt')
      })

      it('should handle special characters in filename', () => {
        expect(extname('file-name_01.jpg')).toBe('.jpg')
      })

      it('should handle unicode characters in filename', () => {
        expect(extname('文档.txt')).toBe('.txt')
      })
    })

    describe('windows paths', () => {
      it('should handle backslash separators', () => {
        // uses split('/') so backslashes are treated as part of filename
        expect(extname('C:\\path\\to\\file.txt')).toBe('.txt')
      })
    })
  })

  describe('tryExtname', () => {
    describe('successful extraction', () => {
      it('should extract extension like extname', () => {
        expect(tryExtname('file.pdf')).toBe('.pdf')
      })

      it('should handle paths with extension', () => {
        expect(tryExtname('/path/to/file.txt')).toBe('.txt')
      })

      it('should return null for no extension', () => {
        expect(tryExtname('README')).toBeNull()
      })
    })

    describe('error handling', () => {
      it('should return null for null input', () => {
        expect(tryExtname(null)).toBeNull()
      })

      it('should return null for undefined input', () => {
        expect(tryExtname(undefined)).toBeNull()
      })

      it('should return null for non-string input', () => {
        expect(tryExtname(123)).toBeNull()
      })

      it('should return null for object input', () => {
        expect(tryExtname({})).toBeNull()
      })

      it('should return null for array input', () => {
        expect(tryExtname([])).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should handle empty string', () => {
        expect(tryExtname('')).toBeNull()
      })

      it('should handle whitespace string', () => {
        expect(tryExtname('   ')).toBeNull()
      })
    })
  })

  describe('joinName', () => {
    describe('basic functionality', () => {
      it('should join name and extension', () => {
        expect(joinName('document', '.pdf')).toBe('document.pdf')
      })

      it('should join name with extension without dot', () => {
        expect(joinName('file', 'txt')).toBe('file.txt')
      })

      it('should handle empty extension', () => {
        expect(joinName('README', '')).toBe('README')
      })

      it('should handle null extension', () => {
        expect(joinName('LICENSE', null)).toBe('LICENSE')
      })

      it('should handle undefined extension', () => {
        expect(joinName('CHANGELOG', undefined)).toBe('CHANGELOG')
      })
    })

    describe('extension formatting', () => {
      it('should add dot if missing', () => {
        expect(joinName('file', 'jpg')).toBe('file.jpg')
      })

      it('should not add extra dot if present', () => {
        expect(joinName('file', '.png')).toBe('file.png')
      })

      it('should handle multiple dots in extension', () => {
        expect(joinName('archive', 'tar.gz')).toBe('archive.tar.gz')
      })

      it('should handle multiple dots with leading dot', () => {
        expect(joinName('archive', '.tar.gz')).toBe('archive.tar.gz')
      })
    })

    describe('special name cases', () => {
      it('should handle empty name', () => {
        expect(joinName('', '.txt')).toBe('.txt')
      })

      it('should handle name with dots', () => {
        expect(joinName('my.awesome.file', '.pdf')).toBe('my.awesome.file.pdf')
      })

      it('should handle name with spaces', () => {
        expect(joinName('my document', 'pdf')).toBe('my document.pdf')
      })

      it('should handle name with special characters', () => {
        expect(joinName('file-name_01', 'jpg')).toBe('file-name_01.jpg')
      })

      it('should handle unicode characters in name', () => {
        expect(joinName('文档', 'txt')).toBe('文档.txt')
      })
    })

    describe('unusual extensions', () => {
      it('should handle single character extension', () => {
        expect(joinName('file', 'c')).toBe('file.c')
      })

      it('should handle long extension', () => {
        expect(joinName('file', 'configuration')).toBe('file.configuration')
      })

      it('should handle numeric extension', () => {
        expect(joinName('backup', '001')).toBe('backup.001')
      })
    })
  })

  describe('integration tests', () => {
    it('should extract and rejoin extension correctly', () => {
      const original = 'document.pdf'
      const ext = extname(original)
      const name = original.slice(0, original.lastIndexOf('.'))
      const rejoined = joinName(name, ext)

      expect(rejoined).toBe(original)
    })

    it('should handle roundtrip with path', () => {
      const fullPath = '/path/to/file.txt'
      const ext = extname(fullPath)
      const basename = fullPath.split('/').pop().slice(0, -ext.length)
      const rejoined = joinName(basename, ext)

      expect(rejoined).toBe('file.txt')
    })

    it('should handle safe extraction and joining', () => {
      const paths = ['file.txt', 'README', 'archive.tar.gz', '.gitignore']

      paths.forEach((path) => {
        const ext = tryExtname(path)

        if (ext) {
          const name = path.slice(0, -ext.length)
          const rejoined = joinName(name, ext)

          expect(rejoined).toBe(path)
        }
      })
    })

    it('should work with changing extensions', () => {
      const original = 'document.txt'
      const oldExt = extname(original)
      const name = original.slice(0, -oldExt.length)
      const newExt = '.pdf'
      const renamed = joinName(name, newExt)

      expect(renamed).toBe('document.pdf')
    })

    it('should handle removing extension', () => {
      const original = 'file.txt'
      const ext = extname(original)
      const name = original.slice(0, -ext.length)
      const withoutExt = joinName(name, null)

      expect(withoutExt).toBe('file')
    })
  })
})
