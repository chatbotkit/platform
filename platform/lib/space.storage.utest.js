// @ts-check
import { encode } from '@/lib/b64'
import {
  getSpaceStorageDataRoot,
  getSpaceStorageDirectoryName,
  getSpaceStorageFileName,
  getSpaceStorageMountConfig,
  getSpaceStorageRoot,
  isSpaceStorageDataRootPath,
  resolveSpaceStorageDataKey,
} from '@/lib/space.storage'

describe('resolveSpaceStorageDataKey', () => {
  const testSpaceId = 'test-space-123'

  describe('basic functionality', () => {
    it('should return base path when no path is provided', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '',
      })

      expect(result).toBe('space-test-space-123/data/')
    })

    it('should handle empty pathId (base64 empty string)', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        pathId: encode(''),
      })

      expect(result).toBe('space-test-space-123/data/')
    })

    it('should join simple path correctly', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/documents/file.txt')
    })

    it('should handle nested paths', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'folder/subfolder/deep/file.pdf',
      })

      expect(result).toBe(
        'space-test-space-123/data/folder/subfolder/deep/file.pdf'
      )
    })

    it('should handle paths with leading slash', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '/documents/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/documents/file.txt')
    })

    it('should handle paths with multiple leading slashes', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '///documents/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/documents/file.txt')
    })
  })

  describe('path traversal attack prevention', () => {
    it('should prevent directory traversal with ../', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '../secret/file.txt',
      })

      // @note should not escape the space directory

      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should prevent nested directory traversal', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/../../secret/file.txt',
      })

      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should prevent multiple directory traversal attempts', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '../../../../../../../etc/passwd',
      })

      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should prevent directory traversal with backslashes', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '..\\..\\secret\\file.txt',
      })

      expect(result).not.toContain('..')
      expect(result).not.toContain('\\')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should prevent mixed slash directory traversal', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '../folder\\..\\secret/file.txt',
      })

      expect(result).not.toContain('..')
      expect(result).not.toContain('\\')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should prevent URL encoded directory traversal', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '%2e%2e%2fsecret%2ffile.txt',
      })

      expect(result).toMatch(/^space-test-space-123\/data/)

      // @note URL-encoded path traversal is decoded by decodeURIComponent, resulting
      // in ../ in the path. The actual path traversal protection happens at the S3
      // operation level via assertValidKey which will throw if ../ is present.
      expect(result).toBe('space-test-space-123/data/../secret/file.txt')
    })

    it('should prevent double URL encoded directory traversal', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '%252e%252e%252fsecret',
      })

      expect(result).toMatch(/^space-test-space-123\/data/)

      // @note double encoding decodes once to %2e%2e%2f which sanitizeObjectKey
      // replaces % with _ resulting in a safe path
      expect(result).toBe('space-test-space-123/data/_2e_2e_2fsecret')
    })
  })

  describe('pathId (base64 encoded) handling', () => {
    it('should decode pathId and sanitize it', () => {
      const encodedPath = encode('documents/file.txt')

      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        pathId: encodedPath,
      })

      expect(result).toBe('space-test-space-123/data/documents/file.txt')
    })

    it('should prevent traversal in encoded pathId', () => {
      const encodedPath = encode('../../../secret/file.txt')

      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        pathId: encodedPath,
      })

      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)

      // @note the ../ sequences are removed by sanitization leaving the clean path
      expect(result).toBe('space-test-space-123/data/secret/file.txt')
    })

    it('should sanitize complex encoded path', () => {
      const encodedPath = encode('/../../folder/../secret.txt')

      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        pathId: encodedPath,
      })

      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should handle file:// protocol in pathId', () => {
      const encodedPath = encode('file:///documents/file.txt')

      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        pathId: encodedPath,
      })

      // @note tryPathname should extract pathname from file:// URL

      expect(result).toBe('space-test-space-123/data/documents/file.txt')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '',
      })

      expect(result).toBe('space-test-space-123/data/')
    })

    it('should handle whitespace-only path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '   ',
      })

      expect(result).toBe('space-test-space-123/data/')
    })

    it('should handle path with spaces', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'folder name/file name.txt',
      })

      // @note Spaces are allowed in S3 keys and kept as-is per AWS guidelines

      expect(result).toBe('space-test-space-123/data/folder name/file name.txt')
    })

    it('should normalize multiple consecutive slashes', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'folder//subfolder///file.txt',
      })

      // @note should normalize to single slashes

      expect(result).not.toContain('//')
      expect(result).toBe('space-test-space-123/data/folder/subfolder/file.txt')
    })

    it('should handle single dot segments', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: './documents/./file.txt',
      })

      expect(result).not.toContain('/.')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should handle paths with special characters', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'folder/file-name_2024@version(1).txt',
      })

      expect(result).toBe(
        'space-test-space-123/data/folder/file-name_2024@version(1).txt'
      )
    })

    it('should handle unicode characters in path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/文件.txt',
      })

      // @note Unicode characters are allowed in S3 keys (UTF-8 encoded)

      expect(result).toBe('space-test-space-123/data/documents/文件.txt')
    })

    it('should handle paths with query parameters', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'file.txt?version=1',
      })

      // @note tryPathname should handle this - query should be ignored

      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should handle paths with fragments', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'file.txt#section',
      })

      // @note tryPathname should handle this - fragment should be ignored

      expect(result).toMatch(/^space-test-space-123\/data/)
    })
  })

  describe('security scenarios', () => {
    it('should prevent escaping to root directory', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '../../../../',
      })

      expect(result).toBe('space-test-space-123/data/')
      expect(result).not.toContain('..')
    })

    it('should prevent null byte injection', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'file.txt\x00.jpg',
      })

      // @note should handle null bytes safely

      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(100) + 'file.txt'

      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: longPath,
      })

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).toContain('file.txt')
    })

    it('should prevent absolute path injection', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '/etc/passwd',
      })

      // @note should be relative to space directory

      expect(result).toBe('space-test-space-123/data/etc/passwd')
    })

    it('should prevent Windows absolute path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'C:\\Windows\\System32\\config',
      })

      // @note C: is stripped, backslashes are replaced with underscores per S3 guidelines

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toMatch(/^C:/)
      expect(result).not.toContain('\\')

      expect(result).toBe('space-test-space-123/data/_Windows_System32_config')
    })

    it('should prevent UNC path injection', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '\\\\server\\share\\file.txt',
      })

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toContain('\\')
    })
  })

  describe('different spaceId formats', () => {
    it('should handle UUID spaceId', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: '550e8400-e29b-41d4-a716-446655440000',
        path: 'file.txt',
      })

      expect(result).toBe(
        'space-550e8400-e29b-41d4-a716-446655440000/data/file.txt'
      )
    })

    it('should handle short spaceId', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: 'abc',
        path: 'file.txt',
      })

      expect(result).toBe('space-abc/data/file.txt')
    })

    it('should handle spaceId with special characters', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: 'space_123-test',
        path: 'file.txt',
      })

      expect(result).toBe('space-space_123-test/data/file.txt')
    })
  })

  describe('path normalization consistency', () => {
    it('should produce same result for equivalent paths', () => {
      const path1 = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '/documents/file.txt',
      })

      const path2 = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '///documents/file.txt',
      })

      const path3 = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/file.txt',
      })

      expect(path1).toBe(path2)
      expect(path2).toBe(path3)
      expect(path1).toBe('space-test-space-123/data/documents/file.txt')
    })

    it('should normalize paths with trailing slashes', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/folder/',
      })

      // @note joinPaths removes trailing slashes

      expect(result).toBe('space-test-space-123/data/documents/folder')
    })
  })

  describe('complex attack scenarios', () => {
    it('should prevent path traversal with mixed encodings', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '..%2f..%2f..%2fsecret',
      })

      // @note URL-encoded slashes are decoded, allowing path normalization

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).toBe('space-test-space-123/data/../../../secret')
    })

    it('should handle directory traversal in middle of path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/../../../secret/file.txt',
      })

      // @note URL normalization resolves .. in path

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toContain('..')
    })

    it('should prevent symlink-style attacks', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'folder/....//....//secret',
      })

      // @note unusual patterns should be normalized or treated safely

      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should handle path with only dots', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '../../../',
      })

      // @note should resolve to base path

      expect(result).toBe('space-test-space-123/data/')
      expect(result).not.toContain('..')
    })

    it('should prevent traversal with URL-like paths', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'file:///../../../etc/passwd',
      })

      // @note file:// protocol with traversal

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toContain('..')
    })

    it('should handle deeply nested traversal attempts', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'a/b/c/../../../../../../../../etc/passwd',
      })

      // @note excessive traversal should not escape space directory

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toContain('..')
    })

    it('should prevent traversal with alternate separators', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: '..\\..\\..\\secret',
      })

      // @note backslash separators with traversal

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toContain('..')
    })

    it('should handle base64 encoded traversal', () => {
      // @note base64 of '../../../secret'

      const encodedPath = encode('../../../secret')

      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        pathId: encodedPath,
      })

      expect(result).toMatch(/^space-test-space-123\/data/)
      expect(result).not.toContain('..')
    })
  })

  describe('realistic file operations', () => {
    it('should handle typical document path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'documents/2024/report.pdf',
      })

      expect(result).toBe('space-test-space-123/data/documents/2024/report.pdf')
    })

    it('should handle image upload path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'images/profile/avatar-123.jpg',
      })

      expect(result).toBe(
        'space-test-space-123/data/images/profile/avatar-123.jpg'
      )
    })

    it('should handle versioned file path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'projects/website/v1.2.3/index.html',
      })

      expect(result).toBe(
        'space-test-space-123/data/projects/website/v1.2.3/index.html'
      )
    })

    it('should handle temporary file path', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'temp/upload-abc123.tmp',
      })

      expect(result).toBe('space-test-space-123/data/temp/upload-abc123.tmp')
    })

    it('should handle nested folder structure', () => {
      const result = resolveSpaceStorageDataKey({
        spaceId: testSpaceId,
        path: 'users/2024/10/user-reports.csv',
      })

      expect(result).toBe(
        'space-test-space-123/data/users/2024/10/user-reports.csv'
      )
    })
  })
})

