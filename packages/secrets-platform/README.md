# @chatbotkit-dev/secrets-platform

The **platform secret catalogue**: credentials a deployment offers on behalf of
its users, so a user does not have to register their own OAuth application for a
supported service.

This is distinct from the standard secret catalogue in
`platform/data/secrets/catalogue/standard.yaml`, which describes the generic
*shapes* of credentials a user can store (`plain`, `basic`, `bearer`, `jwt`,
`oauth`, `template`). This package describes concrete, deployment owned
credentials.

## The community catalogue is empty

Platform hosted credentials are specific to whoever runs the deployment. There
is no sensible default, because there is no shared OAuth application to point
at. This package therefore exports `{}`.

Ability templates that name a platform secret with `@platform/...` resolve to
`null` against an empty catalogue, which is a supported state:
`findSecretTemplate` in `platform/lib/ability.secret.ts` returns null when the
catalogue has no matching entry.

## Providing your own

Replace this package at install time with one exporting the same shape:

```jsonc
// pnpm-workspace.yaml
overrides:
  '@chatbotkit-dev/secrets-platform': 'link:./packages/secrets-platform'
```

The replacement must default export a `Record<string, Secret>` using the types
exported here. Credential fields are expected to be encrypted with the same
scheme the deployment configures through `CLOAK_ENCRYPTION_KEY`.

## Why this is a package

The catalogue carries live credentials, so it must not live in the published
platform tree in any form. Making it a module means resolution happens at import
time in every context the platform runs in: the Next build, `scripts/` via tsx,
both jest configurations, and `next.config.d` evaluation.

It exports TypeScript rather than YAML deliberately. A YAML import depends on a
webpack loader that does not exist under tsx or jest.
