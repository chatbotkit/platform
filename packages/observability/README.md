# @chatbotkit-dev/observability

The community observability provider.

Writes to the console, and only when `DEBUG` is set. A deployment without an error tracker should
still see its own errors and should not have to run somebody else's service in order to boot.

The package also supplies no-op Next.js client, server and build adapters. A
deployment can replace the package with another implementation of the same
entry points without changing the platform application.
