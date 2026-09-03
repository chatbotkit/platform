// @note these moved here with the implementation. The suite also carried a
// block that listed every configured bucket against real AWS; that is now
// `assertConfigured`, exercised from platform/tests/config/providers.utest.js
// where the application environment is actually loaded.

import { sanitizeObjectKey } from './index'

describe('sanitizeObjectKey', () => {
  describe('basic functionality', () => {
    it('should return the same key for safe characters', () => {
      expect(sanitizeObjectKey('file.txt')).toBe('file.txt')
    })

    it('should preserve alphanumeric characters', () => {
      expect(sanitizeObjectKey('abc123XYZ')).toBe('abc123XYZ')
    })

    it('should preserve safe special characters', () => {
      expect(sanitizeObjectKey('file-name_with.safe(chars)!@$&+=,.txt')).toBe(
        'file-name_with.safe(chars)!@$&+=,.txt'
      )
    })

    it('should preserve forward slashes for path structure', () => {
      expect(sanitizeObjectKey('folder/subfolder/file.txt')).toBe(
        'folder/subfolder/file.txt'
      )
    })

    it('should preserve spaces', () => {
      expect(sanitizeObjectKey('file name with spaces.txt')).toBe(
        'file name with spaces.txt'
      )
    })

    it('should preserve unicode characters', () => {
      expect(sanitizeObjectKey('文件名.txt')).toBe('文件名.txt')
      expect(sanitizeObjectKey('файл.txt')).toBe('файл.txt')
      expect(sanitizeObjectKey('αρχείο.txt')).toBe('αρχείο.txt')
    })

    it('should preserve emoji', () => {
      expect(sanitizeObjectKey('file 😀 emoji.txt')).toBe('file 😀 emoji.txt')
    })
  })

  describe('avoided characters replacement', () => {
    it('should replace backslashes with underscores', () => {
      expect(sanitizeObjectKey('path\\to\\file.txt')).toBe('path_to_file.txt')
    })

    it('should replace curly braces with underscores', () => {
      expect(sanitizeObjectKey('file{with}braces.txt')).toBe(
        'file_with_braces.txt'
      )
    })

    it('should replace caret with underscore', () => {
      expect(sanitizeObjectKey('file^name.txt')).toBe('file_name.txt')
    })

    it('should replace percent with underscore', () => {
      expect(sanitizeObjectKey('file%name.txt')).toBe('file_name.txt')
    })

    it('should replace backtick with underscore', () => {
      expect(sanitizeObjectKey('file`name.txt')).toBe('file_name.txt')
    })

    it('should replace square brackets with underscores', () => {
      expect(sanitizeObjectKey('file[0].txt')).toBe('file_0_.txt')
    })

    it('should replace double quotes with underscore', () => {
      expect(sanitizeObjectKey('file"name".txt')).toBe('file_name_.txt')
    })

    it('should replace angle brackets with underscores', () => {
      expect(sanitizeObjectKey('file<name>.txt')).toBe('file_name_.txt')
    })

    it('should replace tilde with underscore', () => {
      expect(sanitizeObjectKey('file~name.txt')).toBe('file_name.txt')
    })

    it('should replace hash with underscore', () => {
      expect(sanitizeObjectKey('file#name.txt')).toBe('file_name.txt')
    })

    it('should replace pipe with underscore', () => {
      expect(sanitizeObjectKey('file|name.txt')).toBe('file_name.txt')
    })

    it('should replace multiple avoided characters in one string', () => {
      expect(sanitizeObjectKey('file\\{name}^test%.txt')).toBe(
        'file__name__test_.txt'
      )
    })
  })

  describe('control characters removal', () => {
    it('should remove null character', () => {
      expect(sanitizeObjectKey('file\x00name.txt')).toBe('filename.txt')
    })

    it('should remove tab character', () => {
      expect(sanitizeObjectKey('file\tname.txt')).toBe('filename.txt')
    })

    it('should remove newline character', () => {
      expect(sanitizeObjectKey('file\nname.txt')).toBe('filename.txt')
    })

    it('should remove carriage return', () => {
      expect(sanitizeObjectKey('file\rname.txt')).toBe('filename.txt')
    })

    it('should remove all control characters (ASCII 0-31)', () => {
      const controlChars = Array.from({ length: 32 }, (_, i) =>
        String.fromCharCode(i)
      ).join('')

      expect(sanitizeObjectKey(`file${controlChars}name.txt`)).toBe(
        'filename.txt'
      )
    })

    it('should remove delete character (ASCII 127)', () => {
      expect(sanitizeObjectKey('file\x7Fname.txt')).toBe('filename.txt')
    })
  })

  describe('non-printable ASCII replacement', () => {
    it('should replace characters in range 128-255 with underscores', () => {
      expect(sanitizeObjectKey('file\x80name.txt')).toBe('file_name.txt')
      expect(sanitizeObjectKey('file\x90name.txt')).toBe('file_name.txt')
      expect(sanitizeObjectKey('file\xFFname.txt')).toBe('file_name.txt')
    })

    it('should replace multiple non-printable ASCII characters', () => {
      expect(sanitizeObjectKey('file\x80\x90\xFFname.txt')).toBe(
        'file___name.txt'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeObjectKey('')).toBe('')
    })

    it('should handle string with only safe characters', () => {
      expect(sanitizeObjectKey('abcdefg123456')).toBe('abcdefg123456')
    })

    it('should handle string with only avoided characters', () => {
      expect(sanitizeObjectKey('\\{}^%`[]"<>~#|')).toBe('______________')
    })

    it('should handle string with only control characters', () => {
      expect(sanitizeObjectKey('\x00\x01\x02\x03\x7F')).toBe('')
    })

    it('should handle complex real-world filenames', () => {
      expect(sanitizeObjectKey('My Document [Draft] v2.0.txt')).toBe(
        'My Document _Draft_ v2.0.txt'
      )
    })

    it('should handle long paths with multiple segments', () => {
      expect(
        sanitizeObjectKey('folder1/folder2/folder3/file{test}[1].txt')
      ).toBe('folder1/folder2/folder3/file_test__1_.txt')
    })

    it('should handle mixed unicode and avoided characters', () => {
      expect(sanitizeObjectKey('文件名{test}[1].txt')).toBe(
        '文件名_test__1_.txt'
      )
    })

    it('should handle consecutive avoided characters', () => {
      expect(sanitizeObjectKey('file\\\\\\name.txt')).toBe('file___name.txt')
    })

    it('should preserve safe punctuation', () => {
      expect(sanitizeObjectKey("file-name_with.safe'chars!@$&+=,.txt")).toBe(
        "file-name_with.safe'chars!@$&+=,.txt"
      )
    })
  })

  describe('path structure preservation', () => {
    it('should maintain path hierarchy', () => {
      expect(sanitizeObjectKey('a/b/c/d/file.txt')).toBe('a/b/c/d/file.txt')
    })

    it('should sanitize each path segment independently', () => {
      expect(sanitizeObjectKey('folder{1}/folder[2]/file^name.txt')).toBe(
        'folder_1_/folder_2_/file_name.txt'
      )
    })

    it('should handle paths with trailing slashes', () => {
      expect(sanitizeObjectKey('folder/')).toBe('folder/')
    })

    it('should handle paths with leading slashes', () => {
      expect(sanitizeObjectKey('/folder/file.txt')).toBe('/folder/file.txt')
    })
  })
})