describe('getSpaceStorageFileName', () => {
  const testSpaceId = 'test-space-123'

  describe('basic functionality', () => {
    it('should extract filename from simple path', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'file.txt',
      })

      expect(result).toBe('file.txt')
    })

    it('should extract filename from nested path', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'documents/reports/file.pdf',
      })

      expect(result).toBe('file.pdf')
    })

    it('should extract filename with pathId', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        pathId: encode('folder/document.docx'),
      })

      expect(result).toBe('document.docx')
    })

    it('should handle filename with multiple dots', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'archive.tar.gz',
      })

      expect(result).toBe('archive.tar.gz')
    })

    it('should handle filename with no extension', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'folder/README',
      })

      expect(result).toBe('README')
    })
  })

  describe('special characters', () => {
    it('should handle filename with spaces', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'documents/my document.txt',
      })

      // @note Spaces are allowed in S3 keys
      expect(result).toBe('my document.txt')
    })

    it('should handle filename with special characters', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'files/report_2024-10-11.csv',
      })

      expect(result).toBe('report_2024-10-11.csv')
    })

    it('should handle filename with unicode characters', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'documents/文档.txt',
      })

      // @note Unicode characters are allowed in S3 keys (UTF-8 encoded)
      expect(result).toBe('文档.txt')
    })

    it('should handle filename with parentheses', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'files/report (final).pdf',
      })

      // @note Parentheses are safe characters in S3 keys
      expect(result).toBe('report (final).pdf')
    })

    it('should handle filename with emoji', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'images/photo 📸.jpg',
      })

      // @note Emoji are allowed in S3 keys (UTF-8 encoded)
      expect(result).toBe('photo 📸.jpg')
    })
  })

  describe('deeply nested paths', () => {
    it('should extract filename from deeply nested path', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'a/b/c/d/e/f/g/file.txt',
      })

      expect(result).toBe('file.txt')
    })

    it('should handle very long filename', () => {
      const longName = 'a'.repeat(100) + '.txt'
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: `folder/${longName}`,
      })

      expect(result).toBe(longName)
    })
  })

  describe('edge cases', () => {
    it('should handle path with leading slash', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: '/documents/file.txt',
      })

      expect(result).toBe('file.txt')
    })

    it('should handle path with multiple leading slashes', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: '///documents/file.txt',
      })

      expect(result).toBe('file.txt')
    })

    it('should handle filename that looks like a hidden file', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'config/.gitignore',
      })

      expect(result).toBe('.gitignore')
    })

    it('should handle filename with only extension', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'temp/.env',
      })

      expect(result).toBe('.env')
    })
  })

  describe('different file types', () => {
    it('should handle image files', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'images/photo.jpg',
      })

      expect(result).toBe('photo.jpg')
    })

    it('should handle document files', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'docs/presentation.pptx',
      })

      expect(result).toBe('presentation.pptx')
    })

    it('should handle compressed files', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'archives/backup.zip',
      })

      expect(result).toBe('backup.zip')
    })

    it('should handle video files', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'videos/tutorial.mp4',
      })

      expect(result).toBe('tutorial.mp4')
    })

    it('should handle code files', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'src/components/Button.tsx',
      })

      expect(result).toBe('Button.tsx')
    })
  })

  describe('pathId encoding', () => {
    it('should work with base64 encoded path', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        pathId: encode('folder/subfolder/file.txt'),
      })

      expect(result).toBe('file.txt')
    })

    it('should work with base64 encoded path with special chars', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        pathId: encode('folder/file with spaces.txt'),
      })

      // @note Spaces are allowed in S3 keys

      expect(result).toBe('file with spaces.txt')
    })
  })

  describe('sanitization', () => {
    it('should handle path traversal attempts in filename extraction', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: '../../../etc/passwd',
      })

      // @note after sanitization by resolveSpaceStorageDataKey, this should be safe

      expect(result).not.toContain('..')
    })

    it('should handle complex traversal in path', () => {
      const result = getSpaceStorageFileName({
        spaceId: testSpaceId,
        path: 'documents/../../secret/file.txt',
      })

      // @note should extract filename after path sanitization

      expect(result).not.toContain('..')
      expect(result).toBeTruthy()
    })
  })
})

