import { extensionToType, nameToType, reconcileTypeAndExt } from '@/lib/mime2'

describe('nameToType', () => {
  it('should return mime types for known extensions', () => {
    expect(nameToType('file.txt')).toBe('text/plain')
    expect(nameToType('file.json')).toBe('application/json')
    expect(nameToType('file.html')).toBe('text/html')
    expect(nameToType('image.png')).toBe('image/png')
    expect(nameToType('doc.pdf')).toBe('application/pdf')
    expect(nameToType('style.css')).toBe('text/css')
  })

  it('should return text/plain for dotfiles', () => {
    expect(nameToType('.env')).toBe('text/plain')
    expect(nameToType('.gitignore')).toBe('text/plain')
    expect(nameToType('.editorconfig')).toBe('text/plain')
    expect(nameToType('.npmrc')).toBe('text/plain')
    expect(nameToType('.nvmrc')).toBe('text/plain')
    expect(nameToType('.dockerignore')).toBe('text/plain')
    expect(nameToType('.eslintignore')).toBe('text/plain')
    expect(nameToType('.prettierignore')).toBe('text/plain')
    expect(nameToType('.bashrc')).toBe('text/plain')
    expect(nameToType('.profile')).toBe('text/plain')
  })

  it('should extract the basename from paths with directories', () => {
    expect(nameToType('config/.env')).toBe('text/plain')
    expect(nameToType('some/deep/path/.gitignore')).toBe('text/plain')
  })

  it('should return text/plain for extensionless config files', () => {
    expect(nameToType('Makefile')).toBe('text/plain')
    expect(nameToType('Dockerfile')).toBe('text/plain')
    expect(nameToType('Procfile')).toBe('text/plain')
    expect(nameToType('Vagrantfile')).toBe('text/plain')
    expect(nameToType('Gemfile')).toBe('text/plain')
    expect(nameToType('Rakefile')).toBe('text/plain')
    expect(nameToType('Brewfile')).toBe('text/plain')
    expect(nameToType('LICENSE')).toBe('text/plain')
    expect(nameToType('CODEOWNERS')).toBe('text/plain')
    expect(nameToType('OWNERS')).toBe('text/plain')
  })

  it('should be case-insensitive for extensionless config files', () => {
    expect(nameToType('makefile')).toBe('text/plain')
    expect(nameToType('dockerfile')).toBe('text/plain')
    expect(nameToType('license')).toBe('text/plain')
  })

  it('should use the mime library when a dotfile has a known extension', () => {
    expect(nameToType('.eslintrc.json')).toBe('application/json')
    expect(nameToType('.babelrc.js')).toBe('text/javascript')
  })

  it('should return text/plain for common source code files', () => {
    expect(nameToType('main.go')).toBe('text/plain')
    expect(nameToType('app.py')).toBe('text/plain')
    expect(nameToType('server.rb')).toBe('text/plain')
    expect(nameToType('lib.rs')).toBe('text/plain')
    expect(nameToType('app.swift')).toBe('text/plain')
    expect(nameToType('Program.cs')).toBe('text/plain')
    expect(nameToType('Main.kt')).toBe('text/plain')
    expect(nameToType('index.ts')).toBe('text/plain')
    expect(nameToType('Component.tsx')).toBe('text/plain')
    expect(nameToType('App.vue')).toBe('text/plain')
    expect(nameToType('App.svelte')).toBe('text/plain')
    expect(nameToType('main.dart')).toBe('text/plain')
  })

  it('should still return library types for well-supported extensions', () => {
    expect(nameToType('app.js')).toBe('text/javascript')
    expect(nameToType('style.css')).toBe('text/css')
    expect(nameToType('index.html')).toBe('text/html')
  })

  it('should return application/jsonl for jsonl files', () => {
    expect(nameToType('records.jsonl')).toBe('application/jsonl')
  })

  it('should return application/octet-stream for truly unknown files', () => {
    expect(nameToType('unknownfile')).toBe('application/octet-stream')
    expect(nameToType('randomfile')).toBe('application/octet-stream')
  })
})

describe('extensionToType', () => {
  it('should return mime types for known extensions', () => {
    expect(extensionToType('json')).toBe('application/json')
    expect(extensionToType('jsonl')).toBe('application/jsonl')
    expect(extensionToType('html')).toBe('text/html')
    expect(extensionToType('css')).toBe('text/css')
  })

  it('should return text/plain for common source code extensions', () => {
    expect(extensionToType('go')).toBe('text/plain')
    expect(extensionToType('py')).toBe('text/plain')
    expect(extensionToType('rb')).toBe('text/plain')
    expect(extensionToType('rs')).toBe('text/plain')
    expect(extensionToType('swift')).toBe('text/plain')
    expect(extensionToType('cs')).toBe('text/plain')
    expect(extensionToType('kt')).toBe('text/plain')
    expect(extensionToType('ts')).toBe('text/plain')
    expect(extensionToType('.ts')).toBe('text/plain')
    expect(extensionToType('dart')).toBe('text/plain')
  })

  it('should fall back to application/octet-stream for unknown extensions', () => {
    expect(extensionToType('xyz123')).toBe('application/octet-stream')
  })
})

describe('reconcileTypeAndExt', () => {
  it('should return null for both type and ext when both inputs are null', () => {
    expect(reconcileTypeAndExt(null, null)).toEqual({ type: null, ext: null })
  })

  it('should determine the type based on ext', () => {
    expect(reconcileTypeAndExt(null, '.html')).toEqual({
      type: 'text/html',
      ext: 'html',
    })
  })

  it('should determine the ext based on type', () => {
    expect(reconcileTypeAndExt('application/json', null)).toEqual({
      type: 'application/json',
      ext: 'json',
    })
  })

  it('should correct the type based on ext when type is generic', () => {
    expect(reconcileTypeAndExt('application/octet-stream', '.pdf')).toEqual({
      type: 'application/pdf',
      ext: 'pdf',
    })
  })

  it('should correct the ext based on type when ext is generic', () => {
    expect(reconcileTypeAndExt('text/plain', 'bin')).toEqual({
      type: 'text/plain',
      ext: 'txt',
    })
  })

  it('should return the original valid type and ext if both are correct', () => {
    expect(reconcileTypeAndExt('image/jpeg', 'jpg')).toEqual({
      type: 'image/jpeg',
      ext: 'jpg',
    })
  })

  it('should handle and trim whitespace in inputs', () => {
    expect(reconcileTypeAndExt('  image/png  ', '  .png  ')).toEqual({
      type: 'image/png',
      ext: 'png',
    })
  })
})
