import { encodePath, extname, isPath, join } from './index'

describe('join', () => {
  describe('basic path joining', () => {
    it('should join two simple paths', () => {
      expect(join('folder', 'file.txt')).toBe('folder/file.txt')
    })

    it('should join multiple paths', () => {
      expect(join('root', 'folder', 'subfolder', 'file.txt')).toBe(
        'root/folder/subfolder/file.txt'
      )
    })

    it('should join paths with leading slashes', () => {
      expect(join('/root', '/folder', '/file.txt')).toBe(
        '/root/folder/file.txt'
      )
    })

    it('should handle empty paths array', () => {
      expect(join()).toBe('')
    })

    it('should join a single path', () => {
      expect(join('single-path')).toBe('single-path')
    })
  })

  describe('trailing slash handling', () => {
    it('should remove trailing slashes from paths', () => {
      expect(join('folder/', 'file.txt')).toBe('folder/file.txt')
    })

    it('should remove multiple trailing slashes', () => {
      expect(join('folder///', 'file.txt')).toBe('folder/file.txt')
    })

    it('should remove trailing slashes from all segments', () => {
      expect(join('root/', 'folder/', 'file.txt/')).toBe('root/folder/file.txt')
    })

    it('should preserve leading slash and remove trailing slashes', () => {
      expect(join('/root/', 'folder/', 'file.txt/')).toBe(
        '/root/folder/file.txt'
      )
    })
  })

  describe('whitespace handling', () => {
    it('should trim whitespace from paths', () => {
      expect(join('  folder  ', '  file.txt  ')).toBe('folder/file.txt')
    })

    it('should handle paths with only whitespace by filtering them out', () => {
      expect(join('folder', '   ', 'file.txt')).toBe('folder/file.txt')
    })

    it('should trim and remove trailing slashes', () => {
      expect(join('  folder/  ', '  file.txt/  ')).toBe('folder/file.txt')
    })
  })

  describe('empty and falsy value filtering', () => {
    it('should filter out empty strings', () => {
      expect(join('folder', '', 'file.txt')).toBe('folder/file.txt')
    })

    it('should filter out null values', () => {
      expect(join('folder', null, 'file.txt')).toBe('folder/file.txt')
    })

    it('should filter out undefined values', () => {
      expect(join('folder', undefined, 'file.txt')).toBe('folder/file.txt')
    })

    it('should filter out multiple falsy values', () => {
      expect(join('folder', '', null, undefined, 'file.txt')).toBe(
        'folder/file.txt'
      )
    })

    it('should return empty string when all values are falsy', () => {
      expect(join('', null, undefined, '   ')).toBe('')
    })
  })

  describe('multiple consecutive slashes normalization', () => {
    it('should normalize double slashes to single slash', () => {
      expect(join('folder//file.txt')).toBe('folder/file.txt')
    })

    it('should normalize multiple consecutive slashes', () => {
      expect(join('folder///file.txt')).toBe('folder/file.txt')
    })

    it('should normalize slashes across multiple segments', () => {
      expect(join('root//', '//folder//', '//file.txt')).toBe(
        'root/folder/file.txt'
      )
    })

    it('should preserve leading slash but normalize subsequent slashes', () => {
      expect(join('//root', '//folder', 'file.txt')).toBe(
        '/root/folder/file.txt'
      )
    })
  })

  describe('complex edge cases', () => {
    it('should handle mix of slashes, whitespace, and empty values', () => {
      expect(join('  /root//  ', '', '  folder/  ', null, '  file.txt  ')).toBe(
        '/root/folder/file.txt'
      )
    })

    it('should handle paths with dots', () => {
      expect(join('folder', '..', 'file.txt')).toBe('folder/../file.txt')
    })

    it('should handle paths with special characters', () => {
      expect(join('folder', 'my-file_name.txt')).toBe('folder/my-file_name.txt')
    })

    it('should handle URL-like paths', () => {
      expect(join('https:', '', 'example.com', 'path', 'file.txt')).toBe(
        'https:/example.com/path/file.txt'
      )
    })

    it('should handle absolute paths', () => {
      expect(join('/var', 'www', 'html', 'index.html')).toBe(
        '/var/www/html/index.html'
      )
    })

    it('should join paths with numbers', () => {
      expect(join('folder', '123', 'file.txt')).toBe('folder/123/file.txt')
    })
  })

  describe('real-world scenarios', () => {
    it('should construct S3-like paths', () => {
      const bucket = 'my-bucket'
      const userId = 'user-123'
      const fileId = 'file-456'
      const filename = 'document.pdf'

      expect(join(bucket, userId, fileId, filename)).toBe(
        'my-bucket/user-123/file-456/document.pdf'
      )
    })

    it('should handle optional path segments', () => {
      const base = 'root'
      const optional = null
      const filename = 'file.txt'

      expect(join(base, optional, filename)).toBe('root/file.txt')
    })

    it('should construct nested folder structures', () => {
      expect(join('uploads', '2025', '10', '05', 'image.jpg')).toBe(
        'uploads/2025/10/05/image.jpg'
      )
    })

    it('should handle dynamically generated path segments', () => {
      const segments = ['root', 'folder', 'subfolder', 'file.txt']

      expect(join(...segments)).toBe('root/folder/subfolder/file.txt')
    })

    it('should clean up messy user-generated paths', () => {
      const userPath1 = '  /uploads//  '
      const userPath2 = '  //documents///  '
      const filename = '  my-file.pdf  '

      expect(join(userPath1, userPath2, filename)).toBe(
        '/uploads/documents/my-file.pdf'
      )
    })
  })

  describe('array argument support', () => {
    it('should flatten a single array argument', () => {
      expect(join(['folder', 'subfolder', 'file.txt'])).toBe(
        'folder/subfolder/file.txt'
      )
    })

    it('should handle mixed string and array arguments', () => {
      expect(join('root', ['folder', 'subfolder'], 'file.txt')).toBe(
        'root/folder/subfolder/file.txt'
      )
    })

    it('should handle multiple array arguments', () => {
      expect(join(['root', 'folder'], ['subfolder', 'file.txt'])).toBe(
        'root/folder/subfolder/file.txt'
      )
    })

    it('should handle empty arrays', () => {
      expect(join('folder', [], 'file.txt')).toBe('folder/file.txt')
    })

    it('should handle arrays with falsy values', () => {
      expect(join(['folder', '', null, 'subfolder'], 'file.txt')).toBe(
        'folder/subfolder/file.txt'
      )
    })

    it('should handle arrays with whitespace strings', () => {
      expect(join(['folder', '   ', 'subfolder'], 'file.txt')).toBe(
        'folder/subfolder/file.txt'
      )
    })

    it('should handle arrays with trailing slashes', () => {
      expect(join(['folder/', 'subfolder/'], 'file.txt')).toBe(
        'folder/subfolder/file.txt'
      )
    })

    it('should handle nested path construction from dynamic sources', () => {
      const basePath = ['uploads', 'users']
      const userId = 'user-123'
      const filePath = ['documents', 'report.pdf']

      expect(join(basePath, userId, filePath)).toBe(
        'uploads/users/user-123/documents/report.pdf'
      )
    })

    it('should handle array with single element', () => {
      expect(join(['folder'], 'file.txt')).toBe('folder/file.txt')
    })

    it('should handle only arrays', () => {
      expect(join(['a', 'b'], ['c', 'd'], ['e'])).toBe('a/b/c/d/e')
    })
  })
})