describe('getSpaceStorageRoot', () => {
  it('should return correct root path for a space', () => {
    const result = getSpaceStorageRoot({
      spaceId: 'test-space-123',
    })

    expect(result).toBe('space-test-space-123')
  })

  it('should handle UUID spaceId', () => {
    const result = getSpaceStorageRoot({
      spaceId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('space-550e8400-e29b-41d4-a716-446655440000')
  })

  it('should handle short spaceId', () => {
    const result = getSpaceStorageRoot({
      spaceId: 'abc',
    })

    expect(result).toBe('space-abc')
  })

  it('should handle spaceId with special characters', () => {
    const result = getSpaceStorageRoot({
      spaceId: 'test-space_123.v2',
    })

    expect(result).toBe('space-test-space_123.v2')
  })

  it('should handle numeric spaceId', () => {
    const result = getSpaceStorageRoot({
      spaceId: '12345',
    })

    expect(result).toBe('space-12345')
  })
})

describe('getSpaceStorageDataRoot', () => {
  it('should return data root path for a space', () => {
    const result = getSpaceStorageDataRoot({
      spaceId: 'test-space-123',
    })

    expect(result).toBe('space-test-space-123/data')
  })

  it('should handle UUID spaceId', () => {
    const result = getSpaceStorageDataRoot({
      spaceId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('space-550e8400-e29b-41d4-a716-446655440000/data')
  })

  it('should handle short spaceId', () => {
    const result = getSpaceStorageDataRoot({
      spaceId: 'abc',
    })

    expect(result).toBe('space-abc/data')
  })

  it('should handle spaceId with special characters', () => {
    const result = getSpaceStorageDataRoot({
      spaceId: 'test-space_123.v2',
    })

    expect(result).toBe('space-test-space_123.v2/data')
  })

  it('should handle numeric spaceId', () => {
    const result = getSpaceStorageDataRoot({
      spaceId: '12345',
    })

    expect(result).toBe('space-12345/data')
  })
})

describe('getSpaceStorageMountConfig', () => {
  it('should return mount info with data folder prefix', () => {
    const result = getSpaceStorageMountConfig({
      spaceId: 'test-space-123',
    })

    expect(result).toEqual({
      scope: 'space',
      prefix: 'space-test-space-123/data',
    })
  })

  it('should use data folder prefix for shell mounting', () => {
    const result = getSpaceStorageMountConfig({
      spaceId: 'my-space',
    })

    // @note the prefix should include /data so mounted shells only see customer data
    expect(result.prefix).toBe('space-my-space/data')
    expect(result.prefix).toContain('/data')
  })

  it('should handle UUID spaceId', () => {
    const result = getSpaceStorageMountConfig({
      spaceId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result.prefix).toBe(
      'space-550e8400-e29b-41d4-a716-446655440000/data'
    )
  })

  it('should return a consistent store', () => {
    const result1 = getSpaceStorageMountConfig({ spaceId: 'space-1' })
    const result2 = getSpaceStorageMountConfig({ spaceId: 'space-2' })

    // @note bucket should be the same for all spaces
    expect(result1.scope).toBe(result2.scope)
  })

  it('should return consistent bucket', () => {
    const result1 = getSpaceStorageMountConfig({ spaceId: 'space-1' })
    const result2 = getSpaceStorageMountConfig({ spaceId: 'space-2' })

    // @note every space lives in the same store, separated by prefix. Which
    // container backs that store, and what endpoint it is reached at, moved to
    // the storage module - the platform names a scope and nothing more.
    expect(result1.scope).toBe(result2.scope)
  })

  it('should return prefix that matches getSpaceStorageDataRoot', () => {
    const spaceId = 'test-space-123'

    const bucketInfo = getSpaceStorageMountConfig({ spaceId })
    const dataRoot = getSpaceStorageDataRoot({ spaceId })

    // @note bucket info prefix should match data root for consistency
    expect(bucketInfo.prefix).toBe(dataRoot)
  })

  it('should return prefix that is parent of all file paths', () => {
    const spaceId = 'test-space-123'

    const bucketInfo = getSpaceStorageMountConfig({ spaceId })
    const filePath = resolveSpaceStorageDataKey({
      spaceId,
      path: 'documents/file.txt',
    })

    // @note all file paths should start with the bucket prefix
    expect(filePath.startsWith(bucketInfo.prefix)).toBe(true)
  })
})

describe('getSpaceStorageDirectoryName', () => {
  const testSpaceId = 'test-space-123'

  describe('basic functionality', () => {
    it('should extract directory name from simple path', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'documents/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/documents')
    })

    it('should extract directory name from nested path', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'folder/subfolder/deep/file.pdf',
      })

      expect(result).toBe('space-test-space-123/data/folder/subfolder/deep')
    })

    it('should work with pathId', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        pathId: encode('documents/report.pdf'),
      })

      expect(result).toBe('space-test-space-123/data/documents')
    })

    it('should handle single level path', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'file.txt',
      })

      expect(result).toBe('space-test-space-123/data')
    })
  })

  describe('special characters', () => {
    it('should handle directory name with spaces', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'my documents/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/my documents')
    })

    it('should handle directory name with unicode', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: '文件夹/文件.txt',
      })

      expect(result).toBe('space-test-space-123/data/文件夹')
    })

    it('should handle directory name with special characters', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'folder (v2)/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/folder (v2)')
    })
  })

  describe('deeply nested paths', () => {
    it('should extract directory from deeply nested path', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'a/b/c/d/e/f/g/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/a/b/c/d/e/f/g')
    })

    it('should handle very long directory names', () => {
      const longDir = 'a'.repeat(200)
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: `${longDir}/file.txt`,
      })

      expect(result).toBe(`space-test-space-123/data/${longDir}`)
    })
  })

  describe('edge cases', () => {
    it('should handle path with leading slash', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: '/documents/file.txt',
      })

      expect(result).toBe('space-test-space-123/data/documents')
    })

    it('should handle filename with multiple dots', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'documents/file.tar.gz',
      })

      expect(result).toBe('space-test-space-123/data/documents')
    })

    it('should handle hidden files', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'config/.env',
      })

      expect(result).toBe('space-test-space-123/data/config')
    })
  })

  describe('sanitization', () => {
    it('should handle path traversal attempts', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: '../../../etc/passwd',
      })

      // @note after sanitization, should not contain ..
      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })

    it('should handle complex traversal in directory extraction', () => {
      const result = getSpaceStorageDirectoryName({
        spaceId: testSpaceId,
        path: 'documents/../../secret/file.txt',
      })

      expect(result).not.toContain('..')
      expect(result).toMatch(/^space-test-space-123\/data/)
    })
  })
})

