# @chatbotkit-dev/storage

The community storage default: an S3-protocol implementation of
`@chatbotkit-dev/storage-spec`. It speaks the protocol, not the vendor - point
it at any S3-compatible store (Garage, SeaweedFS, Cloudflare R2, or AWS S3
itself). A deployment with different storage needs replaces it with a pnpm
override; nothing in the platform imports it by name.

## Environment

| Variable                        | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `SERVICE_AWS_REGION`            | Region the buckets live in (any non-empty value for stores without regions) |
| `SERVICE_AWS_ACCESS_KEY_ID`     | Credentials used for every operation                                   |
| `SERVICE_AWS_SECRET_ACCESS_KEY` |                                                                        |
| `SERVICE_AWS_ENDPOINT`          | S3-compatible endpoint; unset means AWS proper                         |
| `SERVICE_AWS_FORCE_PATH_STYLE`  | `true` for stores without wildcard DNS in front (most self-hosted ones) |
| `SERVICE_AWS_STORAGE_ROLE_ARN`  | Role assumed to mint prefix-scoped credentials for sandbox mounts      |

Which bucket backs which logical store is this package's business alone - the
platform names a scope, and each scope resolves its bucket from its own
variable: `FILE_S3_BUCKET_NAME`, `IMAGE_S3_BUCKET_NAME`, `VIDEO_S3_BUCKET_NAME`,
`AUDIO_S3_BUCKET_NAME`, `CONVERSATION_S3_BUCKET_NAME`,
`NAMESPACE_S3_BUCKET_NAME`, `SESSION_S3_BUCKET_NAME`, `SPACE_S3_BUCKET_NAME`,
`TEMP_S3_BUCKET_NAME`, `OUTPUT_S3_BUCKET_NAME`. The variables may share a
bucket.

Sandbox storage mounts are the one AWS-shaped feature: they mint prefix-scoped
credentials through STS AssumeRole, so they need `SERVICE_AWS_STORAGE_ROLE_ARN`
and a store with a compatible STS behind it. Until that is set, everything
except sandbox mounts works, and `assertConfigured` fails with a message naming
it.

## Configuration is resolved lazily

Nothing is read from the environment at import, so the platform loads and
builds with storage unconfigured, and refuses at the point of use.
`assertConfigured` is what turns a missing or wrong credential into a build
failure rather than a runtime one: it checks that every bucket variable is set
and that each bucket is actually reachable with the configured credentials,
because a present-but-wrong key reads exactly like a correct one until the
first request.
