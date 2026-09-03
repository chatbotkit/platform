# canvas stub

This is a stub package that replaces `canvas` to avoid installing the native
module and its platform-specific dependencies.

## Why?

The `canvas` package is a native module that requires platform-specific binaries
and system dependencies (Cairo, Pango, etc.). Several packages in the ecosystem
have it as an optional peer dependency:

- `jsdom` - for rendering and testing
- `jest-environment-jsdom` - for Jest testing
- `metascraper` - for image processing

Since we don't use any canvas-dependent features in these packages, we provide
this empty stub to satisfy the dependency without installing the real native
module.

## How it works

This stub is added as a direct dependency in packages that need it:

```json
{
  "dependencies": {
    "canvas": "file:../../stubs/canvas"
  }
}
```

The stub is empty - any attempt to use canvas functionality will fail at
runtime, but the packages that depend on it will load without errors.