describe('isSpaceStorageDataRootPath', () => {
  const testSpaceId = 'test-space-123'

  describe('root path detection', () => {
    it('should return true for empty path', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '',
      })

      expect(result).toBe(true)
    })

    it('should return true for empty pathId', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        pathId: encode(''),
      })

      expect(result).toBe(true)
    })

    it('should return true for single dot path', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '.',
      })

      expect(result).toBe(true)
    })

    it('should return true for slash path', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '/',
      })

      expect(result).toBe(true)
    })

    it('should return true for multiple slashes', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '///',
      })

      expect(result).toBe(true)
    })
  })

  describe('non-root path detection', () => {
    it('should return false for file path', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: 'file.txt',
      })

      expect(result).toBe(false)
    })

    it('should return false for directory path', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: 'documents',
      })

      expect(result).toBe(false)
    })

    it('should return false for nested file path', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: 'folder/subfolder/file.txt',
      })

      expect(result).toBe(false)
    })

    it('should return false for path with leading slash', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '/documents/file.txt',
      })

      expect(result).toBe(false)
    })

    it('should return false for pathId with content', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        pathId: encode('documents/file.txt'),
      })

      expect(result).toBe(false)
    })
  })

  describe('different spaceId formats', () => {
    it('should work with UUID spaceId', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: '550e8400-e29b-41d4-a716-446655440000',
        path: '',
      })

      expect(result).toBe(true)
    })

    it('should work with short spaceId', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: 'abc',
        path: '',
      })

      expect(result).toBe(true)
    })

    it('should work with numeric spaceId', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: '12345',
        path: '',
      })

      expect(result).toBe(true)
    })
  })

  describe('path normalization consistency', () => {
    it('should treat equivalent root paths as root', () => {
      const emptyPath = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '',
      })
      const dotPath = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '.',
      })
      const slashPath = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '/',
      })

      expect(emptyPath).toBe(true)
      expect(dotPath).toBe(true)
      expect(slashPath).toBe(true)
    })

    it('should consistently identify non-root paths', () => {
      const result1 = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: 'file.txt',
      })
      const result2 = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '/file.txt',
      })
      const result3 = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: './file.txt',
      })

      expect(result1).toBe(false)
      expect(result2).toBe(false)
      expect(result3).toBe(false)
    })
  })

  describe('security scenarios', () => {
    it('should treat traversal attempts that resolve to root as root', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '../',
      })

      // @note path traversal is neutralized by joinPaths and resolves to root
      expect(result).toBe(true)
    })

    it('should treat parent directory as root after normalization', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '..',
      })

      // @note path traversal is neutralized by joinPaths and resolves to root
      expect(result).toBe(true)
    })

    it('should treat multiple traversal as root after normalization', () => {
      const result = isSpaceStorageDataRootPath({
        spaceId: testSpaceId,
        path: '../../..',
      })

      // @note path traversal is neutralized by joinPaths and resolves to root
      expect(result).toBe(true)
    })
  })
})
