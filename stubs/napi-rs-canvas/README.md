# @napi-rs/canvas stub

This is a stub package that replaces `@napi-rs/canvas` to satisfy `unpdf` type
declarations without installing the actual native module.

## Why?

`unpdf` exports types that reference `@napi-rs/canvas` for image rendering
functionality (extracting images from PDFs, rendering pages as images). However,
we only use `unpdf` for text extraction via `extractText()`, which doesn't
require canvas support.

The real `@napi-rs/canvas` is a native Rust addon that requires prebuilt
binaries for each platform, which adds complexity to the build process.

## How it works

This stub is added as a direct dependency in `packages/file-pdf`:

```json
{
  "dependencies": {
    "@napi-rs/canvas": "file:../../stubs/napi-rs-canvas"
  }
}
```

Since `@napi-rs/canvas` is an optional peer dependency of `unpdf`, adding it to
the consuming package makes it available in the dependency tree. The `.pnpmfile.cjs`
peer dependency injection didn't work for optional peers, so the direct dependency
approach was used instead.

The stub provides:

- Empty runtime exports that throw errors if accidentally called
- TypeScript type declarations (`Canvas`, `SKRSContext2D`, `ImageData`, etc.)
  to satisfy the compiler
