# re2 stub

This is a stub package that replaces `re2` to avoid installing the native
module and its compilation requirements.

## Why?

`re2` is a native module that provides Google's RE2 regular expression engine.
It requires C++ compilation during installation, which can fail in various
environments and adds complexity to the build process.

Several packages use `re2` for safer regex processing:

- `@metascraper/helpers` - for URL regex matching
- `url-regex-safe` - for URL detection
- `email-reply-parser` - for email parsing

These packages typically fall back to JavaScript regex when `re2` is not
available, so the stub allows them to work without the native module.

## How it works

This stub is injected via `.pnpmfile.cjs` as a peer dependency:

```javascript
missingPeerDependenciesMap = {
  '@metascraper/helpers': {
    re2: 'file:stubs/re2',
  },
}
```

It's also added as a direct dependency in `platform`:

```json
{
  "dependencies": {
    "re2": "file:../../stubs/re2"
  }
}
```

The stub is empty - packages that use it will fall back to their JavaScript
implementations.