describe('extname', () => {
  describe('basic extension extraction', () => {
    it('should extract extension from simple filename', () => {
      expect(extname('file.txt')).toBe('.txt')
    })

    it('should extract extension from filename with path', () => {
      expect(extname('/path/to/file.pdf')).toBe('.pdf')
    })

    it('should extract extension from relative path', () => {
      expect(extname('folder/subfolder/document.docx')).toBe('.docx')
    })

    it('should return last extension for multiple dots', () => {
      expect(extname('archive.tar.gz')).toBe('.gz')
    })

    it('should handle various common extensions', () => {
      expect(extname('audio.mp3')).toBe('.mp3')
      expect(extname('video.mp4')).toBe('.mp4')
      expect(extname('image.png')).toBe('.png')
      expect(extname('data.csv')).toBe('.csv')
      expect(extname('readme.md')).toBe('.md')
    })
  })

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(extname('')).toBe('')
    })

    it('should return empty string for filename without extension', () => {
      expect(extname('filename')).toBe('')
    })

    it('should return empty string for dotfile without extension', () => {
      expect(extname('.gitignore')).toBe('')
    })

    it('should extract extension from dotfile with extension', () => {
      expect(extname('.eslintrc.json')).toBe('.json')
    })

    it('should return empty string for path ending with dot', () => {
      expect(extname('file.')).toBe('.')
    })

    it('should handle path with trailing slash', () => {
      expect(extname('/path/to/folder/')).toBe('')
    })

    it('should handle dotfile in path', () => {
      expect(extname('/path/to/.gitignore')).toBe('')
    })

    it('should handle dotfile with extension in path', () => {
      expect(extname('/path/to/.eslintrc.js')).toBe('.js')
    })
  })

  describe('special characters', () => {
    it('should handle filename with spaces', () => {
      expect(extname('my file.txt')).toBe('.txt')
    })

    it('should handle filename with special characters', () => {
      expect(extname('file-name_v2.pdf')).toBe('.pdf')
    })

    it('should handle extension with numbers', () => {
      expect(extname('video.h264')).toBe('.h264')
    })
  })
})

