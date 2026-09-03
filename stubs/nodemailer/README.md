# nodemailer stub

This is a stub package that replaces `nodemailer` to avoid including email
sending functionality in bundles where it's not needed.

## Why?

`next-auth` has `nodemailer` as an optional peer dependency for email-based
authentication (magic links, email verification). However, we use different
authentication methods and don't need email sending via nodemailer.

Including the real `nodemailer` would add unnecessary code to the server bundle
and might cause issues in serverless environments.

## How it works

This stub is added as a direct dependency in `platform`:

```json
{
  "dependencies": {
    "nodemailer": "file:../../stubs/nodemailer"
  }
}
```

The stub is empty - any attempt to use nodemailer will fail at runtime, but
`next-auth` will load without errors since it only requires nodemailer when
email authentication is configured.
