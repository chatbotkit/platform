import {
  extensionToType,
  getAccept,
  isAnyFile,
  isAudioFile,
  isCsvFile,
  isDocxFile,
  isHtmlFile,
  isMdFile,
  isMdxFile,
  isPdfFile,
  isTextFile,
  isTxtFile,
  isVideoFile,
  typeToExtension,
  typeToFileName,
} from '@/lib/mime'

describe('getAccept', () => {
  test('should return an object with mime types as keys', () => {
    const exts = ['.md', '.txt']

    const accept = getAccept(exts)

    expect(typeof accept).toBe('object')
    expect(Object.keys(accept)).toEqual(['text/markdown', 'text/plain'])
  })

  test('should support image extensions', () => {
    const exts = ['.jpg', '.png']

    const accept = getAccept(exts)

    expect(Object.keys(accept)).toEqual(['image/jpeg', 'image/png'])
  })

  test('should support common extensions', () => {
    expect(
      getAccept([
        '.png',
        '.jpg',
        '.md',
        '.mdx',
        '.txt',
        '.pdf',
        '.docx',
        '.pptx',
        '.xlsx',
        '.csv',
        '.json',
        '.yaml',
        '.html',
      ])
    ).toEqual({
      'image/png': ['.png'],
      'image/jpeg': ['.jpg'],
      'text/markdown': ['.md', '.mdx'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        ['.pptx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'text/yaml': ['.yaml'],
      'text/html': ['.html'],
    })
  })
})

describe('isAnyFile', () => {
  test('should return true if the file type matches the extension', () => {
    const file = { type: 'text/markdown', name: 'file.md' }

    expect(isAnyFile(file, 'md')).toBe(true)
  })

  test('should return false if the file type does not match the extension', () => {
    const file = { type: 'text/plain', name: 'file.md' }

    expect(isAnyFile(file, 'md')).toBe(false)
  })

  test('should return true if the file type is "application/octet-stream" and the name ends with the extension', () => {
    const file = { type: 'application/octet-stream', name: 'file.md' }

    expect(isAnyFile(file, 'md')).toBe(true)
  })

  test('should return false if the file type is "application/octet-stream" but the name does not end with the extension', () => {
    const file = { type: 'application/octet-stream', name: 'file.txt' }

    expect(isAnyFile(file, 'md')).toBe(false)
  })
})

describe('isMdFile', () => {
  test('should return true if the file is a Markdown file', () => {
    const file = { type: 'text/markdown', name: 'file.md' }

    expect(isMdFile(file)).toBe(true)
  })

  test('should return false if the file is not a Markdown file', () => {
    const file = { type: 'text/plain', name: 'file.md' }

    expect(isMdFile(file)).toBe(false)
  })
})

describe('isMdxFile', () => {
  test('should return true if the file is an MDX file', () => {
    const file = { type: 'text/markdown', name: 'file.mdx' }

    expect(isMdxFile(file)).toBe(true)
  })

  test('should return false if the file is not an MDX file', () => {
    const file = { type: 'text/plain', name: 'file.mdx' }

    expect(isMdxFile(file)).toBe(false)
  })

  test('should return true for MDX file with octet-stream type', () => {
    const file = { type: 'application/octet-stream', name: 'file.mdx' }

    expect(isMdxFile(file)).toBe(true)
  })

  test('should map MDX files to text/markdown for proper chunking', () => {
    // MDX files should use the same MIME type as markdown files
    expect(extensionToType('mdx')).toBe('text/markdown')
    expect(extensionToType('md')).toBe('text/markdown')

    // Both should be treated as markdown for chunking purposes
    const mdxFile = { type: 'text/markdown', name: 'component.mdx' }
    const mdFile = { type: 'text/markdown', name: 'readme.md' }

    // Both should be detected as markdown files
    expect(mdxFile.type).toBe('text/markdown')
    expect(mdFile.type).toBe('text/markdown')

    // This ensures packages/file will use the same chunkMd function for both
  })
})

describe('isTxtFile', () => {
  test('should return true if the file is a text file', () => {
    const file = { type: 'text/plain', name: 'file.txt' }

    expect(isTxtFile(file)).toBe(true)
  })

  test('should return false if the file is not a text file', () => {
    const file = { type: 'text/markdown', name: 'file.txt' }

    expect(isTxtFile(file)).toBe(false)
  })
})

describe('isCsvFile', () => {
  test('should return true if the file is a CSV file', () => {
    const file = { type: 'text/csv', name: 'file.csv' }

    expect(isCsvFile(file)).toBe(true)
  })

  test('should return false if the file is not a CSV file', () => {
    const file = { type: 'text/plain', name: 'file.csv' }

    expect(isCsvFile(file)).toBe(false)
  })
})

describe('isPdfFile', () => {
  test('should return true if the file is a PDF file', () => {
    const file = { type: 'application/pdf', name: 'file.pdf' }

    expect(isPdfFile(file)).toBe(true)
  })

  test('should return false if the file is not a PDF file', () => {
    const file = { type: 'text/plain', name: 'file.pdf' }

    expect(isPdfFile(file)).toBe(false)
  })
})

describe('isDocxFile', () => {
  test('should return true if the file is a DOCX file', () => {
    const file = {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      name: 'file.docx',
    }

    expect(isDocxFile(file)).toBe(true)
  })

  test('should return false if the file is not a DOCX file', () => {
    const file = { type: 'text/plain', name: 'file.docx' }

    expect(isDocxFile(file)).toBe(false)
  })
})

describe('isHtmlFile', () => {
  test('should return true if the file is an HTML file', () => {
    const file = { type: 'text/html', name: 'file.html' }

    expect(isHtmlFile(file)).toBe(true)
  })

  test('should return false if the file is not an HTML file', () => {
    const file = { type: 'text/plain', name: 'file.html' }

    expect(isHtmlFile(file)).toBe(false)
  })
})

describe('isTextFile', () => {
  test('should return true if the file type is "text"', () => {
    const file = { type: 'text/plain', name: 'file.txt' }

    expect(isTextFile(file)).toBe(true)
  })

  test('should return false if the file type is not "text"', () => {
    const file = { type: 'application/pdf', name: 'file.pdf' }

    expect(isTextFile(file)).toBe(false)
  })
})

describe('isAudioFile', () => {
  test('should return true if the file type is "audio"', () => {
    const file = { type: 'audio/mpeg', name: 'file.mp3' }

    expect(isAudioFile(file)).toBe(true)
  })

  test('should return false if the file type is not "audio"', () => {
    const file = { type: 'text/plain', name: 'file.txt' }

    expect(isAudioFile(file)).toBe(false)
  })
})

describe('isVideoFile', () => {
  test('should return true if the file type is "video"', () => {
    const file = { type: 'video/mp4', name: 'file.mp4' }

    expect(isVideoFile(file)).toBe(true)
  })

  test('should return false if the file type is not "video"', () => {
    const file = { type: 'text/plain', name: 'file.txt' }

    expect(isVideoFile(file)).toBe(false)
  })
})

describe('extensionToType', () => {
  it('should return the correct mime type for a given extension', () => {
    expect(extensionToType('txt')).toBe('text/plain')
    expect(extensionToType('md')).toBe('text/markdown')
    expect(extensionToType('mdx')).toBe('text/markdown')
  })
})

describe('typeToExtension', () => {
  it('should return the correct extension for a given mime type', () => {
    expect(typeToExtension('text/plain')).toBe('txt')
  })
})

describe('typeToFileName', () => {
  it('should return a filename with the correct extension', () => {
    const type = 'text/plain'
    const name = '123'
    const expected = '123.txt'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should return a filename with a "bin" extension when mime type is unknown', () => {
    const type = 'unknown/unknown'
    const name = '123'
    const expected = '123.bin'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should handle edge cases like empty type string', () => {
    const type = ''
    const name = '123'
    const expected = '123.bin'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('if no name provided it should generate a random name', () => {
    const type = 'text/plain'
    const expected = expect.stringMatching(/.\.txt$/)
    const result = typeToFileName(type)

    expect(result).toEqual(expected)
  })

  it('it should produce the correct file with extensions', () => {
    const map = {
      'text/plain': '123.txt',
      'text/markdown': '123.md', // @note mdx maps to md extension since they both use text/markdown MIME type
      'text/html': '123.html',
      'application/pdf': '123.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '123.docx',
      'application/vnd.ms-excel': '123.xls',
      'application/vnd.ms-powerpoint': '123.ppt',
      'application/zip': '123.zip',
      'application/x-tar': '123.tar',
    }

    for (const type in map) {
      const name = '123'
      const expected = map[type]
      const result = typeToFileName(type, name)

      expect(result).toEqual(expected)
    }
  })

  it('should handle default application/octet-stream type when undefined', () => {
    const name = 'my-file'
    const expected = expect.stringMatching(/^my-file\.(bin|exe)$/)
    const result = typeToFileName(undefined, name)

    expect(result).toEqual(expected)
  })

  it('should handle null type parameter', () => {
    const name = 'my-file'
    const expected = expect.stringMatching(/^my-file\.(bin|exe)$/)
    const result = typeToFileName(null, name)

    expect(result).toEqual(expected)
  })

  it('should preserve special characters in the name', () => {
    const type = 'text/plain'
    const name = 'my-file_name-123'
    const expected = 'my-file_name-123.txt'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should handle names with spaces', () => {
    const type = 'text/plain'
    const name = 'my file name'
    const expected = 'my file name.txt'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should handle MIME types with parameters (charset, etc.)', () => {
    const type = 'text/plain; charset=utf-8'
    const name = 'document'
    const expected = 'document.txt' // MIME library handles parameters correctly
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should work with image MIME types', () => {
    const imageTypes = {
      'image/jpeg': 'photo.jpeg',
      'image/png': 'photo.png',
      'image/gif': 'photo.gif',
      'image/svg+xml': 'photo.svg',
      'image/webp': 'photo.webp',
    }

    for (const type in imageTypes) {
      const name = 'photo'
      const expected = imageTypes[type]
      const result = typeToFileName(type, name)

      expect(result).toEqual(expected)
    }
  })

  it('should work with video MIME types', () => {
    const videoTypes = {
      'video/mp4': 'video.mp4',
      'video/webm': 'video.webm',
      'video/ogg': 'video.ogv',
    }

    for (const type in videoTypes) {
      const name = 'video'
      const expected = videoTypes[type]
      const result = typeToFileName(type, name)

      expect(result).toEqual(expected)
    }
  })

  it('should work with audio MIME types', () => {
    const audioTypes = {
      'audio/mpeg': 'audio.mpga', // audio/mpeg maps to .mpga
      'audio/ogg': 'audio.oga', // audio/ogg maps to .oga
      'audio/wav': 'audio.wav',
    }

    for (const type in audioTypes) {
      const name = 'audio'
      const expected = audioTypes[type]
      const result = typeToFileName(type, name)

      expect(result).toEqual(expected)
    }
  })

  it('should work with JSON MIME types', () => {
    const type = 'application/json'
    const name = 'data'
    const expected = 'data.json'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should work with XML MIME types', () => {
    const type = 'application/xml'
    const name = 'data'
    const expected = 'data.xml'
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should handle case sensitivity in MIME types', () => {
    const type = 'TEXT/PLAIN'
    const name = 'document'
    const expected = 'document.txt' // MIME types are case-insensitive
    const result = typeToFileName(type, name)

    expect(result).toEqual(expected)
  })

  it('should generate unique random names when called multiple times without name', () => {
    const type = 'text/plain'
    const result1 = typeToFileName(type)
    const result2 = typeToFileName(type)

    expect(result1).not.toEqual(result2)
    expect(result1).toMatch(/\.txt$/)
    expect(result2).toMatch(/\.txt$/)
  })
})