describe('isPath', () => {
  describe('absolute paths', () => {
    it('should detect a simple absolute path', () => {
      expect(isPath('/etc/hosts')).toBe(true)
    })

    it('should detect a deeply nested absolute path', () => {
      expect(isPath('/usr/local/bin/node')).toBe(true)
    })

    it('should detect a root-only slash', () => {
      expect(isPath('/')).toBe(true)
    })

    it('should detect an absolute path with a file extension', () => {
      expect(isPath('/home/user/file.txt')).toBe(true)
    })
  })

  describe('relative paths', () => {
    it('should detect a simple relative path', () => {
      expect(isPath('folder/file.txt')).toBe(true)
    })

    it('should detect a dot-relative path', () => {
      expect(isPath('./relative/path')).toBe(true)
    })

    it('should detect a parent-relative path', () => {
      expect(isPath('../parent/path')).toBe(true)
    })

    it('should detect a relative path with no extension', () => {
      expect(isPath('some/directory/name')).toBe(true)
    })

    it('should detect bare . (current directory)', () => {
      expect(isPath('.')).toBe(true)
    })

    it('should detect bare .. (parent directory)', () => {
      expect(isPath('..')).toBe(true)
    })
  })

  describe('home-relative paths', () => {
    it('should detect ~/path (home directory with slash)', () => {
      expect(isPath('~/documents')).toBe(true)
    })

    it('should detect bare ~ (home directory shorthand)', () => {
      expect(isPath('~')).toBe(true)
    })
  })

  describe('non-paths', () => {
    it('should reject a plain word with no slashes', () => {
      expect(isPath('justaname')).toBe(false)
    })

    it('should reject an empty string', () => {
      expect(isPath('')).toBe(false)
    })

    it('should reject an https URL', () => {
      expect(isPath('https://example.com/path')).toBe(false)
    })

    it('should reject an http URL', () => {
      expect(isPath('http://example.com')).toBe(false)
    })

    it('should reject an ftp URL', () => {
      expect(isPath('ftp://files.example.com/file.txt')).toBe(false)
    })

    it('should reject a string with a null byte', () => {
      expect(isPath('/valid/path\0inject')).toBe(false)
    })
  })
})

describe('encodePath', () => {
  describe('basic encoding', () => {
    it('should encode a simple filename', () => {
      expect(encodePath('file.txt')).toBe('file.txt')
    })

    it('should preserve slashes between segments', () => {
      expect(encodePath('folder/file.txt')).toBe('folder/file.txt')
    })

    it('should preserve slashes in deeply nested paths', () => {
      expect(encodePath('a/b/c/d.txt')).toBe('a/b/c/d.txt')
    })

    it('should encode spaces in a segment', () => {
      expect(encodePath('my folder/my file.txt')).toBe(
        'my%20folder/my%20file.txt'
      )
    })

    it('should encode special characters in segments', () => {
      expect(encodePath('folder/file name (1).txt')).toBe(
        'folder/file%20name%20(1).txt'
      )
    })

    it('should encode hash characters', () => {
      expect(encodePath('docs/chapter#1.md')).toBe('docs/chapter%231.md')
    })

    it('should encode question marks', () => {
      expect(encodePath('folder/what?.txt')).toBe('folder/what%3F.txt')
    })
  })

  describe('dot paths', () => {
    it('should preserve a single dot', () => {
      expect(encodePath('.')).toBe('.')
    })

    it('should preserve double dot', () => {
      expect(encodePath('..')).toBe('..')
    })

    it('should preserve dot in a path', () => {
      expect(encodePath('./folder/file.txt')).toBe('./folder/file.txt')
    })
  })

  describe('slashes are never encoded', () => {
    it('should not encode a leading slash', () => {
      expect(encodePath('/folder/file.txt')).toBe('/folder/file.txt')
    })

    it('should not encode slashes even with special-char segments', () => {
      expect(encodePath('a b/c d')).toBe('a%20b/c%20d')
    })
  })

  describe('empty and edge cases', () => {
    it('should handle an empty string', () => {
      expect(encodePath('')).toBe('')
    })

    it('should handle a path with an empty segment from a leading slash', () => {
      expect(encodePath('/file.txt')).toBe('/file.txt')
    })

    it('should handle unicode characters in segments', () => {
      expect(encodePath('folder/文件.txt')).toBe(
        'folder/%E6%96%87%E4%BB%B6.txt'
      )
    })
  })
})
